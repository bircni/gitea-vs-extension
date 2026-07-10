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
    baseUrl: getSetting(config, legacyConfig, "baseUrl", "").trim(),
    tlsInsecureSkipVerify: getSetting(config, legacyConfig, "tls.insecureSkipVerify", false),
    discoveryMode: getSetting<DiscoveryMode>(config, legacyConfig, "discovery.mode", "workspace"),
    runningRefreshSeconds: getSetting(config, legacyConfig, "refresh.runningIntervalSeconds", 15),
    idleRefreshSeconds: getSetting(config, legacyConfig, "refresh.idleIntervalSeconds", 60),
    maxRunsPerRepo: getSetting(config, legacyConfig, "maxRunsPerRepo", 20),
    maxJobsPerRun: getSetting(config, legacyConfig, "maxJobsPerRun", 50),
    debugLogging: getSetting(config, legacyConfig, "logging.debug", false),
    reviewCommentsEnabled: getSetting(config, legacyConfig, "reviewComments.enabled", true),
    jobLogsSaveToRepo: getSetting(config, legacyConfig, "jobLogs.saveToRepo", true),
    artifactsDownloadPath: getSetting(
      config,
      legacyConfig,
      "artifacts.downloadPath",
      ".tmp/gitea-artifacts/",
    ).trim(),
  };
}

/**
 * Prefer an explicitly configured modern setting. `get()` includes contributed defaults, so it
 * cannot distinguish an unset modern value from its default when reading legacy configuration.
 */
function getSetting<T>(
  config: vscode.WorkspaceConfiguration,
  legacyConfig: vscode.WorkspaceConfiguration,
  key: string,
  fallback: T,
): T {
  const inspected = config.inspect<T>(key);
  const explicitModernValue =
    inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
  return explicitModernValue ?? legacyConfig.get<T>(key) ?? fallback;
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
