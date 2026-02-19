import * as vscode from "vscode";
import { getSettings } from "../config/settings";
import { clearToken, getToken, setToken } from "../config/secrets";
import type { GiteaApi } from "../gitea/api";
import type { Job, PullRequest, RepoRef, WorkflowRun } from "../gitea/models";
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
      vscode.commands.registerCommand("bircni.gitea-vs-extension.setToken", () =>
        this.handleSetToken(),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.clearToken", () =>
        this.handleClearToken(),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.testConnection", () =>
        this.handleTestConnection(),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.refresh", () =>
        this.handleRefresh(),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.refreshRepo", (arg) =>
        this.handleRefreshRepo(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.viewJobLogs", (arg) =>
        this.handleViewJobLogs(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.openLatestFailedJobLogs", (arg) =>
        this.handleOpenLatestFailedJobLogs(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.openInBrowser", (arg) =>
        this.handleOpenInBrowser(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.copyUrl", (arg) =>
        this.handleCopyUrl(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.refreshSecrets", (arg) =>
        this.handleRefreshSecrets(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.refreshVariables", (arg) =>
        this.handleRefreshVariables(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.createSecret", (arg) =>
        this.handleCreateSecret(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.updateSecret", (arg) =>
        this.handleUpdateSecret(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.deleteSecret", (arg) =>
        this.handleDeleteSecret(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.createVariable", (arg) =>
        this.handleCreateVariable(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.updateVariable", (arg) =>
        this.handleUpdateVariable(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.deleteVariable", (arg) =>
        this.handleDeleteVariable(arg),
      ),
      vscode.commands.registerCommand("bircni.gitea-vs-extension.openBaseUrlSettings", () =>
        this.handleOpenBaseUrlSettings(),
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
      vscode.window.showWarningMessage(
        "Set bircni.gitea-vs-extension.baseUrl before testing connection.",
      );
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
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "@bircni.gitea-vs-extension",
    );
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
