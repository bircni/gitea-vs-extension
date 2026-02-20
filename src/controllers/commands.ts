import * as fs from "fs";
import * as vscode from "vscode";
import { getSettings } from "../config/settings";
import { clearToken, getToken, setToken } from "../config/secrets";
import type { GiteaApi } from "../gitea/api";
import type { ActionWorkflow, Job, PullRequest, RepoRef, WorkflowRun } from "../gitea/models";
import type { RepoStateStore } from "../util/cache";
import type { ActionsTreeProvider } from "../views/actionsTreeProvider";
import {
  ArtifactNode,
  JobNode,
  PullRequestNode,
  RepoNode,
  RunNode,
  SecretNode,
  SecretsRootNode,
  SectionNode,
  StepNode,
  VariableNode,
  VariablesRootNode,
} from "../views/nodes";
import type { RefreshController } from "./refreshController";
import type { SettingsTreeProvider } from "../views/settingsTreeProvider";

export class CommandsController {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly api: GiteaApi,
    private readonly refreshController: RefreshController,
    private readonly store: RepoStateStore,
    private readonly treeProvider: ActionsTreeProvider,
    private readonly settingsProvider: SettingsTreeProvider,
  ) {}

  register(): vscode.Disposable[] {
    return [
      vscode.commands.registerCommand("gitea-vs-extension.setToken", () => this.handleSetToken()),
      vscode.commands.registerCommand("gitea-vs-extension.clearToken", () =>
        this.handleClearToken(),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.testConnection", () =>
        this.handleTestConnection(),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.refresh", () => this.handleRefresh()),
      vscode.commands.registerCommand("gitea-vs-extension.refreshRepo", (arg) =>
        this.handleRefreshRepo(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.viewJobLogs", (arg) =>
        this.handleViewJobLogs(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.openLatestFailedJobLogs", (arg) =>
        this.handleOpenLatestFailedJobLogs(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.openInBrowser", (arg) =>
        this.handleOpenInBrowser(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.copyUrl", (arg) =>
        this.handleCopyUrl(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.refreshSecrets", (arg) =>
        this.handleRefreshSecrets(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.refreshVariables", (arg) =>
        this.handleRefreshVariables(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.createSecret", (arg) =>
        this.handleCreateSecret(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.updateSecret", (arg) =>
        this.handleUpdateSecret(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.deleteSecret", (arg) =>
        this.handleDeleteSecret(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.createVariable", (arg) =>
        this.handleCreateVariable(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.updateVariable", (arg) =>
        this.handleUpdateVariable(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.deleteVariable", (arg) =>
        this.handleDeleteVariable(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.openBaseUrlSettings", () =>
        this.handleOpenBaseUrlSettings(),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.exportDiagnostics", () =>
        this.handleExportDiagnostics(),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.listWorkflows", (arg) =>
        this.handleListWorkflows(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.dispatchWorkflow", (arg) =>
        this.handleDispatchWorkflow(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.enableWorkflow", (arg) =>
        this.handleEnableWorkflow(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.disableWorkflow", (arg) =>
        this.handleDisableWorkflow(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.deleteRun", (arg) =>
        this.handleDeleteRun(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.downloadArtifact", (arg) =>
        this.handleDownloadArtifact(arg),
      ),
    ];
  }

  private async handleSetToken(): Promise<void> {
    const token = await vscode.window.showInputBox({
      title: "Gitea Personal Access Token",
      prompt: "Enter your Gitea PAT",
      password: true,
      ignoreFocusOut: true,
    });

    if (!token) {
      return;
    }

    await setToken(this.context.secrets, token.trim());
    this.settingsProvider.setTokenStatus(true);
    void this.refreshController.refreshAll();
    vscode.window.showInformationMessage("gitea-vs-extension token saved.");
  }

  private async handleClearToken(): Promise<void> {
    await clearToken(this.context.secrets);
    this.settingsProvider.setTokenStatus(false);
    void this.refreshController.refreshAll();
    vscode.window.showInformationMessage("gitea-vs-extension token cleared.");
  }

  private async handleTestConnection(): Promise<void> {
    const settings = getSettings();
    if (!settings.baseUrl) {
      vscode.window.showWarningMessage("Set gitea-vs-extension.baseUrl before testing connection.");
      return;
    }

    const token = await getToken(this.context.secrets);
    if (!token) {
      vscode.window.showWarningMessage("Set a token before testing connection.");
      return;
    }

    try {
      const version = await this.api.testConnection();
      vscode.window.showInformationMessage(`Gitea connection OK (${version}).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      vscode.window.showWarningMessage(message);
    }
  }

  private handleRefresh(): void {
    void this.refreshController.refreshAll();
  }

  private handleRefreshRepo(arg: unknown): void {
    const repo = extractRepo(arg);
    if (!repo) {
      return;
    }
    const settings = getSettings();
    void this.refreshController.refreshRepo(repo, settings.maxRunsPerRepo);
  }

  private async handleViewJobLogs(arg: unknown): Promise<void> {
    const payload = normalizeLogArg(arg);
    if (!payload) {
      vscode.window.showWarningMessage("Job not found.");
      return;
    }

    try {
      const content = await this.api.getJobLogs(payload.repo, payload.job.id);
      const doc = await vscode.workspace.openTextDocument({
        content,
        language: "log",
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load logs.";
      vscode.window.showWarningMessage(message);
    }
  }

  private async handleOpenLatestFailedJobLogs(arg: unknown): Promise<void> {
    const runPayload = normalizeRunArg(arg);
    if (!runPayload) {
      vscode.window.showWarningMessage("Run not found.");
      return;
    }

    await this.ensureRunDetails(runPayload.repo, runPayload.run);
    const entry = this.store.getEntry(runPayload.repo);
    const jobs = entry?.jobsByRun.get(String(runPayload.run.id)) ?? [];
    const failedJob = jobs.find((job) => job.conclusion === "failure");
    if (!failedJob) {
      vscode.window.showInformationMessage("No failed jobs found for this run.");
      return;
    }

    await this.handleViewJobLogs({ repo: runPayload.repo, run: runPayload.run, job: failedJob });
  }

  private async handleOpenInBrowser(arg: unknown): Promise<void> {
    const url = resolveOpenUrl(arg, getSettings().baseUrl);
    if (!url) {
      vscode.window.showWarningMessage("No URL available for this item.");
      return;
    }

    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private async handleCopyUrl(arg: unknown): Promise<void> {
    const url = resolveOpenUrl(arg, getSettings().baseUrl);
    if (!url) {
      vscode.window.showWarningMessage("No URL available for this item.");
      return;
    }
    await vscode.env.clipboard.writeText(url);
    vscode.window.showInformationMessage("URL copied to clipboard.");
  }

  private async handleRefreshSecrets(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    if (!repo) {
      return;
    }
    this.settingsProvider.setSecretsLoading();
    try {
      const secrets = await this.api.listSecrets(repo);
      this.settingsProvider.setSecrets(secrets);
    } catch (error) {
      this.settingsProvider.setSecretsError(
        error instanceof Error ? error.message : "Failed to load secrets.",
      );
    }
  }

  private async handleRefreshVariables(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    if (!repo) {
      return;
    }
    this.settingsProvider.setVariablesLoading();
    try {
      const variables = await this.api.listVariables(repo);
      this.settingsProvider.setVariables(variables);
    } catch (error) {
      this.settingsProvider.setVariablesError(
        error instanceof Error ? error.message : "Failed to load variables.",
      );
    }
  }

  private async handleCreateSecret(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    if (!repo) {
      return;
    }
    const name = await vscode.window.showInputBox({
      title: "Secret name",
      prompt: "Enter secret name",
    });
    if (!name) {
      return;
    }
    const value = await vscode.window.showInputBox({
      title: "Secret value",
      prompt: "Enter secret value",
      password: true,
    });
    if (!value) {
      return;
    }
    const description = await vscode.window.showInputBox({
      title: "Secret description",
      prompt: "Optional description",
    });
    await this.api.createOrUpdateSecret(repo, name, value, description);
    await this.handleRefreshSecrets(repo);
  }

  private async handleUpdateSecret(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    const secret = arg instanceof SecretNode ? arg : undefined;
    if (!repo || !secret) {
      return;
    }
    const value = await vscode.window.showInputBox({
      title: `Update secret ${secret.name}`,
      prompt: "Enter new secret value",
      password: true,
    });
    if (!value) {
      return;
    }
    const description = await vscode.window.showInputBox({
      title: "Secret description",
      prompt: "Optional description",
      value: secret.description,
    });
    await this.api.createOrUpdateSecret(repo, secret.name, value, description);
    await this.handleRefreshSecrets(repo);
  }

  private async handleDeleteSecret(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    const secret = arg instanceof SecretNode ? arg : undefined;
    if (!repo || !secret) {
      return;
    }
    const confirmed = await vscode.window.showWarningMessage(
      `Delete secret ${secret.name}?`,
      { modal: true },
      "Delete",
    );
    if (confirmed !== "Delete") {
      return;
    }
    await this.api.deleteSecret(repo, secret.name);
    await this.handleRefreshSecrets(repo);
  }

  private async handleCreateVariable(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    if (!repo) {
      return;
    }
    const name = await vscode.window.showInputBox({
      title: "Variable name",
      prompt: "Enter variable name",
    });
    if (!name) {
      return;
    }
    const value = await vscode.window.showInputBox({
      title: "Variable value",
      prompt: "Enter variable value",
    });
    if (!value) {
      return;
    }
    const description = await vscode.window.showInputBox({
      title: "Variable description",
      prompt: "Optional description",
    });
    await this.api.createVariable(repo, name, value, description);
    await this.handleRefreshVariables(repo);
  }

  private async handleUpdateVariable(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    const variable = arg instanceof VariableNode ? arg : undefined;
    if (!repo || !variable) {
      return;
    }
    const value = await vscode.window.showInputBox({
      title: `Update variable ${variable.name}`,
      prompt: "Enter new variable value",
      value: variable.value,
    });
    if (!value) {
      return;
    }
    const description = await vscode.window.showInputBox({
      title: "Variable description",
      prompt: "Optional description",
      value: variable.description,
    });
    await this.api.updateVariable(repo, variable.name, value, description);
    await this.handleRefreshVariables(repo);
  }

  private async handleDeleteVariable(arg: unknown): Promise<void> {
    const repo = extractRepo(arg) ?? this.settingsProvider.getCurrentRepo();
    const variable = arg instanceof VariableNode ? arg : undefined;
    if (!repo || !variable) {
      return;
    }
    const confirmed = await vscode.window.showWarningMessage(
      `Delete variable ${variable.name}?`,
      { modal: true },
      "Delete",
    );
    if (confirmed !== "Delete") {
      return;
    }
    await this.api.deleteVariable(repo, variable.name);
    await this.handleRefreshVariables(repo);
  }

  private async handleOpenBaseUrlSettings(): Promise<void> {
    await vscode.commands.executeCommand("workbench.action.openSettings", "@gitea-vs-extension");
  }

  private async handleExportDiagnostics(): Promise<void> {
    const settings = getSettings();
    const capabilities = await this.api.getCapabilities().catch(() => undefined);
    const repos = this.store.getEntries().map((entry) => ({
      repo: `${entry.repo.owner}/${entry.repo.name}`,
      runs: entry.runs.length,
      pullRequests: entry.pullRequests.length,
      loading: entry.loading,
      error: entry.error,
      recentErrors: entry.errors,
      lastUpdated: entry.lastUpdated ? new Date(entry.lastUpdated).toISOString() : undefined,
    }));
    const payload = {
      generatedAt: new Date().toISOString(),
      vscodeVersion: vscode.version,
      settings: {
        baseUrl: settings.baseUrl,
        tlsInsecureSkipVerify: settings.tlsInsecureSkipVerify,
        discoveryMode: settings.discoveryMode,
        runningRefreshSeconds: settings.runningRefreshSeconds,
        idleRefreshSeconds: settings.idleRefreshSeconds,
        pauseWhenViewsHidden: settings.pauseWhenViewsHidden,
        maxRunsPerRepo: settings.maxRunsPerRepo,
        maxJobsPerRun: settings.maxJobsPerRun,
        debugLogging: settings.debugLogging,
        reviewCommentsEnabled: settings.reviewCommentsEnabled,
      },
      capabilities,
      repositories: repos,
      workspaceFolders: (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath),
    };

    const document = await vscode.workspace.openTextDocument({
      language: "json",
      content: JSON.stringify(payload, null, 2),
    });
    await vscode.window.showTextDocument(document, { preview: false });
  }

  private async handleListWorkflows(arg: unknown): Promise<void> {
    const repo = await this.resolveRepoForAction(arg);
    if (!repo) {
      return;
    }
    const workflows = await this.api.listWorkflows(repo);
    if (!workflows.length) {
      vscode.window.showInformationMessage("No workflows found for this repository.");
      return;
    }
    const picked = await vscode.window.showQuickPick(
      workflows.map((workflow) => ({
        label: workflow.name,
        description: workflow.state,
        workflow,
      })),
      {
        title: `Workflows for ${repo.owner}/${repo.name}`,
      },
    );
    if (!picked) {
      return;
    }
    if (picked.workflow.htmlUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(picked.workflow.htmlUrl));
      return;
    }
    vscode.window.showInformationMessage(`Selected workflow: ${picked.workflow.name}`);
  }

  private async handleDispatchWorkflow(arg: unknown): Promise<void> {
    const repo = await this.resolveRepoForAction(arg);
    if (!repo) {
      return;
    }
    const workflow = await this.pickWorkflow(repo);
    if (!workflow) {
      return;
    }
    const ref = await vscode.window.showInputBox({
      title: "Dispatch workflow",
      prompt: "Git ref (branch or tag)",
      value: "main",
    });
    if (!ref) {
      return;
    }
    const rawInputs = await vscode.window.showInputBox({
      title: "Workflow inputs",
      prompt: "Optional: key=value pairs separated by commas",
    });
    const inputs = parseWorkflowInputs(rawInputs);
    await this.api.dispatchWorkflow(repo, workflow.id, ref.trim(), inputs);
    vscode.window.showInformationMessage(`Workflow dispatched: ${workflow.name}`);
    void this.refreshController.refreshRepo(repo, getSettings().maxRunsPerRepo);
  }

  private async handleEnableWorkflow(arg: unknown): Promise<void> {
    const repo = await this.resolveRepoForAction(arg);
    if (!repo) {
      return;
    }
    const workflow = await this.pickWorkflow(repo);
    if (!workflow) {
      return;
    }
    await this.api.enableWorkflow(repo, workflow.id);
    vscode.window.showInformationMessage(`Workflow enabled: ${workflow.name}`);
  }

  private async handleDisableWorkflow(arg: unknown): Promise<void> {
    const repo = await this.resolveRepoForAction(arg);
    if (!repo) {
      return;
    }
    const workflow = await this.pickWorkflow(repo);
    if (!workflow) {
      return;
    }
    await this.api.disableWorkflow(repo, workflow.id);
    vscode.window.showInformationMessage(`Workflow disabled: ${workflow.name}`);
  }

  private async handleDeleteRun(arg: unknown): Promise<void> {
    const payload = normalizeRunArg(arg);
    if (!payload) {
      vscode.window.showWarningMessage("Run not found.");
      return;
    }
    const confirmed = await vscode.window.showWarningMessage(
      `Delete workflow run #${payload.run.id}?`,
      { modal: true },
      "Delete",
    );
    if (confirmed !== "Delete") {
      return;
    }
    await this.api.deleteRun(payload.repo, payload.run.id);
    void this.refreshController.refreshRepo(payload.repo, getSettings().maxRunsPerRepo);
    vscode.window.showInformationMessage(`Deleted run #${payload.run.id}.`);
  }

  private async handleDownloadArtifact(arg: unknown): Promise<void> {
    const payload = normalizeArtifactArg(arg);
    if (!payload) {
      vscode.window.showWarningMessage("Artifact not found.");
      return;
    }
    const target = await vscode.window.showSaveDialog({
      saveLabel: "Download Artifact",
      filters: {
        Zip: ["zip"],
      },
      defaultUri: vscode.Uri.file(`${payload.artifact.name}.zip`),
    });
    if (!target) {
      return;
    }
    const data = await this.api.downloadArtifact(payload.repo, payload.artifact.id);
    await fs.promises.writeFile(target.fsPath, Buffer.from(data));
    vscode.window.showInformationMessage(`Artifact downloaded to ${target.fsPath}`);
  }

  private async resolveRepoForAction(arg: unknown): Promise<RepoRef | undefined> {
    return extractRepo(arg) ?? this.settingsProvider.getCurrentRepo() ?? this.pickRepo();
  }

  private async pickRepo(): Promise<RepoRef | undefined> {
    const repos = this.store.getRepos();
    if (!repos.length) {
      vscode.window.showWarningMessage("No repositories available.");
      return undefined;
    }
    if (repos.length === 1) {
      return repos[0];
    }
    const picked = await vscode.window.showQuickPick(
      repos.map((repo) => ({
        label: `${repo.owner}/${repo.name}`,
        description: repo.host,
        repo,
      })),
      { title: "Select repository" },
    );
    return picked?.repo;
  }

  private async pickWorkflow(repo: RepoRef): Promise<ActionWorkflow | undefined> {
    const workflows = await this.api.listWorkflows(repo);
    if (!workflows.length) {
      vscode.window.showWarningMessage("No workflows found.");
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(
      workflows.map((workflow) => ({
        label: workflow.name,
        description: workflow.state,
        workflow,
      })),
      { title: `Select workflow (${repo.owner}/${repo.name})` },
    );
    return picked?.workflow;
  }

  private async ensureRunDetails(repo: RepoRef, run: WorkflowRun): Promise<void> {
    const entry = this.store.getEntry(repo);
    const state = entry?.jobsStateByRun.get(String(run.id));
    if (state === "idle") {
      return;
    }
    await this.refreshController.loadRunDetails(repo, run.id);
  }
}

type LogArg = { repo: RepoRef; run: WorkflowRun; job: Job; step?: unknown };
type ArtifactArg = { repo: RepoRef; artifact: { id: number | string; name: string } };

function normalizeLogArg(arg: unknown): LogArg | undefined {
  if (arg && typeof arg === "object" && "repo" in arg && "job" in arg && "run" in arg) {
    return arg as LogArg;
  }
  if (arg instanceof JobNode) {
    return { repo: arg.repo, run: arg.run, job: arg.job };
  }
  if (arg instanceof StepNode) {
    return { repo: arg.repo, run: arg.run, job: arg.job, step: arg.step };
  }
  return undefined;
}

function normalizeArtifactArg(arg: unknown): ArtifactArg | undefined {
  if (arg && typeof arg === "object" && "repo" in arg && "artifact" in arg) {
    return arg as ArtifactArg;
  }
  if (arg instanceof ArtifactNode) {
    return {
      repo: arg.repo,
      artifact: {
        id: arg.artifact.id,
        name: arg.artifact.name,
      },
    };
  }
  return undefined;
}

function resolveOpenUrl(arg: unknown, baseUrl: string): string | undefined {
  if (arg instanceof RepoNode) {
    return arg.repo.htmlUrl ?? buildRepoUrl(baseUrl, arg.repo);
  }
  if (arg instanceof RunNode) {
    return arg.run.htmlUrl ?? buildRunUrl(baseUrl, arg.repo, arg.run);
  }
  if (arg instanceof JobNode) {
    return arg.job.htmlUrl ?? buildJobUrl(baseUrl, arg.repo, arg.job);
  }
  if (arg instanceof PullRequestNode) {
    return arg.pullRequest.htmlUrl ?? buildPullRequestUrl(baseUrl, arg.repo, arg.pullRequest);
  }
  if (arg instanceof ArtifactNode) {
    return arg.artifact.downloadUrl;
  }
  if (arg instanceof SectionNode) {
    return undefined;
  }
  if (arg instanceof StepNode) {
    return arg.job.htmlUrl ?? buildJobUrl(baseUrl, arg.repo, arg.job);
  }
  return undefined;
}

function normalizeRunArg(arg: unknown): { repo: RepoRef; run: WorkflowRun } | undefined {
  if (arg && typeof arg === "object" && "repo" in arg && "run" in arg) {
    return arg as { repo: RepoRef; run: WorkflowRun };
  }
  if (arg instanceof RunNode) {
    return { repo: arg.repo, run: arg.run };
  }
  return undefined;
}

function extractRepo(arg: unknown): RepoRef | undefined {
  if (arg && typeof arg === "object" && "owner" in arg && "name" in arg) {
    const repo = arg as RepoRef;
    if (repo.owner && repo.name) {
      return repo;
    }
  }
  if (arg instanceof RepoNode) {
    return arg.repo;
  }
  if (arg instanceof RunNode) {
    return arg.repo;
  }
  if (arg instanceof JobNode) {
    return arg.repo;
  }
  if (arg instanceof PullRequestNode) {
    return arg.repo;
  }
  if (arg instanceof ArtifactNode) {
    return arg.repo;
  }
  if (arg instanceof SectionNode) {
    return arg.repo;
  }
  if (arg instanceof SecretNode) {
    return arg.repo;
  }
  if (arg instanceof SecretsRootNode) {
    return arg.repo;
  }
  if (arg instanceof VariablesRootNode) {
    return arg.repo;
  }
  if (arg instanceof VariableNode) {
    return arg.repo;
  }
  return undefined;
}

function buildRepoUrl(baseUrl: string, repo: RepoRef): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}`;
}

function buildRunUrl(baseUrl: string, repo: RepoRef, run: WorkflowRun): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}/actions/runs/${run.id}`;
}

function buildJobUrl(baseUrl: string, repo: RepoRef, job: Job): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}/actions/jobs/${job.id}`;
}

function buildPullRequestUrl(
  baseUrl: string,
  repo: RepoRef,
  pull: PullRequest,
): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}/pulls/${pull.number}`;
}

function trimBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function parseWorkflowInputs(raw?: string): Record<string, string> | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const result: Record<string, string> = {};
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const [key, ...rest] = trimmed.split("=");
    const normalizedKey = key.trim();
    const value = rest.join("=").trim();
    if (!normalizedKey || !value) {
      continue;
    }
    result[normalizedKey] = value;
  }
  return Object.keys(result).length ? result : undefined;
}
