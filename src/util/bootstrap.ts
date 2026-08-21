/**
 * Bootstrap helpers for extension activation: tree registration, expand/collapse persistence,
 * selection-to-repo sync, and refresh/status bar wiring. Keeps extension.ts thin.
 */
import * as vscode from "vscode";
import { expandedRepoKey, expandedRunKey, expandedWorkflowKey } from "./expandedState";
import {
  JobNode,
  PullRequestNode,
  RepoNode,
  RunNode,
  StepNode,
  WorkflowGroupNode,
} from "../views/nodes";
import type { RepoRef } from "../gitea/models";
import type { RefreshSummary } from "../controllers/refreshController";

const EXPANDED_STATE_KEY = "gitea-vs-extension.expandedNodes";

/** Extract RepoRef from tree selection (first repo-bearing node wins). */
export function extractRepoFromSelection(selection: readonly unknown[]): RepoRef | undefined {
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

/** Get expanded-state key for a tree element (repo, run, or workflow group). */
export function getExpandedKey(element: unknown): string | undefined {
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

/** Load persisted expanded node keys from global state. */
export function loadExpandedState(storage: vscode.Memento): Set<string> {
  const stored = storage.get<string[]>(EXPANDED_STATE_KEY) ?? [];
  return new Set(stored);
}

/** Update in-memory expanded set and persist to storage. */
export function updateExpandedState(
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
  void storage.update(EXPANDED_STATE_KEY, [...expanded]);
}

/** Update status bar text from refresh summary. */
export function updateStatusBar(item: vscode.StatusBarItem, summary: RefreshSummary): void {
  const running = summary.runningCount;
  const failed = summary.failedCount;
  item.text = `Gitea: ${running} running, ${failed} failed`;
}

export type TreeViewConfig = {
  runs: { viewId: string; provider: vscode.TreeDataProvider<unknown> };
  workflows: { viewId: string; provider: vscode.TreeDataProvider<unknown> };
  settings: { viewId: string; provider: vscode.TreeDataProvider<unknown> };
};

export type RegisteredTrees = {
  runsTree: vscode.TreeView<unknown>;
  workflowsTree: vscode.TreeView<unknown>;
  settingsTree: vscode.TreeView<unknown>;
};

/** Create and register the three native Actions tree views. */
export function registerTreeViews(config: TreeViewConfig): RegisteredTrees {
  const workflowsTree = vscode.window.createTreeView(config.workflows.viewId, {
    treeDataProvider: config.workflows.provider,
    showCollapseAll: true,
  });
  const runsTree = vscode.window.createTreeView(config.runs.viewId, {
    treeDataProvider: config.runs.provider,
    showCollapseAll: true,
  });
  const settingsTree = vscode.window.createTreeView(config.settings.viewId, {
    treeDataProvider: config.settings.provider,
    showCollapseAll: true,
  });
  return { runsTree, workflowsTree, settingsTree };
}

export type ExpandCollapseDeps = {
  trees: RegisteredTrees;
  expanded: Set<string>;
  globalState: vscode.Memento;
  loadRunDetails: (repo: RepoRef, runId: number | string) => void;
};

/** Wire expand/collapse persistence and run-detail loading on expand. Returns disposables. */
export function wireExpandCollapsePersistence(deps: ExpandCollapseDeps): vscode.Disposable[] {
  const { trees, expanded, globalState, loadRunDetails } = deps;
  const disposables: vscode.Disposable[] = [];

  function onExpand(element: unknown): void {
    if (element instanceof RunNode) {
      loadRunDetails(element.repo, element.run.id);
    }
    updateExpandedState(expanded, globalState, element, true);
  }

  function onCollapse(element: unknown): void {
    updateExpandedState(expanded, globalState, element, false);
  }

  disposables.push(
    trees.runsTree.onDidExpandElement((e) => onExpand(e.element)),
    trees.runsTree.onDidCollapseElement((e) => onCollapse(e.element)),
    trees.workflowsTree.onDidExpandElement((e) => onExpand(e.element)),
    trees.workflowsTree.onDidCollapseElement((e) => onCollapse(e.element)),
  );

  return disposables;
}

export type SelectionToRepoSyncDeps = {
  trees: RegisteredTrees;
  setRepository: (repo: RepoRef) => void;
};

/** Wire tree selection to settings "current repo". Returns disposables. */
export function wireSelectionToRepoSync(deps: SelectionToRepoSyncDeps): vscode.Disposable[] {
  const { trees, setRepository } = deps;
  function onSelection(tree: vscode.TreeView<unknown>): vscode.Disposable {
    return tree.onDidChangeSelection((event) => {
      const repo = extractRepoFromSelection(event.selection);
      if (repo) {
        setRepository(repo);
      }
    });
  }
  return [onSelection(trees.runsTree), onSelection(trees.workflowsTree)];
}

export type RefreshAndStatusBarDeps = {
  refreshController: { scheduleNext: () => void; refreshAll: () => Promise<void> };
  settingsProvider: { getCurrentRepo: () => RepoRef | undefined };
  onSettingsChange: (listener: () => void) => vscode.Disposable;
  workspaceFoldersChange: vscode.Event<unknown>;
  trees: RegisteredTrees;
  /** Called when refresh is triggered (e.g. so consumer can schedule review comments refresh). */
  onAfterRefreshTrigger?: () => void;
};

/** Wire refresh triggers: settings change, workspace folders, tree visibility, settings tree visible (refresh secrets/vars). Returns disposables. */
export function wireRefreshAndStatusBar(deps: RefreshAndStatusBarDeps): vscode.Disposable[] {
  const {
    refreshController,
    settingsProvider,
    onSettingsChange,
    workspaceFoldersChange,
    trees,
    onAfterRefreshTrigger,
  } = deps;

  const disposables: vscode.Disposable[] = [
    onSettingsChange(() => {
      refreshController.scheduleNext();
      void refreshController.refreshAll();
      onAfterRefreshTrigger?.();
    }),
    workspaceFoldersChange(() => {
      void refreshController.refreshAll();
      onAfterRefreshTrigger?.();
    }),
    trees.runsTree.onDidChangeVisibility((e) => {
      if (e.visible) {
        void refreshController.refreshAll();
      }
    }),
    trees.workflowsTree.onDidChangeVisibility((e) => {
      if (e.visible) {
        void refreshController.refreshAll();
      }
    }),
    trees.settingsTree.onDidChangeVisibility((e) => {
      if (!e.visible) {
        return;
      }

      const repo = settingsProvider.getCurrentRepo();
      if (repo) {
        void vscode.commands.executeCommand("gitea-vs-extension.refreshSecrets", repo);
        void vscode.commands.executeCommand("gitea-vs-extension.refreshVariables", repo);
      }
    }),
  ];

  return disposables;
}
