/**
 * Gives our workflow language to files under `.github/workflows`.
 *
 * `contributes.languages` only claims `.gitea/workflows` statically, because claiming
 * `.github/workflows` there would collide with the GitHub Actions extension for anyone who has
 * both installed. Gitea reads both folders, so we assign the language at runtime instead, where we
 * can see whether that extension is present.
 */
import * as vscode from "vscode";
import {
  isGithubWorkflowPath,
  LANGUAGE_ID,
  shouldClaimGithubFolder,
  type GithubFolderLanguage,
} from "./documentSelector";

const GITHUB_ACTIONS_EXTENSION = "github.vscode-github-actions";

export type DocumentTrackerDeps = {
  getMode: () => GithubFolderLanguage;
  isGithubExtensionInstalled: () => boolean;
  setLanguage: (document: vscode.TextDocument) => Thenable<unknown>;
};

export function claimGithubWorkflowDocument(
  deps: DocumentTrackerDeps,
  document: vscode.TextDocument,
): boolean {
  if (document.languageId === LANGUAGE_ID || document.uri.scheme !== "file") {
    return false;
  }
  if (!isGithubWorkflowPath(document.uri.fsPath)) {
    return false;
  }
  if (!shouldClaimGithubFolder(deps.getMode(), deps.isGithubExtensionInstalled())) {
    return false;
  }
  void deps.setLanguage(document);
  return true;
}

export function registerWorkflowDocumentTracker(
  getMode: () => GithubFolderLanguage,
): vscode.Disposable {
  const deps: DocumentTrackerDeps = {
    getMode,
    isGithubExtensionInstalled: () =>
      vscode.extensions.getExtension(GITHUB_ACTIONS_EXTENSION) !== undefined,
    setLanguage: (document) => vscode.languages.setTextDocumentLanguage(document, LANGUAGE_ID),
  };

  for (const document of vscode.workspace.textDocuments) {
    claimGithubWorkflowDocument(deps, document);
  }

  return vscode.workspace.onDidOpenTextDocument((document) => {
    claimGithubWorkflowDocument(deps, document);
  });
}
