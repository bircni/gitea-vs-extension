import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import * as vscode from "vscode";
import { getSettings } from "../config/settings";
import type { GiteaApi } from "../gitea/api";
import type { PullRequest, PullRequestReviewComment, RepoRef } from "../gitea/models";
import type { Logger } from "../util/logging";
import { execGit } from "../util/git";
import { resolveRepoFromFolder, resolveWorkspaceRepos } from "../util/repoResolution";

type RepoContext = {
  repo: RepoRef;
  folder: vscode.WorkspaceFolder;
  branch?: string;
  sha?: string;
};

type ThreadKey = string;

type ThreadPlan = {
  uri: vscode.Uri;
  line: number;
  comments: PullRequestReviewComment[];
};

export class ReviewCommentsController implements vscode.Disposable {
  private readonly commentController = vscode.comments.createCommentController(
    "gitea-vs-extension.reviewComments",
    "Gitea Review Comments",
  );
  private readonly threads = new Map<ThreadKey, vscode.CommentThread>();
  private readonly avatarCache: AvatarCache;
  private refreshInProgress = false;
  private pendingRefresh = false;
  private activeKey?: string;
  private lastRenderFingerprint?: string;
  private lastThreadPlan = new Map<ThreadKey, ThreadPlan>();

  constructor(
    private readonly api: GiteaApi,
    private readonly logger: Logger,
    storageRoot: string,
  ) {
    this.commentController.commentingRangeProvider = {
      provideCommentingRanges: () => [],
    };
    this.avatarCache = new AvatarCache(api, logger, storageRoot, (url) =>
      this.patchAvatarsForUrl(url),
    );
  }

  dispose(): void {
    this.clear();
    this.commentController.dispose();
  }

  scheduleRefresh(): void {
    if (this.refreshInProgress) {
      this.pendingRefresh = true;
      return;
    }
    void this.refreshForCurrentBranch();
  }

  async refreshForCurrentBranch(): Promise<void> {
    if (this.refreshInProgress) {
      this.pendingRefresh = true;
      return;
    }

    this.refreshInProgress = true;
    try {
      const settings = getSettings();
      if (!settings.reviewCommentsEnabled) {
        this.clear();
        return;
      }

      const context = await this.resolveRepoContext(settings.baseUrl);
      if (!context) {
        this.clear();
        return;
      }

      const pullRequest = await this.findMatchingPullRequest(
        context.repo,
        context.branch,
        context.sha,
      );
      if (!pullRequest) {
        this.clear();
        return;
      }

      const comments = await this.loadReviewComments(context.repo, pullRequest.number);
      const resolved = await this.resolveDiffPositions(context.repo, pullRequest.number, comments);
      this.renderComments(context.folder, pullRequest.number, resolved);
    } catch (error) {
      this.logger.debug(`Failed to refresh review comments: ${formatError(error)}`);
    } finally {
      this.refreshInProgress = false;
      if (this.pendingRefresh) {
        this.pendingRefresh = false;
        void this.refreshForCurrentBranch();
      }
    }
  }

  private clear(): void {
    for (const thread of this.threads.values()) {
      thread.dispose();
    }
    this.threads.clear();
    this.activeKey = undefined;
    this.lastRenderFingerprint = undefined;
    this.lastThreadPlan = new Map();
  }

  /** Update comment avatars after a URL finishes downloading — avoids a full refresh/flicker. */
  private patchAvatarsForUrl(url: string): void {
    for (const [threadKey, plan] of this.lastThreadPlan) {
      if (!plan.comments.some((c) => c.avatarUrl === url)) {
        continue;
      }
      const thread = this.threads.get(threadKey);
      if (!thread) {
        continue;
      }
      thread.comments = plan.comments.map((c) =>
        toVscodeComment(c, this.avatarCache.getAvatarUri(c.avatarUrl)),
      );
    }
  }

  private async resolveRepoContext(baseUrl: string): Promise<RepoContext | undefined> {
    const activeFolder = getActiveWorkspaceFolder();
    if (activeFolder) {
      const repo = await resolveRepoFromFolder(activeFolder.uri.fsPath, baseUrl);
      if (repo) {
        const { branch, sha } = await getGitHead(activeFolder.uri.fsPath);
        return { repo, folder: activeFolder, branch, sha };
      }
    }

    const fallbackRepos = await resolveWorkspaceRepos(baseUrl);
    const fallback = fallbackRepos.at(0);
    if (!fallback) {
      return undefined;
    }
    const { branch, sha } = await getGitHead(fallback.folder.uri.fsPath);
    return { repo: fallback.repo, folder: fallback.folder, branch, sha };
  }

  private async findMatchingPullRequest(
    repo: RepoRef,
    branch?: string,
    sha?: string,
  ): Promise<PullRequest | undefined> {
    const pullRequests = await this.api.listPullRequests(repo);
    if (!pullRequests.length) {
      return undefined;
    }

    const normalizedBranch = normalizeBranchName(branch);

    if (sha) {
      const match = pullRequests.find((pr) => pr.headSha === sha);
      if (match) {
        return match;
      }
    }

    if (normalizedBranch) {
      return pullRequests.find((pr) => pr.headRef === normalizedBranch);
    }

    return undefined;
  }

