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
};

export function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration("bircni.gitea-vs-extension");
  return {
    baseUrl: (config.get<string>("baseUrl") ?? "").trim(),
    tlsInsecureSkipVerify: config.get<boolean>("tls.insecureSkipVerify") ?? false,
    discoveryMode: config.get<DiscoveryMode>("discovery.mode") ?? "workspace",
    runningRefreshSeconds: config.get<number>("refresh.runningIntervalSeconds") ?? 15,
    idleRefreshSeconds: config.get<number>("refresh.idleIntervalSeconds") ?? 60,
    maxRunsPerRepo: config.get<number>("maxRunsPerRepo") ?? 20,
    maxJobsPerRun: config.get<number>("maxJobsPerRun") ?? 50,
    debugLogging: config.get<boolean>("logging.debug") ?? false,
    reviewCommentsEnabled: config.get<boolean>("reviewComments.enabled") ?? true,
  };
}

export function onSettingsChange(handler: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("bircni.gitea-vs-extension")) {
      handler();
    }
  });
}
