import type * as vscode from "vscode";
import { resolveExtensionTestPat } from "../util/extensionTestMode";

export const TOKEN_KEY = "bircni.gitea-vs-extension.pat";

/** SecretStorage token, or `GITEA_EXTENSION_TEST_TOKEN` when `EXTENSION_TEST_MODE=1`. */
export async function getEffectiveToken(
  secrets: vscode.SecretStorage,
): Promise<string | undefined> {
  const testPat = resolveExtensionTestPat();
  if (testPat) {
    return testPat;
  }
  return getToken(secrets);
}

export async function getToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  const token = await secrets.get(TOKEN_KEY);
  return token?.trim() ?? undefined;
}

export async function setToken(secrets: vscode.SecretStorage, token: string): Promise<void> {
  await secrets.store(TOKEN_KEY, token);
}

export async function clearToken(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(TOKEN_KEY);
}
