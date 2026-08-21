import * as vscode from "vscode";
import type { Artifact, Job, PullRequest, RepoRef, Step, WorkflowRun } from "../gitea/models";
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
  | SectionNode
  | MessageNode
  | ErrorNode
  | ConfigRootNode
  | AddInstanceNode
  | InstanceNode
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
    public readonly runs: { repo: RepoRef; run: WorkflowRun }[],
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
    this.contextValue = buildRunContextValue(run);
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
      job.steps?.length
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = buildJobContextValue(job);
    this.description = buildJobDescription(job);
    this.iconPath = iconForStatus(job.status, job.conclusion);
    this.command = {
      command: "gitea-vs-extension.viewJobLogs",
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
      command: "gitea-vs-extension.viewJobLogs",
      title: "View Job Logs",
      arguments: [{ repo, run, job, step }],
    };
  }
}

export class ArtifactNode extends vscode.TreeItem {
  constructor(
    public readonly repo: RepoRef,
    public readonly runId: number | string,
    public readonly artifact: Artifact,
  ) {
    super(artifact.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaArtifact";
    this.description = formatBytes(artifact.sizeInBytes);
    this.iconPath = new vscode.ThemeIcon("package");
    this.command = {
      command: "gitea-vs-extension.openOrRevealArtifact",
      title: "Open",
      arguments: [this],
    };
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
    const labelSummary = labelNames.length > 0 ? labelNames.join(", ") : undefined;
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

export class SectionNode extends vscode.TreeItem {
  constructor(
    public readonly sectionType: "artifacts" | "errors",
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
    action?: "configureBaseUrl" | "setToken" | "switchBranchFilter",
  ) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaMessage";
    this.iconPath = new vscode.ThemeIcon(severity === "error" ? "warning" : "info");
    switch (action) {
      case "configureBaseUrl": {
        this.command = {
          command: "gitea-vs-extension.openBaseUrlSettings",
          title: "Configure base URL",
        };
        break;
      }
      case "setToken": {
        this.command = {
          command: "gitea-vs-extension.setToken",
          title: "Set token",
        };
        break;
      }
      case "switchBranchFilter": {
        this.command = {
          command: "gitea-vs-extension.switchBranchFilter",
          title: "Change branch filter",
        };
        break;
      }
      default: {
        break;
      }
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
    super("Gitea Instances", vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "giteaConfigRoot";
    this.iconPath = new vscode.ThemeIcon("settings-gear");
  }
}

export class AddInstanceNode extends vscode.TreeItem {
  constructor() {
    super("Add Gitea Instance", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaAddInstance";
    this.iconPath = new vscode.ThemeIcon("add");
    this.command = {
      command: "gitea-vs-extension.addInstance",
      title: "Add Gitea Instance",
    };
  }
}

export class InstanceNode extends vscode.TreeItem {
  constructor(
    public readonly baseUrl: string,
    hasToken: boolean,
  ) {
    super(baseUrl, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaInstance";
    this.description = hasToken ? "Token saved" : "Token missing";
    this.iconPath = new vscode.ThemeIcon(hasToken ? "pass" : "key");
    this.command = {
      command: "gitea-vs-extension.setToken",
      title: "Set token",
      arguments: [baseUrl],
    };
  }
}

export class ConfigActionNode extends vscode.TreeItem {
  constructor() {
    super("Test Connection", vscode.TreeItemCollapsibleState.None);
    this.contextValue = "giteaConfigAction";
    this.iconPath = new vscode.ThemeIcon("sync");
    this.command = {
      command: "gitea-vs-extension.testConnection",
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
    this.iconPath = new vscode.ThemeIcon("symbol-field");
    if (value) {
      this.tooltip = `${name}\nValue: ${value}`;
    }
  }
}

/**
 * Space-separated capability tokens matched with `viewItem =~ /…/` in `package.json`, so run-control
 * menu items only appear where the Gitea API would actually accept them.
 */
export function buildRunContextValue(run: WorkflowRun): string {
  const tokens = ["giteaRun"];
  if (run.status === "completed") {
    tokens.push("rerunnable");
    if (run.conclusion === "failure") {
      tokens.push("hasFailedJobs");
    }
  }
  return tokens.join(" ");
}

export function buildJobContextValue(job: Job): string {
  return job.status === "completed" ? "giteaJob rerunnable" : "giteaJob";
}

function buildRunLabel(run: WorkflowRun): string {
  const base = run.workflowName ?? run.displayTitle ?? run.name;
  const idPart = run.runNumber ?? run.id;
  return `${base} #${idPart}`;
}

function buildRunDescription(run: WorkflowRun): string | undefined {
  const duration = formatDuration(run.startedAt ?? run.createdAt, run.completedAt ?? run.updatedAt);
  const time = duration ?? formatRelativeTime(run.updatedAt ?? run.createdAt);
  return [time, run.event].filter(Boolean).join(" · ") || undefined;
}

function buildRunTooltip(run: WorkflowRun): string {
  const status = run.conclusion ?? run.status;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const parts = [status !== "unknown" && status ? status.toUpperCase() : "Status"];
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
