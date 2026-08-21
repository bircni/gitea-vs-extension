import * as fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { getArtifactDownloadBaseDir, getSettings } from "../config/settings";
import { clearToken, getEffectiveToken, setToken } from "../config/secrets";
import type { ActionVariable, Secret } from "../gitea/api";
import type { GiteaApiRouter } from "../gitea/apiRouter";
import type { RepoRef, WorkflowRun } from "../gitea/models";
import { computeArtifactSavePath } from "../util/artifactDownload";
import { extractRepo, isRepoRef } from "../util/commandArgs";
import { execGit } from "../util/git";
import type { RepoStateStore } from "../util/cache";
import type { ActionsTreeProvider } from "../views/actionsTreeProvider";
import { RepoNode } from "../views/nodes";
import {
  downloadArtifact,
  openOrRevealArtifact,
  revealArtifactInExplorer,
} from "./artifactCommands";
import { copyUrl, openBaseUrlSettings, openInBrowser } from "./browserCommands";
import { checkoutPrBranch } from "./checkoutCommands";
import { openLatestFailedJobLogs, viewJobLogs } from "./logCommands";
import { rerunFailedJobs, rerunJob, rerunRun } from "./runControlCommands";
import {
  createSecret,
  createVariable,
  deleteSecret,
  deleteVariable,
  refreshSecrets,
  refreshVariables,
  updateSecret,
  updateVariable,
} from "./secretsVariablesCommands";
import type { RefreshController } from "./refreshController";
import type { SettingsTreeProvider } from "../views/settingsTreeProvider";

