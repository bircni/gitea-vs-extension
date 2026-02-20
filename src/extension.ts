import * as vscode from "vscode";
import { getSettings, onSettingsChange } from "./config/settings";
import { getToken, TOKEN_KEY } from "./config/secrets";
import { GiteaHttpClient } from "./gitea/client";
import { GiteaApi } from "./gitea/api";
import { RepoDiscovery } from "./gitea/discovery";
import { ActionsTreeProvider } from "./views/actionsTreeProvider";
import { RepoStateStore } from "./util/cache";
import { Logger } from "./util/logging";
import { expandedRepoKey, expandedRunKey, expandedWorkflowKey } from "./util/expandedState";
import { RefreshController, type RefreshSummary } from "./controllers/refreshController";
import { CommandsController } from "./controllers/commands";
import { SettingsTreeProvider } from "./views/settingsTreeProvider";
import { ReviewCommentsController } from "./controllers/reviewCommentsController";
import {
  RepoNode,
  RunNode,
  JobNode,
  StepNode,
  WorkflowGroupNode,
  PullRequestNode,
} from "./views/nodes";
import type { RepoRef } from "./gitea/models";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger("gitea-vs-extension", () => getSettings().debugLogging);
  let cachedToken = await getToken(context.secrets);

  const settingsProvider = new SettingsTreeProvider();
  settingsProvider.setTokenStatus(Boolean(cachedToken));

  context.secrets.onDidChange((event) => {
    if (event.key === TOKEN_KEY) {
      void getToken(context.secrets).then((token) => {
        cachedToken = token;
        settingsProvider.setTokenStatus(Boolean(token));
      });
    }
  });

  const client = new GiteaHttpClient(() => {
    const settings = getSettings();
    return {
      baseUrl: settings.baseUrl,
      token: cachedToken,
      insecureSkipVerify: settings.tlsInsecureSkipVerify,
    };
  });

  const api = new GiteaApi(client, () => getSettings().baseUrl);
  const store = new RepoStateStore();
  const discovery = new RepoDiscovery(api);
  const expanded = loadExpandedState(context.globalState);

  const capabilitiesProvider = async () => api.getCapabilities();

  const runsProvider = new ActionsTreeProvider(
    "runs",
    store,
    context.secrets,
    expanded,
    capabilitiesProvider,
  );
  const workflowsProvider = new ActionsTreeProvider(
    "workflows",
    store,
    context.secrets,
    expanded,
    capabilitiesProvider,
  );
  const pullRequestsProvider = new ActionsTreeProvider(
    "pullRequests",
    store,
    context.secrets,
    expanded,
    capabilitiesProvider,
  );

  const workflowsTree = vscode.window.createTreeView("gitea-vs-extension.runsPinned", {
    treeDataProvider: workflowsProvider,
    showCollapseAll: true,
  });
  const pullRequestsTree = vscode.window.createTreeView("gitea-vs-extension.pullRequests", {
    treeDataProvider: pullRequestsProvider,
    showCollapseAll: true,
  });
  const runsTree = vscode.window.createTreeView("gitea-vs-extension.runs", {
    treeDataProvider: runsProvider,
    showCollapseAll: true,
  });
  const settingsTree = vscode.window.createTreeView("gitea-vs-extension.settings", {
    treeDataProvider: settingsProvider,
    showCollapseAll: true,
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
    (summary) => {
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
  );

  const treeViews: vscode.TreeView<unknown>[] = [
    runsTree,
    workflowsTree,
    pullRequestsTree,
    settingsTree,
  ];
  const updatePollingForVisibility = (): boolean => {
    const settings = getSettings();
    const anyVisible = treeViews.some((view) => view.visible);
    const pollingEnabled = settings.pauseWhenViewsHidden ? anyVisible : true;
    refreshController.setPollingEnabled(pollingEnabled);
    return anyVisible;
  };
  const refreshVisibleViews = (): void => {
    const anyVisible = updatePollingForVisibility();
    if (anyVisible || !getSettings().pauseWhenViewsHidden) {
      void refreshController.refreshAll();
    }
  };
  const syncCapabilityContext = (): void => {
    void api
      .getCapabilities()
      .then(async (caps) => {
        await vscode.commands.executeCommand("setContext", "gitea.cap.workflows", caps.workflows);
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.workflowDispatch",
          caps.workflowDispatch,
        );
        await vscode.commands.executeCommand("setContext", "gitea.cap.runDelete", caps.runDelete);
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.artifactDownload",
          caps.artifactDownload,
        );
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.pullRequestFiles",
          caps.pullRequestFiles,
        );
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.pullRequestCommits",
          caps.pullRequestCommits,
        );
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.pullRequestUpdate",
          caps.pullRequestUpdate,
        );
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.requestedReviewers",
          caps.requestedReviewers,
        );
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.pullRequestMerge",
          caps.pullRequestMerge,
        );
        await vscode.commands.executeCommand(
          "setContext",
          "gitea.cap.pullRequestReviews",
          caps.pullRequestReviews,
        );
      })
      .catch(() => undefined);
  };

  context.subscriptions.push(
    runsTree,
    workflowsTree,
    pullRequestsTree,
    settingsTree,
    statusBar,
    reviewCommentsController,
    logger,
    { dispose: () => refreshController.dispose() },
    ...commands.register(),
    onSettingsChange(() => {
      logger.debug("Settings changed, refreshing.", "core");
      syncCapabilityContext();
      refreshVisibleViews();
      reviewCommentsController.scheduleRefresh();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      refreshVisibleViews();
      reviewCommentsController.scheduleRefresh();
    }),
    runsTree.onDidChangeVisibility((event) => {
      if (event.visible) {
        refreshVisibleViews();
      } else {
        updatePollingForVisibility();
      }
    }),
    workflowsTree.onDidChangeVisibility((event) => {
      if (event.visible) {
        refreshVisibleViews();
      } else {
        updatePollingForVisibility();
      }
    }),
    pullRequestsTree.onDidChangeVisibility((event) => {
      if (event.visible) {
        refreshVisibleViews();
      } else {
        updatePollingForVisibility();
      }
    }),
    settingsTree.onDidChangeVisibility((event) => {
      if (event.visible) {
        refreshVisibleViews();
        const repo = settingsProvider.getCurrentRepo();
        if (repo) {
          void vscode.commands.executeCommand("gitea-vs-extension.refreshSecrets", repo);
          void vscode.commands.executeCommand("gitea-vs-extension.refreshVariables", repo);
        }
      } else {
        updatePollingForVisibility();
      }
    }),
    runsTree.onDidExpandElement((event) => {
      if (event.element instanceof RunNode) {
        void refreshController.loadRunDetails(event.element.repo, event.element.run.id);
      }
      updateExpandedState(expanded, context.globalState, event.element, true);
    }),
    workflowsTree.onDidExpandElement((event) => {
      if (event.element instanceof RunNode) {
        void refreshController.loadRunDetails(event.element.repo, event.element.run.id);
      }
      updateExpandedState(expanded, context.globalState, event.element, true);
    }),
    pullRequestsTree.onDidExpandElement((event) => {
      updateExpandedState(expanded, context.globalState, event.element, true);
    }),
    runsTree.onDidCollapseElement((event) => {
      updateExpandedState(expanded, context.globalState, event.element, false);
    }),
    workflowsTree.onDidCollapseElement((event) => {
      updateExpandedState(expanded, context.globalState, event.element, false);
    }),
    pullRequestsTree.onDidCollapseElement((event) => {
      updateExpandedState(expanded, context.globalState, event.element, false);
    }),
    runsTree.onDidChangeSelection((event) => {
      const repo = extractRepoFromSelection(event.selection);
      if (repo) {
        settingsProvider.setRepository(repo);
      }
    }),
    workflowsTree.onDidChangeSelection((event) => {
      const repo = extractRepoFromSelection(event.selection);
      if (repo) {
        settingsProvider.setRepository(repo);
      }
    }),
    pullRequestsTree.onDidChangeSelection((event) => {
      const repo = extractRepoFromSelection(event.selection);
      if (repo) {
        settingsProvider.setRepository(repo);
      }
    }),
  );

  if (updatePollingForVisibility() || !getSettings().pauseWhenViewsHidden) {
    void refreshController.refreshAll();
  }
  syncCapabilityContext();
  reviewCommentsController.scheduleRefresh();
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate(): void {}

