import * as vscode from "vscode";
import { getSettings, onSettingsChange } from "./config/settings";
import { getToken, tokenKeyForBaseUrl } from "./config/secrets";
import { GiteaHttpClient } from "./gitea/client";
import { GiteaApi } from "./gitea/api";
import { GiteaApiRouter } from "./gitea/apiRouter";
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
import { registerWorkflowDocumentTracker } from "./workflow/documentTracker";
import { startLanguageServer, stopLanguageServer } from "./workflow/languageServer";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger("gitea-vs-extension", () => getSettings().debugLogging);
  const cachedTokens = new Map<string, string | undefined>();

  const settingsProvider = new SettingsTreeProvider(() => getSettings().instanceUrls);

  const reloadToken = async (): Promise<void> => {
    const settings = getSettings();
    await Promise.all(
      settings.instanceUrls.map(async (baseUrl) => {
        cachedTokens.set(
          baseUrl,
          await getToken(context.secrets, baseUrl, baseUrl === settings.baseUrl),
        );
      }),
    );
    settingsProvider.setTokenStatuses(
      new Map(
        settings.instanceUrls.map((baseUrl) => [
          baseUrl,
          Boolean(resolveExtensionTestPat() ?? cachedTokens.get(baseUrl)),
        ]),
      ),
    );
  };
  await reloadToken();

  context.secrets.onDidChange((event) => {
    if (getSettings().instanceUrls.some((url) => event.key === tokenKeyForBaseUrl(url))) {
      void reloadToken();
    }
  });

  const apis = new Map<string, GiteaApi>();
  const api = new GiteaApiRouter(
    (baseUrl) => {
      const existing = apis.get(baseUrl);
      if (existing) {
        return existing;
      }
      const instance = new GiteaApi(
        new GiteaHttpClient(() => ({
          baseUrl,
          token: resolveExtensionTestPat() ?? cachedTokens.get(baseUrl),
          insecureSkipVerify: getSettings().tlsInsecureSkipVerify,
        })),
        () => baseUrl,
      );
      apis.set(baseUrl, instance);
      return instance;
    },
    () => getSettings().instanceUrls,
  );
  const store = new RepoStateStore();
  const discovery = new RepoDiscovery(api);
  const expanded = loadExpandedState(context.globalState);

  const runsProvider = new ActionsTreeProvider("runs", store, context.secrets, expanded);
  const workflowsProvider = new ActionsTreeProvider("workflows", store, context.secrets, expanded);

  const trees = registerTreeViews({
    runs: { viewId: "gitea-vs-extension.runs", provider: runsProvider },
    workflows: { viewId: "gitea-vs-extension.runsPinned", provider: workflowsProvider },
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
    },
  );

  context.subscriptions.push(
    trees.runsTree,
    trees.workflowsTree,
    trees.settingsTree,
    statusBar,
    reviewCommentsController,
    logger,
    { dispose: () => refreshController.dispose() },
    ...commands.register(),
    vscode.commands.registerCommand("gitea-vs-extension.addReviewComment", () =>
      reviewCommentsController.addReviewCommentAtSelection(),
    ),
    ...registerExtensionTestCommands(context, store, refreshController, reviewCommentsController, {
      runs: runsProvider,
      workflows: workflowsProvider,
    }),
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

  context.subscriptions.push(
    registerWorkflowDocumentTracker(() => getSettings().githubFolderLanguage),
  );
  if (getSettings().languageServerEnabled) {
    // Not awaited: a slow server start must not delay the tree views.
    void (async (): Promise<void> => {
      try {
        await startLanguageServer(context, getSettings().debugLogging);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Workflow language server failed to start: ${message}`);
      }
    })();
  }
}

export async function deactivate(): Promise<void> {
  await stopLanguageServer();
}
