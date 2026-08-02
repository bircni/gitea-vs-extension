import * as fs from "node:fs";
import * as vscode from "vscode";
import { getArtifactDownloadBaseDir } from "../config/settings";
import type { RefreshController } from "../controllers/refreshController";
import type { ReviewCommentsController } from "../controllers/reviewCommentsController";
import type { RepoRef, WorkflowRun } from "../gitea/models";
import { computeArtifactSavePath } from "./artifactDownload";
import type { BranchFilterMode } from "./branchContext";
import type { RepoStateStore } from "./cache";
import { ArtifactNode } from "../views/nodes";

/**
 * Internal commands for @vscode/test-electron only (EXTENSION_TEST_MODE=1).
 */
export function registerExtensionTestCommands(
  context: vscode.ExtensionContext,
  store: RepoStateStore,
  refreshController: RefreshController,
  reviewCommentsController?: ReviewCommentsController,
): vscode.Disposable[] {
  if (process.env.EXTENSION_TEST_MODE !== "1") {
    return [];
  }

  /** Refresh, then return the first discovered repo and its first run (loading run details). */
  const firstRunWithDetails = async (): Promise<{ repo: RepoRef; run: WorkflowRun }> => {
    await refreshController.refreshAll();
    const [repo] = store.getRepos();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getRepos() can be empty at runtime
    if (!repo) {
      throw new Error("no repositories discovered");
    }
    const run = store.getEntry(repo)?.runs[0];
    if (!run) {
      throw new Error("no runs available for the first repository");
    }
    await refreshController.loadRunDetails(repo, run.id);
    return { repo, run };
  };

  return [
    vscode.commands.registerCommand(
      "gitea-vs-extension.__testRepoCount",
      () => store.getRepos().length,
    ),
    vscode.commands.registerCommand("gitea-vs-extension.__testRefreshDone", async () => {
      await refreshController.refreshAll();
      return store.getRepos().length;
    }),
    vscode.commands.registerCommand("gitea-vs-extension.__testRepoSnapshot", async () => {
      await refreshController.refreshAll();
      return {
        repos: store.getRepos().map((repo) => {
          const entry = store.getEntry(repo);
          const context = store.getBranchContext(repo);
          return {
            repo,
            pullRequestCount: entry?.pullRequests.length ?? 0,
            runCount: entry?.runs.length ?? 0,
            branchContext: context
              ? {
                  status: context.status,
                  branchName: "branchName" in context ? context.branchName : undefined,
                }
              : undefined,
          };
        }),
      };
    }),
    vscode.commands.registerCommand("gitea-vs-extension.__testReviewCommentCount", async () => {
      await refreshController.refreshAll();
      await reviewCommentsController?.refreshForCurrentBranch();
      return reviewCommentsController?.getRenderedCommentCount() ?? 0;
    }),
    vscode.commands.registerCommand("gitea-vs-extension.__testReviewCommentSnapshot", async () => {
      await refreshController.refreshAll();
      await reviewCommentsController?.refreshForCurrentBranch();
      return reviewCommentsController?.getRenderedCommentSnapshot() ?? [];
    }),
    vscode.commands.registerCommand("gitea-vs-extension.__testAddReviewComment", async () => {
      const filePath = process.env.GITEA_EXTENSION_TEST_COMMENT_FILE;
      if (!filePath) {
        throw new Error("GITEA_EXTENSION_TEST_COMMENT_FILE is required");
      }
      const line = Number(process.env.GITEA_EXTENSION_TEST_COMMENT_LINE ?? "1");
      if (!Number.isSafeInteger(line) || line < 1) {
        throw new Error("GITEA_EXTENSION_TEST_COMMENT_LINE must be a positive integer");
      }

      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      const editor = await vscode.window.showTextDocument(document, { preview: false });
      const zeroBasedLine = line - 1;
      editor.selection = new vscode.Selection(zeroBasedLine, 0, zeroBasedLine, 0);

      await vscode.commands.executeCommand("gitea-vs-extension.addReviewComment");
      return {
        filePath,
        line,
      };
    }),
    // Load jobs + artifacts for the first run and report their counts (exercises listJobs/listArtifacts).
    vscode.commands.registerCommand("gitea-vs-extension.__testLoadFirstRunDetails", async () => {
      const { repo, run } = await firstRunWithDetails();
      const entry = store.getEntry(repo);
      const runKey = String(run.id);
      return {
        runId: run.id,
        jobCount: entry?.jobsByRun.get(runKey)?.length ?? 0,
        artifactCount: entry?.artifactsByRun.get(runKey)?.length ?? 0,
      };
    }),
    // Run the real viewJobLogs command for the first job and return the opened document's text.
    vscode.commands.registerCommand("gitea-vs-extension.__testViewFirstJobLog", async () => {
      const { repo, run } = await firstRunWithDetails();
      const [job] = store.getEntry(repo)?.jobsByRun.get(String(run.id)) ?? [];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the jobs array can be empty at runtime
      if (!job) {
        throw new Error("no jobs available for the first run");
      }
      await vscode.commands.executeCommand("gitea-vs-extension.viewJobLogs", { repo, run, job });
      return { content: vscode.window.activeTextEditor?.document.getText() ?? "" };
    }),
    // Run the real downloadArtifact command for the first artifact and return the saved file content.
    vscode.commands.registerCommand("gitea-vs-extension.__testDownloadFirstArtifact", async () => {
      const { repo, run } = await firstRunWithDetails();
      const [artifact] = store.getEntry(repo)?.artifactsByRun.get(String(run.id)) ?? [];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the artifacts array can be empty at runtime
      if (!artifact) {
        throw new Error("no artifacts available for the first run");
      }
      const node = new ArtifactNode(repo, run.id, artifact);
      await vscode.commands.executeCommand("gitea-vs-extension.downloadArtifact", node);
      const savePath = computeArtifactSavePath(
        getArtifactDownloadBaseDir(),
        repo,
        run.id,
        artifact,
      );
      const exists = fs.existsSync(savePath);
      return {
        savePath,
        exists,
        content: exists ? fs.readFileSync(savePath).toString("utf8") : "",
      };
    }),
    // Force a branch filter on the first repo so a later refresh performs the server-side branch fetch.
    vscode.commands.registerCommand(
      "gitea-vs-extension.__testSetBranchFilter",
      (mode: BranchFilterMode, branchName?: string) => {
        const [repo] = store.getRepos();
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getRepos() can be empty at runtime
        if (!repo) {
          throw new Error("no repositories discovered");
        }
        store.setBranchFilter(
          mode === "specificBranch" ? { repo, mode, branchName } : { repo, mode },
        );
        return store.getBranchFilter(repo);
      },
    ),
  ];
}
