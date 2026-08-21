import * as assert from "node:assert";
import { request } from "undici";
import * as vscode from "vscode";

const isRealGitea = process.env.GITEA_EXTENSION_TEST_KIND === "real-gitea";

suite(`gitea-vs-extension E2E (${isRealGitea ? "real Gitea" : "mock"})`, () => {
  test("M1: extension is present and activates", async () => {
    const ext = vscode.extensions.getExtension("bircni.gitea-vs-extension");
    assert.ok(ext, "extension bircni.gitea-vs-extension not found");
    await ext.activate();
  });

  test("M2: Test Connection reaches configured Gitea", async () => {
    await vscode.commands.executeCommand("gitea-vs-extension.testConnection");
  });

  test("M3: refresh discovers configured repo", async () => {
    const count = await vscode.commands.executeCommand<number>(
      "gitea-vs-extension.__testRefreshDone",
    );
    assert.ok(
      typeof count === "number" && count >= 1,
      `expected repo count >= 1, got ${String(count)}`,
    );
  });

  test("M4: refresh discovers runs and pull requests for the mock repo", async function () {
    if (isRealGitea) {
      this.skip();
    }
    const snapshot = await vscode.commands.executeCommand<RepoSnapshot>(
      "gitea-vs-extension.__testRepoSnapshot",
    );
    assert.ok(snapshot.repos.length > 0, "expected at least one mock repo");
    const repo = snapshot.repos[0];
    assert.ok(repo.runCount >= 1, `expected at least one run, got ${repo.runCount}`);
    assert.ok(
      repo.pullRequestCount >= 1,
      `expected at least one pull request, got ${repo.pullRequestCount}`,
    );
  });

  test("M5: loading run details fetches jobs and artifacts", async function () {
    if (isRealGitea) {
      this.skip();
    }
    const details = await vscode.commands.executeCommand<RunDetailsSnapshot>(
      "gitea-vs-extension.__testLoadFirstRunDetails",
    );
    assert.ok(details.jobCount >= 1, `expected at least one job, got ${details.jobCount}`);
    assert.ok(
      details.artifactCount >= 1,
      `expected at least one artifact, got ${details.artifactCount}`,
    );
  });

  test("M6: viewJobLogs opens the job log content", async function () {
    if (isRealGitea) {
      this.skip();
    }
    const result = await vscode.commands.executeCommand<{ content: string }>(
      "gitea-vs-extension.__testViewFirstJobLog",
    );
    assert.match(result.content, /mock log line/);
  });

  test("M7: downloadArtifact saves the artifact to disk", async function () {
    if (isRealGitea) {
      this.skip();
    }
    const result = await vscode.commands.executeCommand<{
      savePath: string;
      exists: boolean;
      content: string;
    }>("gitea-vs-extension.__testDownloadFirstArtifact");
    assert.ok(result.exists, `expected artifact file at ${result.savePath}`);
    assert.ok(result.content.length > 0, "expected non-empty artifact content");
  });

  test("M8: specific-branch filter triggers a server-side fetch and merges runs", async function () {
    if (isRealGitea) {
      this.skip();
    }
    const before = await vscode.commands.executeCommand<RepoSnapshot>(
      "gitea-vs-extension.__testRepoSnapshot",
    );
    const beforeCount = before.repos[0].runCount;

    await vscode.commands.executeCommand(
      "gitea-vs-extension.__testSetBranchFilter",
      "specificBranch",
      "feature",
    );

    const after = await vscode.commands.executeCommand<RepoSnapshot>(
      "gitea-vs-extension.__testRepoSnapshot",
    );
    const afterCount = after.repos[0].runCount;
    assert.ok(
      afterCount > beforeCount,
      `expected branch fetch to add runs (before ${beforeCount}, after ${afterCount})`,
    );
  });

  test("G1: real Gitea fixture is version 1.27.2", async function () {
    if (!isRealGitea) {
      this.skip();
    }
    const baseUrl = requireEnv("GITEA_EXTENSION_TEST_BASE_URL");
    const response = await request(`${baseUrl}/api/v1/version`);
    assert.strictEqual(response.statusCode, 200);
    const body = (await response.body.json()) as { version?: string };
    assert.strictEqual(body.version, "1.27.2");
  });

  test("G2: refresh discovers fixture repo and pull request", async function () {
    if (!isRealGitea) {
      this.skip();
    }
    const owner = requireEnv("GITEA_EXTENSION_TEST_OWNER");
    const repoName = requireEnv("GITEA_EXTENSION_TEST_REPO");
    const branch = requireEnv("GITEA_EXTENSION_TEST_BRANCH");
    const snapshot = await vscode.commands.executeCommand<RepoSnapshot>(
      "gitea-vs-extension.__testRepoSnapshot",
    );
    const repo = snapshot.repos.find(
      (entry) => entry.repo.owner === owner && entry.repo.name === repoName,
    );
    assert.ok(repo, `expected fixture repo ${owner}/${repoName}`);
    assert.ok(repo.pullRequestCount >= 1, `expected at least one PR, got ${repo.pullRequestCount}`);
    const context = repo.branchContext;
    assert.ok(context, "expected resolved branch context");
    assert.strictEqual(context.status, "resolved");
    assert.strictEqual(context.branchName, branch);
  });

  test("G3: workspace discovery mode resolves the same fixture repo", async function () {
    if (!isRealGitea) {
      this.skip();
    }
    const owner = requireEnv("GITEA_EXTENSION_TEST_OWNER");
    const repoName = requireEnv("GITEA_EXTENSION_TEST_REPO");
    const branch = requireEnv("GITEA_EXTENSION_TEST_BRANCH");
    const config = vscode.workspace.getConfiguration();

    try {
      await config.update(
        "gitea-vs-extension.discovery.mode",
        "workspace",
        vscode.ConfigurationTarget.Workspace,
      );
      const snapshot = await vscode.commands.executeCommand<RepoSnapshot>(
        "gitea-vs-extension.__testRepoSnapshot",
      );
      assert.strictEqual(snapshot.repos.length, 1);
      const repo = snapshot.repos[0];
      assert.strictEqual(repo.repo.owner, owner);
      assert.strictEqual(repo.repo.name, repoName);
      const context = repo.branchContext;
      assert.ok(context, "expected resolved branch context");
      assert.strictEqual(context.status, "resolved");
      assert.strictEqual(context.branchName, branch);
    } finally {
      await config.update(
        "gitea-vs-extension.discovery.mode",
        "allAccessible",
        vscode.ConfigurationTarget.Workspace,
      );
    }
  });

  test("G4: seeded review comments render inline", async function () {
    if (!isRealGitea) {
      this.skip();
    }
    const seededCount = Number(requireEnv("GITEA_EXTENSION_TEST_SEEDED_COMMENT_COUNT"));
    const comments = await vscode.commands.executeCommand<ReviewCommentSnapshot[]>(
      "gitea-vs-extension.__testReviewCommentSnapshot",
    );
    assert.ok(
      comments.length >= seededCount,
      `expected at least ${seededCount} comment(s), got ${comments.length}`,
    );
    assert.ok(
      comments.some(
        (comment) =>
          comment.body === "seeded fixture review comment" &&
          comment.path === "README.md" &&
          comment.line === 3,
      ),
      `expected seeded fixture review comment in ${JSON.stringify(comments)}`,
    );
  });

  test("G5: add review comment command creates a real Gitea comment", async function () {
    if (!isRealGitea) {
      this.skip();
    }
    const expectedBody = requireEnv("GITEA_EXTENSION_TEST_REVIEW_COMMENT_BODY");
    const before = await vscode.commands.executeCommand<number>(
      "gitea-vs-extension.__testReviewCommentCount",
    );
    await vscode.commands.executeCommand("gitea-vs-extension.__testAddReviewComment");
    const comments = await vscode.commands.executeCommand<ReviewCommentSnapshot[]>(
      "gitea-vs-extension.__testReviewCommentSnapshot",
    );
    assert.ok(
      comments.length > before,
      `expected comment count to increase from ${before}, got ${comments.length}`,
    );
    assert.ok(
      comments.some(
        (comment) =>
          comment.body === expectedBody && comment.path === "README.md" && comment.line === 3,
      ),
      `expected created review comment in ${JSON.stringify(comments)}`,
    );
  });

  test("G6: created review comment persists across a fresh refresh", async function () {
    if (!isRealGitea) {
      this.skip();
    }
    const expectedBody = requireEnv("GITEA_EXTENSION_TEST_REVIEW_COMMENT_BODY");
    const count = await vscode.commands.executeCommand<number>(
      "gitea-vs-extension.__testRefreshDone",
    );
    assert.ok(count >= 1);
    const comments = await vscode.commands.executeCommand<ReviewCommentSnapshot[]>(
      "gitea-vs-extension.__testReviewCommentSnapshot",
    );
    assert.ok(
      comments.some((comment) => comment.body === expectedBody),
      `expected created review comment after fresh refresh in ${JSON.stringify(comments)}`,
    );
  });
});

type RepoSnapshot = {
  repos: {
    repo: { owner: string; name: string };
    pullRequestCount: number;
    runCount: number;
    branchContext?: { status: string; branchName?: string | null };
  }[];
};

type RunDetailsSnapshot = {
  runId: number | string;
  jobCount: number;
  artifactCount: number;
};

type ReviewCommentSnapshot = {
  body: string;
  path?: string;
  line?: number;
  author?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}
