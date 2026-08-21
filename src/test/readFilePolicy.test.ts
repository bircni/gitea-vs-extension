import * as vscode from "vscode";
import { isWorkspaceFileUri } from "../workflow/readFilePolicy";

const workspaceFolder = {
  uri: vscode.Uri.file("/workspace/project"),
} as vscode.WorkspaceFolder;

describe("isWorkspaceFileUri", () => {
  test("allows files in an open workspace folder", () => {
    expect(
      isWorkspaceFileUri(vscode.Uri.file("/workspace/project/.gitea/workflows/build.yml"), [
        workspaceFolder,
      ]),
    ).toBe(true);
  });

  test("rejects non-file URIs and files outside open workspace folders", () => {
    expect(isWorkspaceFileUri(vscode.Uri.parse("untitled:workflow.yml"), [workspaceFolder])).toBe(
      false,
    );
    expect(isWorkspaceFileUri(vscode.Uri.file("/workspace/secret.txt"), [workspaceFolder])).toBe(
      false,
    );
    expect(
      isWorkspaceFileUri(vscode.Uri.file("/workspace/projected/file.yml"), [workspaceFolder]),
    ).toBe(false);
  });

  test("rejects requests when there is no workspace", () => {
    expect(isWorkspaceFileUri(vscode.Uri.file("/workspace/project/workflow.yml"), undefined)).toBe(
      false,
    );
  });
});