  private async loadReviewComments(
    repo: RepoRef,
    pullRequestNumber: number,
  ): Promise<PullRequestReviewComment[]> {
    const reviews = await this.api.listPullRequestReviews(repo, pullRequestNumber);
    if (!reviews.length) {
      return [];
    }

    const commentLists = await Promise.all(
      reviews.map((review) =>
        this.api.listPullRequestReviewComments(repo, pullRequestNumber, review.id),
      ),
    );
    return commentLists.flat();
  }

  private async resolveDiffPositions(
    repo: RepoRef,
    pullRequestNumber: number,
    comments: PullRequestReviewComment[],
  ): Promise<PullRequestReviewComment[]> {
    const needsResolution = comments.some(
      (comment) => !comment.line && comment.position && comment.path,
    );
    if (!needsResolution) {
      return comments;
    }

    try {
      const diffText = await this.api.getPullRequestDiff(repo, pullRequestNumber);
      const positionMap = buildDiffPositionMap(diffText);
      return comments.map((comment) => {
        if (comment.line || !comment.position || !comment.path) {
          return comment;
        }
        const fileMap = positionMap.get(normalizeDiffPath(comment.path));
        const mappedLine = fileMap?.get(comment.position);
        if (!mappedLine) {
          return comment;
        }
        return {
          ...comment,
          line: mappedLine,
        };
      });
    } catch (error) {
      this.logger.debug(`Failed to load diff for PR #${pullRequestNumber}: ${formatError(error)}`);
      return comments;
    }
  }

  private renderComments(
    folder: vscode.WorkspaceFolder,
    pullRequestNumber: number,
    comments: PullRequestReviewComment[],
  ): void {
    const key = `${folder.uri.fsPath}:${pullRequestNumber}`;
    const plan = planReviewCommentThreads(folder, comments);
    const fp = fingerprintCommentPlan(folder.uri.fsPath, pullRequestNumber, plan);

    if (this.activeKey === key && fp === this.lastRenderFingerprint) {
      return;
    }

    if (this.activeKey !== key) {
      this.clear();
    } else {
      for (const thread of this.threads.values()) {
        thread.dispose();
      }
      this.threads.clear();
    }

    this.activeKey = key;
    this.lastRenderFingerprint = fp;
    this.lastThreadPlan = plan;

    for (const [threadKey, { uri, line, comments: threadComments }] of plan) {
      const range = new vscode.Range(line - 1, 0, line - 1, 0);
      const thread = this.commentController.createCommentThread(uri, range, []);
      thread.contextValue = "giteaReviewComment";
      thread.canReply = false;
      thread.comments = threadComments.map((c) =>
        toVscodeComment(c, this.avatarCache.getAvatarUri(c.avatarUrl)),
      );
      this.threads.set(threadKey, thread);
    }
  }
}

export function planReviewCommentThreads(
  folder: vscode.WorkspaceFolder,
  comments: PullRequestReviewComment[],
): Map<ThreadKey, ThreadPlan> {
  const buckets = new Map<ThreadKey, PullRequestReviewComment[]>();
  for (const comment of comments) {
    const line = comment.line ?? comment.originalLine;
    if (!comment.path || !line || line < 1) {
      continue;
    }
    const uri = fileUriForComment(folder.uri, comment.path);
    if (!uri || !fs.existsSync(uri.fsPath)) {
      continue;
    }
    const threadKey = `${uri.fsPath}:${line}`;
    const existing = buckets.get(threadKey);
    if (existing) {
      existing.push(comment);
    } else {
      buckets.set(threadKey, [comment]);
    }
  }

  const plan = new Map<ThreadKey, ThreadPlan>();
  for (const [threadKey, list] of buckets) {
    list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (list.length === 0) {
      continue;
    }
    const first = list[0];
    if (!first.path) {
      continue;
    }
    const line = first.line ?? first.originalLine;
    if (!line || line < 1) {
      continue;
    }
    const uri = fileUriForComment(folder.uri, first.path);
    if (!uri) {
      continue;
    }
    plan.set(threadKey, { uri, line, comments: list });
  }
  return plan;
}

export function fingerprintCommentPlan(
  folderFsPath: string,
  pullRequestNumber: number,
  plan: Map<ThreadKey, ThreadPlan>,
): string {
  const header = `${folderFsPath}:${pullRequestNumber}`;
  const keys = [...plan.keys()].sort();
  const lines: string[] = [header];
  for (const threadKey of keys) {
    const entry = plan.get(threadKey);
    if (!entry) {
      continue;
    }
    for (const c of entry.comments) {
      lines.push(
        `${threadKey}\0${String(c.id)}\0${c.body ?? ""}\0${c.author ?? ""}\0${c.updatedAt ?? c.createdAt ?? ""}`,
      );
    }
  }
  return lines.join("\n");
}

