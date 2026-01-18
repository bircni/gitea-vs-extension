import * as vscode from "vscode";
import type {
  Artifact,
  Job,
  NotificationThread,
  PullRequest,
  RepoRef,
  Step,
  WorkflowRun,
} from "../gitea/models";
import { iconForStatus } from "./icons";
import { formatDuration, formatRelativeTime } from "../util/time";

export type TreeNode =
  | RepoNode
  | WorkflowGroupNode
  | RunNode
  | JobNode
  | StepNode
  | ArtifactNode
  | PullRequestNode
  | NotificationNode
  | SectionNode
  | MessageNode
  | ErrorNode
  | ConfigRootNode
  | TokenNode
  | ConfigActionNode
  | SecretsRootNode
  | SecretNode
  | VariablesRootNode
  | VariableNode;

export class RepoNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    expanded?: boolean,
    description?: string,
  ) {
    super(
      `${repo.owner}/${repo.name}`,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.contextValue = "giteaRepo";
    this.description = description;
  }
}

export class WorkflowGroupNode extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly runs: Array<{ repo: RepoRef; run: WorkflowRun }>,
    expanded?: boolean,
  ) {
    super(
      name,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.contextValue = "giteaWorkflowGroup";
    this.description = `${runs.length} run${runs.length === 1 ? "" : "s"}`;
    this.iconPath = new vscode.ThemeIcon("git-merge");
  }
}

export class RunNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly run: WorkflowRun,
    expanded?: boolean,
  ) {
    super(
      buildRunLabel(run),
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed,
    );
    this.contextValue = "giteaRun";
    this.description = buildRunDescription(run);
    this.iconPath = iconForStatus(run.status, run.conclusion);
    this.tooltip = buildRunTooltip(run);
    if (run.htmlUrl) {
      this.resourceUri = vscode.Uri.parse(run.htmlUrl);
    }
  }
}

export class JobNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly run: WorkflowRun,
    public readonly job: Job,
  ) {
    super(
      job.name,
      job.steps && job.steps.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = "giteaJob";
    this.description = buildJobDescription(job);
    this.iconPath = iconForStatus(job.status, job.conclusion);
    this.command = {
      command: "bircni.gitea-vs-extension.viewJobLogs",
      title: "View Job Logs",
      arguments: [{ repo, run, job }],
    };
  }
}

export class StepNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly run: WorkflowRun,
    public readonly job: Job,
    public readonly step: Step,
  ) {
    super(step.name ?? "Step", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaStep";
    this.description = buildStepDescription(step);
    this.iconPath = iconForStatus(step.status, step.conclusion);
    this.command = {
      command: "bircni.gitea-vs-extension.viewJobLogs",
      title: "View Job Logs",
      arguments: [{ repo, run, job, step }],
    };
  }
}

export class ArtifactNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly artifact: Artifact,
  ) {
    super(artifact.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaArtifact";
    this.description = formatBytes(artifact.sizeInBytes);
    this.iconPath = new vscode.ThemeIcon("package");
    if (artifact.downloadUrl) {
      this.tooltip = artifact.downloadUrl;
    }
  }
}

export class PullRequestNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly pullRequest: PullRequest,
  ) {
    super(`#${pullRequest.number} ${pullRequest.title}`, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaPullRequest";
    const updated = formatRelativeTime(pullRequest.updatedAt);
    const labelNames = (pullRequest.labels ?? []).map((label) => label.name).filter(Boolean);
    const labelSummary = labelNames.length ? labelNames.join(", ") : undefined;
    if (pullRequest.author && updated) {
      this.description = labelSummary
        ? `${pullRequest.state} by ${pullRequest.author} · ${updated} · ${labelSummary}`
        : `${pullRequest.state} by ${pullRequest.author} · ${updated}`;
    } else if (pullRequest.author) {
      this.description = labelSummary
        ? `${pullRequest.state} by ${pullRequest.author} · ${labelSummary}`
        : `${pullRequest.state} by ${pullRequest.author}`;
    } else if (updated) {
      this.description = labelSummary
        ? `${pullRequest.state} · ${updated} · ${labelSummary}`
        : `${pullRequest.state} · ${updated}`;
    } else {
      this.description = labelSummary
        ? `${pullRequest.state} · ${labelSummary}`
        : pullRequest.state;
    }
    this.iconPath = new vscode.ThemeIcon("git-pull-request");
    if (pullRequest.htmlUrl) {
      const tooltipParts = [pullRequest.htmlUrl];
      if (pullRequest.author) {
        tooltipParts.push(`Author: ${pullRequest.author}`);
      }
      if (pullRequest.updatedAt) {
        tooltipParts.push(`Updated: ${pullRequest.updatedAt}`);
      }
      if (pullRequest.labels?.length) {
        const labels = pullRequest.labels
          .map((label) => (label.color ? `${label.name} (${label.color})` : label.name))
          .join(", ");
        tooltipParts.push(`Labels: ${labels}`);
      }
      this.tooltip = tooltipParts.join("\n");
    }
  }
}

