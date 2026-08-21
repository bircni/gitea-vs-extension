import path from "node:path";
import type * as vscode from "vscode";

/**
 * The language server may ask the client to read local reusable workflows.
 * It must not turn an untrusted workflow document into a general file-read
 * capability outside the folders the user opened in the workspace.
 */
export function isWorkspaceFileUri(
  uri: vscode.Uri,
  workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
): boolean {
  if (uri.scheme !== "file") {
    return false;
  }

  const filePath = path.resolve(uri.fsPath);
  return (workspaceFolders ?? []).some((folder) => {
    const folderPath = path.resolve(folder.uri.fsPath);
    return filePath === folderPath || filePath.startsWith(`${folderPath}${path.sep}`);
  });
}
