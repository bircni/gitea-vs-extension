import type * as vscode from "vscode";

export const TOKEN_KEY = "bircni.gitea-vs-extension.pat";

function tokenKey(profileId?: string): string {
  if (!profileId) {
    return TOKEN_KEY;
  }
  return `${TOKEN_KEY}:${profileId}`;
}

export async function getToken(
  secrets: vscode.SecretStorage,
  profileId?: string,
): Promise<string | undefined> {
  const token = await secrets.get(tokenKey(profileId));
  return token?.trim() ?? undefined;
}

export async function setToken(
  secrets: vscode.SecretStorage,
  token: string,
  profileId?: string,
): Promise<void> {
  await secrets.store(tokenKey(profileId), token);
}

export async function clearToken(secrets: vscode.SecretStorage, profileId?: string): Promise<void> {
  await secrets.delete(tokenKey(profileId));
}
