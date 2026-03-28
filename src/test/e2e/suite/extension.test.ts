import * as assert from "assert";
import * as vscode from "vscode";

suite("gitea-vs-extension E2E (mock)", () => {
  test("M1: extension is present and activates", async () => {
    const ext = vscode.extensions.getExtension("bircni.gitea-vs-extension");
    assert.ok(ext, "extension bircni.gitea-vs-extension not found");
    await ext.activate();
  });

  test("M2: Test Connection reaches mock Gitea", async () => {
    await vscode.commands.executeCommand("gitea-vs-extension.testConnection");
  });

  test("M3: refresh discovers mock repo", async () => {
    const count = await vscode.commands.executeCommand<number>(
      "gitea-vs-extension.__testRefreshDone",
    );
    assert.ok(
      typeof count === "number" && count >= 1,
      `expected repo count >= 1, got ${String(count)}`,
    );
  });
});
