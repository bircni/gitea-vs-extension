import * as vscode from "vscode";
import type { RefreshController } from "../controllers/refreshController";
import type { RepoStateStore } from "./cache";

/**
 * Internal commands for @vscode/test-electron only (EXTENSION_TEST_MODE=1).
 */
export function registerExtensionTestCommands(
  context: vscode.ExtensionContext,
  store: RepoStateStore,
  refreshController: RefreshController,
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
  ];
}