export class CommandsController {
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly api: GiteaApiRouter,
    private readonly refreshController: RefreshController,
    private readonly store: RepoStateStore,
    private readonly treeProvider: ActionsTreeProvider,
    private readonly settingsProvider: SettingsTreeProvider,
    private readonly refreshViews?: () => void,
  ) {}

  register(): vscode.Disposable[] {
    return [
      vscode.commands.registerCommand("gitea-vs-extension.setToken", (arg) =>
        this.handleSetToken(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.addInstance", () =>
        this.handleAddInstance(),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.clearToken", (arg) =>
        this.handleClearToken(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.testConnection", (arg) =>
        this.handleTestConnection(arg),
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
      vscode.commands.registerCommand("gitea-vs-extension.switchBranchFilter", () =>
        this.handleSwitchBranchFilter(),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.downloadArtifact", (arg) =>
        this.handleDownloadArtifact(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.revealArtifactInExplorer", (arg) =>
        this.handleRevealArtifactInExplorer(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.openOrRevealArtifact", (arg) =>
        this.handleOpenOrRevealArtifact(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.checkoutPrBranch", (arg) =>
        this.handleCheckoutPrBranch(arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.rerunRun", (arg) =>
        rerunRun(this.runControlDeps(), arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.rerunFailedJobs", (arg) =>
        rerunFailedJobs(this.runControlDeps(), arg),
      ),
      vscode.commands.registerCommand("gitea-vs-extension.rerunJob", (arg) =>
        rerunJob(this.runControlDeps(), arg),
      ),
    ];
  }

  private runControlDeps() {
    return {
      rerunRun: this.api.rerunRun.bind(this.api),
      rerunFailedJobs: this.api.rerunFailedJobs.bind(this.api),
      rerunJob: this.api.rerunJob.bind(this.api),
      refreshRepo: async (repo: RepoRef) => {
        await this.refreshController.refreshRepo(repo, getSettings().maxRunsPerRepo);
        this.treeProvider.refresh();
        this.refreshViews?.();
      },
      withProgress: <T>(title: string, task: () => Promise<T>) =>
        vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, () =>
          task(),
        ),
      showInformationMessage: (msg: string) => void vscode.window.showInformationMessage(msg),
      showErrorMessage: (msg: string) => void vscode.window.showErrorMessage(msg),
    };
  }

  private async handleDownloadArtifact(arg: unknown): Promise<void> {
    await downloadArtifact(this.artifactDeps(), arg);
  }

  private async handleRevealArtifactInExplorer(arg: unknown): Promise<void> {
    await revealArtifactInExplorer(this.artifactDeps(), arg);
  }

  private async handleOpenOrRevealArtifact(arg: unknown): Promise<void> {
    await openOrRevealArtifact(this.artifactDeps(), arg);
  }

  private async handleCheckoutPrBranch(arg: unknown): Promise<void> {
    await checkoutPrBranch(
      {
        getWorkspaceFolderPath: this.store.getWorkspaceFolderPath.bind(this.store),
        execGit,
        showInformationMessage: (msg: string) => void vscode.window.showInformationMessage(msg),
        showWarningMessage: (msg: string) => void vscode.window.showWarningMessage(msg),
        showErrorMessage: (msg: string) => void vscode.window.showErrorMessage(msg),
      },
      arg,
    );
  }

  private artifactDeps() {
    return {
      downloadArtifactToFile: this.api.downloadArtifactToFile.bind(this.api),
      getArtifactDownloadBaseDir,
      getSettings,
      computeArtifactSavePath,
      existsSync: fs.existsSync.bind(fs),
      showInformationMessage: (msg: string) => void vscode.window.showInformationMessage(msg),
      showErrorMessage: (msg: string) => void vscode.window.showErrorMessage(msg),
      executeCommand: (cmd: string, uri: unknown) => vscode.commands.executeCommand(cmd, uri),
      uriFile: (p: string) => vscode.Uri.file(p),
      logError: (label: string, err: unknown) => console.error(label, err),
    };
  }

  private async handleSwitchBranchFilter(arg?: RepoRef | RepoNode): Promise<void> {
    let repo: RepoRef | undefined;
    if (arg instanceof RepoNode) {
      repo = arg.repo;
    } else if (isRepoRef(arg)) {
      repo = arg;
    }
    repo ??= this.settingsProvider.getCurrentRepo();
    if (!repo) {
      void vscode.window.showInformationMessage(
        "Select a repository in the Workflows or Workflow Runs view first, then run the command again.",
      );
      return;
    }

    const context = this.store.getBranchContext(repo);
    const entry = this.store.getEntry(repo);
    const branchNames = entry
      ? [...new Set(entry.runs.map((r) => r.branch).filter(Boolean) as string[])].toSorted((a, b) =>
          a.localeCompare(b),
        )
      : [];

    const currentBranchLabel =
      context?.status === "resolved" && context.branchName
        ? `Current branch (${context.branchName})`
        : "Current branch (unavailable)";

    const currentBranchItemLabel = `$(git-branch) ${currentBranchLabel}`;

    type BranchFilterItem = vscode.QuickPickItem & { id: string };
    const items: BranchFilterItem[] = [
      {
        label: currentBranchItemLabel,
        detail: "Show only runs for your current branch",
        id: "currentBranch",
      },
      {
        label: "$(list-unordered) All branches",
        detail: "Show runs for all branches",
        id: "allBranches",
      },
      ...branchNames.map((b) => ({
        label: `$(branch) ${b}`,
        detail: `Show only runs for branch ${b}`,
        id: b,
      })),
    ];

    const picked = await vscode.window.showQuickPick(items, {
      title: "Branch filter",
      placeHolder: "Choose which branch's workflow runs to show",
      matchOnDetail: true,
    });

    if (!picked) {
      return;
    }

    const id = picked.id;
    if (id === "currentBranch") {
      this.store.setBranchFilter({ repo, mode: "currentBranch" });
    } else if (id === "allBranches") {
      this.store.setBranchFilter({ repo, mode: "allBranches" });
    } else {
      this.store.setBranchFilter({ repo, mode: "specificBranch", branchName: id });
    }

    const settings = getSettings();
    await this.refreshController.refreshRepo(repo, settings.maxRunsPerRepo);
    this.treeProvider.refresh();
    this.refreshViews?.();
  }

  private async handleSetToken(arg?: unknown): Promise<void> {
    const token = await vscode.window.showInputBox({
      title: "Gitea Personal Access Token",
      prompt: "Enter your Gitea PAT",
      password: true,
      ignoreFocusOut: true,
    });

    if (!token) {
      return;
    }

    const baseUrl = this.getSelectedBaseUrl(arg);
    if (!baseUrl) {
      vscode.window.showWarningMessage("Add a Gitea instance URL before setting a token.");
      return;
    }
    await setToken(this.context.secrets, token.trim(), baseUrl);
    this.settingsProvider.setTokenStatus(baseUrl, true);
    void this.refreshController.refreshAll();
    vscode.window.showInformationMessage("gitea-vs-extension token saved.");
  }

  private async handleAddInstance(): Promise<void> {
    const rawUrl = await vscode.window.showInputBox({
      title: "Add Gitea Instance",
      prompt: "Enter the Gitea base URL",
      placeHolder: "https://gitea.example.com",
      ignoreFocusOut: true,
    });
    if (!rawUrl) {
      return;
    }
    let baseUrl: string;
    try {
      const url = new URL(rawUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("unsupported protocol");
      }
      baseUrl = url.toString().replace(/\/$/, "");
    } catch {
      vscode.window.showWarningMessage("Enter a valid HTTP(S) Gitea URL.");
      return;
    }

    const settings = getSettings();
    if (!settings.instanceUrls.includes(baseUrl)) {
      await vscode.workspace
        .getConfiguration("gitea-vs-extension")
        .update(
          "instances",
          [...settings.instanceUrls, baseUrl],
          vscode.ConfigurationTarget.Global,
        );
    }

    const token = await vscode.window.showInputBox({
      title: "Gitea Personal Access Token",
      prompt: `Enter a token for ${baseUrl}`,
      password: true,
      ignoreFocusOut: true,
    });
    if (token) {
      await setToken(this.context.secrets, token.trim(), baseUrl);
      this.settingsProvider.setTokenStatus(baseUrl, true);
    }
    void this.refreshController.refreshAll();
  }

  private async handleClearToken(arg?: unknown): Promise<void> {
    const baseUrl = this.getSelectedBaseUrl(arg);
    if (!baseUrl) {
      return;
    }
    await clearToken(this.context.secrets, baseUrl);
    this.settingsProvider.setTokenStatus(baseUrl, false);
    void this.refreshController.refreshAll();
    vscode.window.showInformationMessage("gitea-vs-extension token cleared.");
  }

  private async handleTestConnection(arg?: unknown): Promise<void> {
    const settings = getSettings();
    const baseUrl = this.getSelectedBaseUrl(arg);
    if (!baseUrl) {
      vscode.window.showWarningMessage("Add a Gitea instance URL before testing connection.");
      return;
    }

    const token = await getEffectiveToken(
      this.context.secrets,
      baseUrl,
      baseUrl === settings.baseUrl,
    );
    if (!token) {
      vscode.window.showWarningMessage("Set a token before testing connection.");
      return;
    }

    try {
      const version = await this.api.testConnection(baseUrl);
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
    await viewJobLogs(this.logDeps(), arg);
  }

  private async handleOpenLatestFailedJobLogs(arg: unknown): Promise<void> {
    await openLatestFailedJobLogs(this.logDeps(), arg);
  }

  private logDeps() {
    return {
      getJobLogs: this.api.getJobLogs.bind(this.api),
      getWorkspaceFolderPath: this.store.getWorkspaceFolderPath.bind(this.store),
      getSettings,
      pathJoin: path.join.bind(path),
      mkdirSync: fs.mkdirSync.bind(fs),
      writeFileSync: (p: string, c: string, e?: string) =>
        fs.writeFileSync(p, c, e as BufferEncoding | undefined),
      uriFile: (p: string) => vscode.Uri.file(p),
      openTextDocument: (opts: { content: string; language: string } | { uri: unknown }) =>
        "uri" in opts
          ? vscode.workspace.openTextDocument(opts.uri as vscode.Uri)
          : vscode.workspace.openTextDocument(opts),
      showTextDocument: (doc: unknown, opts: { preview: boolean }) =>
        vscode.window.showTextDocument(doc as vscode.TextDocument, opts),
      showWarningMessage: (msg: string) => vscode.window.showWarningMessage(msg),
      showInformationMessage: (msg: string) => void vscode.window.showInformationMessage(msg),
      getEntry: this.store.getEntry.bind(this.store),
      loadRunDetails: (repo: RepoRef, runId: number | string) =>
        this.ensureRunDetails(repo, { id: runId } as WorkflowRun),
    };
  }

  private async handleOpenInBrowser(arg: unknown): Promise<void> {
    await openInBrowser(this.browserDeps(), arg);
  }

  private async handleCopyUrl(arg: unknown): Promise<void> {
    await copyUrl(this.browserDeps(), arg);
  }

  private async handleRefreshSecrets(arg: unknown): Promise<void> {
    await refreshSecrets(this.secretsVariablesDeps(), arg);
  }

  private async handleRefreshVariables(arg: unknown): Promise<void> {
    await refreshVariables(this.secretsVariablesDeps(), arg);
  }

  private async handleCreateSecret(arg: unknown): Promise<void> {
    await createSecret(this.secretsVariablesDeps(), arg);
  }

  private async handleUpdateSecret(arg: unknown): Promise<void> {
    await updateSecret(this.secretsVariablesDeps(), arg);
  }

  private async handleDeleteSecret(arg: unknown): Promise<void> {
    await deleteSecret(this.secretsVariablesDeps(), arg);
  }

  private async handleCreateVariable(arg: unknown): Promise<void> {
    await createVariable(this.secretsVariablesDeps(), arg);
  }

  private async handleUpdateVariable(arg: unknown): Promise<void> {
    await updateVariable(this.secretsVariablesDeps(), arg);
  }

  private async handleDeleteVariable(arg: unknown): Promise<void> {
    await deleteVariable(this.secretsVariablesDeps(), arg);
  }

  private secretsVariablesDeps() {
    return {
      getCurrentRepo: () => this.settingsProvider.getCurrentRepo(),
      setSecretsLoading: () => this.settingsProvider.setSecretsLoading(),
      setSecrets: (s: unknown[]) => this.settingsProvider.setSecrets(s as Secret[]),
      setSecretsError: (m: string) => this.settingsProvider.setSecretsError(m),
      setVariablesLoading: () => this.settingsProvider.setVariablesLoading(),
      setVariables: (v: unknown[]) => this.settingsProvider.setVariables(v as ActionVariable[]),
      setVariablesError: (m: string) => this.settingsProvider.setVariablesError(m),
      listSecrets: this.api.listSecrets.bind(this.api),
      listVariables: this.api.listVariables.bind(this.api),
      createOrUpdateSecret: this.api.createOrUpdateSecret.bind(this.api),
      deleteSecret: this.api.deleteSecret.bind(this.api),
      createVariable: this.api.createVariable.bind(this.api),
      updateVariable: this.api.updateVariable.bind(this.api),
      deleteVariable: this.api.deleteVariable.bind(this.api),
      showInputBox: (opts: Parameters<typeof vscode.window.showInputBox>[0]) =>
        vscode.window.showInputBox(opts),
      showWarningMessage: (msg: string, opts?: { modal: boolean }, ...items: string[]) =>
        vscode.window.showWarningMessage(msg, opts ?? {}, ...items),
      refreshSecrets: (arg?: unknown) => this.handleRefreshSecrets(arg),
      refreshVariables: (arg?: unknown) => this.handleRefreshVariables(arg),
    };
  }

  private async handleOpenBaseUrlSettings(): Promise<void> {
    await openBaseUrlSettings(this.browserDeps());
  }

  private browserDeps() {
    return {
      getBaseUrl: () => getSettings().baseUrl || "",
      showWarningMessage: (msg: string) => vscode.window.showWarningMessage(msg),
      showInformationMessage: (msg: string) => void vscode.window.showInformationMessage(msg),
      openExternal: (url: string) => vscode.env.openExternal(vscode.Uri.parse(url)),
      clipboardWriteText: (text: string) => vscode.env.clipboard.writeText(text),
      executeCommand: (cmd: string, ...args: unknown[]) =>
        vscode.commands.executeCommand(cmd, ...args),
    };
  }

  private getSelectedBaseUrl(arg?: unknown): string | undefined {
    const settings = getSettings();
    if (typeof arg === "string" && settings.instanceUrls.includes(arg)) {
      return arg;
    }
    if (
      typeof arg === "object" &&
      arg !== null &&
      "baseUrl" in arg &&
      typeof arg.baseUrl === "string" &&
      settings.instanceUrls.includes(arg.baseUrl)
    ) {
      return arg.baseUrl;
    }
    const repo = this.settingsProvider.getCurrentRepo();
    const matching = repo
      ? settings.instanceUrls.find((url) => {
          try {
            return new URL(url).host.toLowerCase() === repo.host.toLowerCase();
          } catch {
            return false;
          }
        })
      : undefined;
    return matching ?? settings.instanceUrls[0];
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