function updateStatusBar(item: vscode.StatusBarItem, summary: RefreshSummary): void {
  const running = summary.runningCount;
  const failed = summary.failedCount;
  item.text = `Gitea: ${running} running, ${failed} failed`;
}

function extractRepoFromSelection(selection: readonly unknown[]): RepoRef | undefined {
  for (const element of selection) {
    if (element instanceof RepoNode) {
      return element.repo;
    }
    if (element instanceof RunNode) {
      return element.repo;
    }
    if (element instanceof JobNode) {
      return element.repo;
    }
    if (element instanceof StepNode) {
      return element.repo;
    }
    if (element instanceof WorkflowGroupNode) {
      return element.runs[0]?.repo;
    }
    if (element instanceof PullRequestNode) {
      return element.repo;
    }
  }
  return undefined;
}

const EXPANDED_STATE_KEY = "gitea-vs-extension.expandedNodes";

function loadExpandedState(storage: vscode.Memento): Set<string> {
  const stored = storage.get<string[]>(EXPANDED_STATE_KEY) ?? [];
  return new Set(stored);
}

function updateExpandedState(
  expanded: Set<string>,
  storage: vscode.Memento,
  element: unknown,
  isExpanded: boolean,
): void {
  const key = getExpandedKey(element);
  if (!key) {
    return;
  }
  if (isExpanded) {
    expanded.add(key);
  } else {
    expanded.delete(key);
  }
  void storage.update(EXPANDED_STATE_KEY, Array.from(expanded));
}

function getExpandedKey(element: unknown): string | undefined {
  if (element instanceof RepoNode) {
    return expandedRepoKey(element.repo);
  }
  if (element instanceof RunNode) {
    return expandedRunKey(element.repo, element.run.id);
  }
  if (element instanceof WorkflowGroupNode) {
    return expandedWorkflowKey(element.name);
  }
  return undefined;
}
