import * as vscode from "vscode";

export type DiscoveryMode = "workspace" | "allAccessible";

export type ExtensionSettings = {
  baseUrl: string;
  tlsInsecureSkipVerify: boolean;
  discoveryMode: DiscoveryMode;
  runningRefreshSeconds: number;
  idleRefreshSeconds: number;
  maxRunsPerRepo: number;
  maxJobsPerRun: number;
  debugLogging: boolean;
  reviewCommentsEnabled: boolean;
  jobLogsSaveToRepo: boolean;
  artifactsDownloadPath: string;
};

export function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration("gitea-vs-extension");
  const legacyConfig = vscode.workspace.getConfiguration("bircni.gitea-vs-extension");
  return {
    baseUrl: (config.get<string>("baseUrl") ?? legacyConfig.get<string>("baseUrl") ?? "").trim(),
    tlsInsecureSkipVerify:
      config.get<boolean>("tls.insecureSkipVerify") ??
      legacyConfig.get<boolean>("tls.insecureSkipVerify") ??
      false,
    discoveryMode:
      config.get<DiscoveryMode>("discovery.mode") ??
      legacyConfig.get<DiscoveryMode>("discovery.mode") ??
      "workspace",
    runningRefreshSeconds:
      config.get<number>("refresh.runningIntervalSeconds") ??
      legacyConfig.get<number>("refresh.runningIntervalSeconds") ??
      15,
    idleRefreshSeconds:
      config.get<number>("refresh.idleIntervalSeconds") ??
      legacyConfig.get<number>("refresh.idleIntervalSeconds") ??
      60,
    maxRunsPerRepo:
      config.get<number>("maxRunsPerRepo") ?? legacyConfig.get<number>("maxRunsPerRepo") ?? 20,
    maxJobsPerRun:
      config.get<number>("maxJobsPerRun") ?? legacyConfig.get<number>("maxJobsPerRun") ?? 50,
    debugLogging:
      config.get<boolean>("logging.debug") ?? legacyConfig.get<boolean>("logging.debug") ?? false,
    reviewCommentsEnabled:
      config.get<boolean>("reviewComments.enabled") ??
      legacyConfig.get<boolean>("reviewComments.enabled") ??
      true,
    jobLogsSaveToRepo:
      config.get<boolean>("jobLogs.saveToRepo") ??
      legacyConfig.get<boolean>("jobLogs.saveToRepo") ??
      true,
    artifactsDownloadPath: (
      config.get<string>("artifacts.downloadPath") ??
      legacyConfig.get<string>("artifacts.downloadPath") ??
      ".tmp/gitea-artifacts/"
    ).trim(),
  };
}

/**
 * Resolves the base directory for downloading artifacts.
 * Default: `.tmp/gitea-artifacts/` relative to the first workspace folder.
 * If no workspace folder, falls back to a temp-like path (user home + .tmp/gitea-artifacts).
 * Absolute paths are returned as-is (normalized).
 */
export function getArtifactDownloadBaseDir(): string {
  const settings = getSettings();
  const raw = settings.artifactsDownloadPath;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const firstFolder = workspaceFolders?.[0]?.uri.fsPath;

  if (!raw) {
    return firstFolder
      ? `${firstFolder.replaceAll("\\", "/")}/.tmp/gitea-artifacts`
      : `${process.env.HOME ?? process.env.USERPROFILE ?? "/tmp"}/.tmp/gitea-artifacts`;
  }

  const normalized = raw.replaceAll("\\", "/").trim();
  const isAbsolute =
    normalized.startsWith("/") || (normalized.length >= 2 && normalized[1] === ":"); // Windows drive

  if (isAbsolute) {
    return normalized;
  }
  const base = firstFolder
    ? firstFolder.replaceAll("\\", "/")
    : (process.env.HOME ?? process.env.USERPROFILE ?? "/tmp");
  return normalized.startsWith("/") ? `${base}${normalized}` : `${base}/${normalized}`;
}

export function onSettingsChange(handler: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (
      event.affectsConfiguration("gitea-vs-extension") ||
      event.affectsConfiguration("bircni.gitea-vs-extension")
    ) {
      handler();
    }
  });
}
