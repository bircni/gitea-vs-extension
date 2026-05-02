import * as vscode from "vscode";
import type { RefreshController } from "../controllers/refreshController";
import type { ReviewCommentsController } from "../controllers/reviewCommentsController";
import type { RepoStateStore } from "./cache";

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
      const line = Number(process.env.GITEA_EXTENSION_TEST_COMMENT_LINE ?? "1");
      if (!filePath) {
        throw new Error("GITEA_EXTENSION_TEST_COMMENT_FILE is required");
      }
      if (!Number.isInteger(line) || line < 1) {
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
  ];
}
