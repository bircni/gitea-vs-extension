import * as vscode from "vscode";
import { getSettings, onSettingsChange } from "./config/settings";
import { getToken, TOKEN_KEY } from "./config/secrets";
import { GiteaHttpClient } from "./gitea/client";
import { GiteaApi } from "./gitea/api";
import { RepoDiscovery } from "./gitea/discovery";
import { ActionsTreeProvider } from "./views/actionsTreeProvider";
import { RepoStateStore } from "./util/cache";
import { Logger } from "./util/logging";
import {
  loadExpandedState,
  registerTreeViews,
  updateStatusBar,
  wireExpandCollapsePersistence,
  wireRefreshAndStatusBar,
  wireSelectionToRepoSync,
} from "./util/bootstrap";
import { RefreshController, type RefreshSummary } from "./controllers/refreshController";
import { CommandsController } from "./controllers/commands";
import { SettingsTreeProvider } from "./views/settingsTreeProvider";
import { ReviewCommentsController } from "./controllers/reviewCommentsController";
import { registerExtensionTestCommands } from "./util/extensionTestCommands";
import { resolveExtensionTestPat } from "./util/extensionTestMode";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger("gitea-vs-extension", () => getSettings().debugLogging);
  let cachedToken = await getToken(context.secrets);

  const settingsProvider = new SettingsTreeProvider();
  settingsProvider.setTokenStatus(Boolean(resolveExtensionTestPat() ?? cachedToken));

  context.secrets.onDidChange((event) => {
    if (event.key === TOKEN_KEY) {
      void getToken(context.secrets).then((token) => {
        cachedToken = token;
        settingsProvider.setTokenStatus(Boolean(resolveExtensionTestPat() ?? token));
      });
    }
  });

  const client = new GiteaHttpClient(() => {
    const settings = getSettings();
    return {
      baseUrl: settings.baseUrl,
      token: resolveExtensionTestPat() ?? cachedToken,
      insecureSkipVerify: settings.tlsInsecureSkipVerify,
    };
  });

  const api = new GiteaApi(client, () => getSettings().baseUrl);
  const store = new RepoStateStore();
  const discovery = new RepoDiscovery(api);
  const expanded = loadExpandedState(context.globalState);

  const runsProvider = new ActionsTreeProvider("runs", store, context.secrets, expanded);
  const workflowsProvider = new ActionsTreeProvider("workflows", store, context.secrets, expanded);
  const pullRequestsProvider = new ActionsTreeProvider(
    "pullRequests",
    store,
    context.secrets,
    expanded,
  );

  const trees = registerTreeViews({
    runs: { viewId: "gitea-vs-extension.runs", provider: runsProvider },
    workflows: { viewId: "gitea-vs-extension.runsPinned", provider: workflowsProvider },
    pullRequests: { viewId: "gitea-vs-extension.pullRequests", provider: pullRequestsProvider },
    settings: { viewId: "gitea-vs-extension.settings", provider: settingsProvider },
  });

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.text = "Gitea: idle";
  statusBar.command = "workbench.view.extension.bircniGiteaVsExtension";
  statusBar.show();

  const reviewCommentsController = new ReviewCommentsController(
    api,
    logger,
    context.globalStorageUri.fsPath,
  );

  const refreshController = new RefreshController(
    api,
    store,
    discovery,
    logger,
    () => {
      runsProvider.refresh();
      workflowsProvider.refresh();
      pullRequestsProvider.refresh();
      const currentRepo = settingsProvider.getCurrentRepo();
      const [firstRepo] = store.getRepos();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!currentRepo && firstRepo) {
        settingsProvider.setRepository(firstRepo);
      }
    },
    (summary: RefreshSummary) => {
      updateStatusBar(statusBar, summary);
      reviewCommentsController.scheduleRefresh();
    },
  );

  const commands = new CommandsController(
    context,
    api,
    refreshController,
    store,
    runsProvider,
    settingsProvider,
    () => {
      runsProvider.refresh();
      workflowsProvider.refresh();
      pullRequestsProvider.refresh();
    },
  );

  context.subscriptions.push(
    trees.runsTree,
    trees.workflowsTree,
    trees.pullRequestsTree,
    trees.settingsTree,
    statusBar,
    reviewCommentsController,
    logger,
    { dispose: () => refreshController.dispose() },
    ...commands.register(),
    ...registerExtensionTestCommands(context, store, refreshController),
    ...wireExpandCollapsePersistence({
      trees,
      expanded,
      globalState: context.globalState,
      loadRunDetails: (repo, runId) => void refreshController.loadRunDetails(repo, runId),
    }),
    ...wireSelectionToRepoSync({
      trees,
      setRepository: (repo) => settingsProvider.setRepository(repo),
    }),
    ...wireRefreshAndStatusBar({
      refreshController,
      settingsProvider,
      onSettingsChange: (listener) =>
        onSettingsChange(() => {
          logger.debug("Settings changed, refreshing.");
          listener();
        }),
      workspaceFoldersChange: vscode.workspace.onDidChangeWorkspaceFolders,
      trees,
      onAfterRefreshTrigger: () => reviewCommentsController.scheduleRefresh(),
    }),
  );

  reviewCommentsController.scheduleRefresh();
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {}
