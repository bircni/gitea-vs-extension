import * as vscode from "vscode";

export type DiscoveryMode = "workspace" | "allAccessible";

export type ExtensionSettings = {
  baseUrl: string;
  tlsInsecureSkipVerify: boolean;
  discoveryMode: DiscoveryMode;
  runningRefreshSeconds: number;
  idleRefreshSeconds: number;
  pauseWhenViewsHidden: boolean;
  maxRunsPerRepo: number;
  maxJobsPerRun: number;
  debugLogging: boolean;
  reviewCommentsEnabled: boolean;
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
    pauseWhenViewsHidden:
      config.get<boolean>("refresh.pauseWhenViewsHidden") ??
      legacyConfig.get<boolean>("refresh.pauseWhenViewsHidden") ??
      true,
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
  };
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