export class NotificationNode extends vscode.TreeItem {
  constructor(public readonly notification: NotificationThread) {
    super(notification.title ?? "Notification", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaNotification";
    const parts = [];
    if (notification.repository) {
      parts.push(notification.repository);
    }
    if (notification.type) {
      parts.push(notification.type);
    }
    if (notification.unread) {
      parts.push("unread");
    }
    if (notification.pinned) {
      parts.push("pinned");
    }
    this.description = parts.length ? parts.join(" · ") : undefined;
    this.iconPath = notification.pinned
      ? new vscode.ThemeIcon("pin")
      : new vscode.ThemeIcon(
          "bell",
          notification.unread ? new vscode.ThemeColor("charts.yellow") : undefined,
        );
    if (notification.subjectHtmlUrl) {
      this.tooltip = notification.subjectHtmlUrl;
    }
  }
}

export class SectionNode extends vscode.TreeItem {
  constructor(
    public readonly sectionType: "pullRequests" | "artifacts" | "errors",
    public readonly label: string,
    public readonly repo: RepoRef,
    public readonly runId?: number | string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "giteaSection";
  }
}

export class MessageNode extends vscode.TreeItem {
  constructor(
    message: string,
    severity: "info" | "error" = "info",
    action?: "configureBaseUrl" | "setToken",
  ) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaMessage";
    this.iconPath = new vscode.ThemeIcon(severity === "error" ? "warning" : "info");
    if (action === "configureBaseUrl") {
      this.command = {
        command: "bircni.gitea-vs-extension.openBaseUrlSettings",
        title: "Configure base URL",
      };
    }
    if (action === "setToken") {
      this.command = {
        command: "bircni.gitea-vs-extension.setToken",
        title: "Set token",
      };
    }
  }
}

export class ErrorNode extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaError";
    this.iconPath = new vscode.ThemeIcon("warning");
  }
}

export class ConfigRootNode extends vscode.TreeItem {
  constructor() {
    super("Gitea Config", vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "giteaConfigRoot";
    this.iconPath = new vscode.ThemeIcon("settings-gear");
  }
}

export class TokenNode extends vscode.TreeItem {
  constructor(public readonly hasToken: boolean) {
    super("Token", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaToken";
    this.description = hasToken ? "V" : "?";
    this.iconPath = new vscode.ThemeIcon("key");
  }
}

export class ConfigActionNode extends vscode.TreeItem {
  constructor() {
    super("Test Connection", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaConfigAction";
    this.iconPath = new vscode.ThemeIcon("sync");
    this.command = {
      command: "bircni.gitea-vs-extension.testConnection",
      title: "Test Connection",
    };
  }
}

export class SecretsRootNode extends vscode.TreeItem {
  constructor(public readonly repo: RepoRef) {
    super("Secrets", vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "giteaSecretsRoot";
    this.iconPath = new vscode.ThemeIcon("lock");
  }
}

export class SecretNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly name: string,
    public readonly description?: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaSecret";
    this.description = description;
    this.iconPath = new vscode.ThemeIcon("lock");
  }
}

export class VariablesRootNode extends vscode.TreeItem {
  constructor(public readonly repo: RepoRef) {
    super("Variables", vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "giteaVariablesRoot";
    this.iconPath = new vscode.ThemeIcon("symbol-field");
  }
}

export class VariableNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly name: string,
    public readonly description?: string,
    public readonly value?: string,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaVariable";
    this.description = description;
    this.iconPath = new vscode.ThemeIcon("symbol-field");
    if (value) {
      this.tooltip = `${name}\nValue: ${value}`;
    }
  }
}

function buildRunLabel(run: WorkflowRun): string {
  const base = run.workflowName ?? run.displayTitle ?? run.name;
  const idPart = run.runNumber ?? run.id;
  return `${base} #${idPart}`;
}

function buildRunDescription(run: WorkflowRun): string | undefined {
  const duration = formatDuration(run.startedAt ?? run.createdAt, run.completedAt ?? run.updatedAt);
  if (duration) {
    return duration;
  }
  return formatRelativeTime(run.updatedAt ?? run.createdAt);
}

function buildRunTooltip(run: WorkflowRun): string {
  const status = run.conclusion ?? run.status;
  const parts = [status ? status.toUpperCase() : "Status"];
  if (run.actor) {
    parts.push(`Actor: ${run.actor}`);
  }
  if (run.event) {
    parts.push(`Event: ${run.event}`);
  }
  if (run.commitMessage) {
    parts.push(`Commit: ${run.commitMessage}`);
  }
  return parts.join("\n");
}

function buildJobDescription(job: Job): string | undefined {
  return formatDuration(job.startedAt, job.completedAt);
}

function buildStepDescription(step: Step): string | undefined {
  return formatDuration(step.startedAt, step.completedAt);
}

function formatBytes(size?: number): string | undefined {
  if (!size || Number.isNaN(size)) {
    return undefined;
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
