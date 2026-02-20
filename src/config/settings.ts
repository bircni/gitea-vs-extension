import * as vscode from "vscode";

export type DiscoveryMode = "workspace" | "allAccessible";

export type GiteaProfile = {
  id: string;
  name: string;
  baseUrl: string;
  tlsInsecureSkipVerify?: boolean;
};

export type ExtensionSettings = {
  profiles: GiteaProfile[];
  activeProfileId?: string;
  activeProfileName?: string;
  baseUrl: string;
  tlsInsecureSkipVerify: boolean;
  discoveryMode: DiscoveryMode;
  runningRefreshSeconds: number;
  idleRefreshSeconds: number;
  pauseWhenViewsHidden: boolean;
  actionsFilterBranch: string;
  actionsFilterStatus: string;
  actionsFilterEvent: string;
  actionsFilterSearch: string;
  maxRunsPerRepo: number;
  maxJobsPerRun: number;
  debugLogging: boolean;
  reviewCommentsEnabled: boolean;
  failedRunNotificationsEnabled: boolean;
};

export function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration("gitea-vs-extension");
  const legacyConfig = vscode.workspace.getConfiguration("bircni.gitea-vs-extension");
  const profiles = normalizeProfiles(config.get<unknown[]>("profiles"));
  const configuredActiveProfileId = (
    config.get<string>("activeProfileId") ??
    legacyConfig.get<string>("activeProfileId") ??
    ""
  ).trim();
  const activeProfile =
    profiles.find((profile) => profile.id === configuredActiveProfileId) ?? profiles.at(0);

  const legacyBaseUrl = (
    config.get<string>("baseUrl") ??
    legacyConfig.get<string>("baseUrl") ??
    ""
  ).trim();
  const baseUrl = (activeProfile?.baseUrl ?? legacyBaseUrl).trim();
  const tlsInsecureSkipVerify =
    activeProfile?.tlsInsecureSkipVerify ??
    config.get<boolean>("tls.insecureSkipVerify") ??
    legacyConfig.get<boolean>("tls.insecureSkipVerify") ??
    false;

  return {
    profiles,
    activeProfileId: activeProfile?.id ?? (configuredActiveProfileId || undefined),
    activeProfileName: activeProfile?.name,
    baseUrl,
    tlsInsecureSkipVerify,
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
    actionsFilterBranch:
      config.get<string>("actions.filters.branch") ??
      legacyConfig.get<string>("actions.filters.branch") ??
      "",
    actionsFilterStatus:
      config.get<string>("actions.filters.status") ??
      legacyConfig.get<string>("actions.filters.status") ??
      "",
    actionsFilterEvent:
      config.get<string>("actions.filters.event") ??
      legacyConfig.get<string>("actions.filters.event") ??
      "",
    actionsFilterSearch:
      config.get<string>("actions.filters.search") ??
      legacyConfig.get<string>("actions.filters.search") ??
      "",
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
    failedRunNotificationsEnabled:
      config.get<boolean>("notifications.failedRuns.enabled") ??
      legacyConfig.get<boolean>("notifications.failedRuns.enabled") ??
      false,
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

function normalizeProfiles(value: unknown): GiteaProfile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const profiles: GiteaProfile[] = [];
  for (const raw of value) {
    const entry = raw as Record<string, unknown>;
    const id = asString(entry.id)?.trim();
    const name = asString(entry.name)?.trim();
    const baseUrl = asString(entry.baseUrl)?.trim();
    const tlsInsecureSkipVerify = asBoolean(entry.tlsInsecureSkipVerify);
    if (!id || !name || !baseUrl) {
      continue;
    }
    profiles.push({
      id,
      name,
      baseUrl,
      tlsInsecureSkipVerify,
    });
  }
  return profiles;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}
