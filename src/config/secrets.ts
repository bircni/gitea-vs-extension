import type * as vscode from "vscode";
import { createHash } from "node:crypto";
import { resolveExtensionTestPat } from "../util/extensionTestMode";

export const TOKEN_KEY = "bircni.gitea-vs-extension.pat";

export function tokenKeyForBaseUrl(baseUrl: string): string {
  const normalized = new URL(baseUrl).origin.toLowerCase();
  return `${TOKEN_KEY}.${createHash("sha256").update(normalized).digest("hex")}`;
}

/** SecretStorage token, or `GITEA_EXTENSION_TEST_TOKEN` when `EXTENSION_TEST_MODE=1`. */
export async function getEffectiveToken(
  secrets: vscode.SecretStorage,
  baseUrl?: string,
  fallbackToLegacy = false,
): Promise<string | undefined> {
  const testPat = resolveExtensionTestPat();
  if (testPat) {
    return testPat;
  }
  return getToken(secrets, baseUrl, fallbackToLegacy);
}

export async function getToken(
  secrets: vscode.SecretStorage,
  baseUrl?: string,
  fallbackToLegacy = false,
): Promise<string | undefined> {
  const token = await secrets.get(baseUrl ? tokenKeyForBaseUrl(baseUrl) : TOKEN_KEY);
  if (!token && baseUrl && fallbackToLegacy) {
    const legacyToken = await secrets.get(TOKEN_KEY);
    return legacyToken?.trim() ?? undefined;
  }
  return token?.trim() ?? undefined;
}

export async function setToken(
  secrets: vscode.SecretStorage,
  token: string,
  baseUrl?: string,
): Promise<void> {
  await secrets.store(baseUrl ? tokenKeyForBaseUrl(baseUrl) : TOKEN_KEY, token);
}

export async function clearToken(secrets: vscode.SecretStorage, baseUrl?: string): Promise<void> {
  await secrets.delete(baseUrl ? tokenKeyForBaseUrl(baseUrl) : TOKEN_KEY);
}