async function getGitHead(folderPath: string): Promise<{ branch?: string; sha?: string }> {
  try {
    const [branch, sha] = await Promise.all([
      execGit(["rev-parse", "--abbrev-ref", "HEAD"], folderPath),
      execGit(["rev-parse", "HEAD"], folderPath),
    ]);
    const branchName = branch.trim();
    return {
      branch: branchName === "HEAD" ? undefined : branchName,
      sha: sha.trim() || undefined,
    };
  } catch {
    return {};
  }
}

function getActiveWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    const folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    if (folder) {
      return folder;
    }
  }
  return vscode.workspace.workspaceFolders?.[0];
}

function fileUriForComment(workspaceRoot: vscode.Uri, commentPath: string): vscode.Uri | undefined {
  const normalized = normalizeDiffPath(commentPath);
  const parts = normalized.split("/").filter(Boolean);
  if (!parts.length) {
    return undefined;
  }
  const fsPath = path.resolve(workspaceRoot.fsPath, ...parts);
  return vscode.Uri.file(fsPath);
}

function normalizeBranchName(branch?: string): string | undefined {
  if (!branch) {
    return undefined;
  }
  if (branch.startsWith("refs/heads/")) {
    return branch.slice("refs/heads/".length);
  }
  return branch;
}

function normalizeDiffPath(filePath: string): string {
  let normalized = filePath.trim();
  if (normalized.startsWith("a/") || normalized.startsWith("b/")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

function toVscodeComment(
  comment: PullRequestReviewComment,
  avatarUri?: vscode.Uri,
): vscode.Comment {
  const markdown = new vscode.MarkdownString(comment.body ?? "");
  markdown.isTrusted = false;
  const timestamp = comment.updatedAt ?? comment.createdAt;
  return {
    body: markdown,
    author: { name: comment.author ?? "Unknown", iconPath: avatarUri },
    mode: vscode.CommentMode.Preview,
    timestamp: timestamp ? new Date(timestamp) : undefined,
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

export function buildDiffPositionMap(diffText: string): Map<string, Map<number, number>> {
  const map = new Map<string, Map<number, number>>();
  const lines = diffText.split(/\r?\n/);

  let currentFile: string | undefined;
  let inHunk = false;
  let diffPosition = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      currentFile = undefined;
      inHunk = false;
      diffPosition = 0;
      continue;
    }

    if (line.startsWith("+++ ")) {
      const pathPart = line.slice(4).trim();
      if (pathPart === "/dev/null") {
        currentFile = undefined;
        continue;
      }
      currentFile = normalizeDiffPath(pathPart);
      if (!map.has(currentFile)) {
        map.set(currentFile, new Map());
      }
      continue;
    }

    if (line.startsWith("@@ ")) {
      const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match) {
        newLine = Number(match[2]);
      }
      inHunk = true;
      continue;
    }

    if (!inHunk || !currentFile) {
      continue;
    }

    if (line.startsWith("\\ No newline")) {
      continue;
    }

    diffPosition += 1;
    const fileMap = map.get(currentFile);
    if (!fileMap) {
      continue;
    }

    if (line.startsWith(" ")) {
      fileMap.set(diffPosition, newLine);
      newLine += 1;
      continue;
    }

    if (line.startsWith("+")) {
      fileMap.set(diffPosition, newLine);
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      continue;
    }
  }

  return map;
}

class AvatarCache {
  private readonly avatarDir: string;
  private readonly inflight = new Set<string>();

  constructor(
    private readonly api: GiteaApi,
    private readonly logger: Logger,
    storageRoot: string,
    private readonly onAvatarCached: (url: string) => void,
  ) {
    this.avatarDir = path.join(storageRoot, "gitea-avatars");
  }

  getAvatarUri(url?: string): vscode.Uri | undefined {
    if (!url) {
      return undefined;
    }

    const cachedPath = this.getCachePath(url);
    if (cachedPath && fs.existsSync(cachedPath)) {
      return vscode.Uri.file(cachedPath);
    }

    if (this.inflight.has(url)) {
      return undefined;
    }

    this.inflight.add(url);
    void this.download(url, cachedPath)
      .then(() => this.onAvatarCached(url))
      .catch((error) => {
        this.logger.debug(`Failed to cache avatar: ${formatError(error)}`);
      })
      .finally(() => {
        this.inflight.delete(url);
      });

    return undefined;
  }

  private getCachePath(url: string): string | undefined {
    try {
      const parsed = new URL(url);
      const ext = path.extname(parsed.pathname) || ".png";
      const hash = createHash("sha256").update(url).digest("hex");
      return path.join(this.avatarDir, `${hash}${ext}`);
    } catch {
      return undefined;
    }
  }

  private async download(url: string, targetPath?: string): Promise<void> {
    if (!targetPath) {
      return;
    }
    await fs.promises.mkdir(this.avatarDir, { recursive: true });
    const data = await this.api.fetchBinaryUrl(url);
    await fs.promises.writeFile(targetPath, Buffer.from(data));
  }
}
