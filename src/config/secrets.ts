import type * as vscode from "vscode";

export const TOKEN_KEY = "bircni.gitea-vs-extension.pat";

export async function getToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  const token = await secrets.get(TOKEN_KEY);
  return token?.trim() || undefined;
}

export async function setToken(secrets: vscode.SecretStorage, token: string): Promise<void> {
  await secrets.store(TOKEN_KEY, token);
}

export async function clearToken(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(TOKEN_KEY);
}
