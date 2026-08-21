/**
 * Pure helpers for actions tree: root message, repo child state, filtered runs, workflow grouping.
 * No VS Code types so logic can be unit-tested with mock data. Used by actionsTreeProvider.ts.
 */
import type { RepoCacheEntry } from "../util/cache";
import {
  filterRunsByBranch,
  type BranchContext,
  type BranchFilterState,
} from "../util/branchContext";
import type { PullRequest, RepoRef, WorkflowRun } from "../gitea/models";

export type ProviderMode = "runs" | "workflows";

/** Root-level single message when not showing repos or workflow groups. */
export type RootMessage = {
  label: string;
  command?: "configureBaseUrl" | "setToken";
};

/**
 * Returns the root message to show when the root is a single message (no baseUrl, no token,
 * loading, no repos, or workflows mode with no groups). Returns null when root should show
 * repos or workflow groups.
 */
export function getRootMessage(
  hasBaseUrl: boolean,
  hasToken: boolean,
  reposLoading: boolean,
  reposCount: number,
  mode: ProviderMode,
  workflowGroupCount?: number,
): RootMessage | null {
  if (!hasBaseUrl) {
    return {
      label: "Set gitea-vs-extension.baseUrl to get started.",
      command: "configureBaseUrl",
    };
  }
  if (!hasToken) {
    return { label: "Set a token to access Gitea.", command: "setToken" };
  }
  if (reposLoading) {
    return { label: "Discovering repositories..." };
  }
  if (reposCount === 0) {
    return { label: "No repositories found." };
  }
  if (mode === "workflows" && (workflowGroupCount ?? 0) === 0) {
    return { label: "No runs yet." };
  }
  return null;
}

/** Descriptor for one workflow group (workflow name + runs). */
export type WorkflowGroupDescriptor = {
  name: string;
  runs: { repo: RepoRef; run: WorkflowRun }[];
  fallback?: boolean;
};

/**
 * Group runs by Gitea's workflow name. Instances that do not expose a workflow name remain in a
 * clearly labelled recent-runs fallback instead of being misrepresented as branch groups.
 */
export function buildWorkflowGroupDescriptors(
  entries: RepoCacheEntry[],
): WorkflowGroupDescriptor[] {
  const groups = new Map<string, { name: string; runs: { repo: RepoRef; run: WorkflowRun }[] }>();
  const unnamedRuns: { repo: RepoRef; run: WorkflowRun }[] = [];

  for (const entry of entries) {
    if (entry.error) {
      continue;
    }
    for (const run of entry.runs) {
      const workflowName = run.workflowName?.trim();
      if (!workflowName) {
        unnamedRuns.push({ repo: entry.repo, run });
        continue;
      }
      const existing = groups.get(workflowName);
      if (existing) {
        existing.runs.push({ repo: entry.repo, run });
      } else {
        groups.set(workflowName, {
          name: workflowName,
          runs: [{ repo: entry.repo, run }],
        });
      }
    }
  }

  const ordered: WorkflowGroupDescriptor[] = [...groups.values()].toSorted((a, b) => {
    const aActive = a.runs.some((e) => e.run.status === "running" || e.run.status === "queued");
    const bActive = b.runs.some((e) => e.run.status === "running" || e.run.status === "queued");
    if (aActive && !bActive) {
      return -1;
    }
    if (!aActive && bActive) {
      return 1;
    }
    const aTime = a.runs[0]?.run.updatedAt ?? a.runs[0]?.run.createdAt ?? "";
    const bTime = b.runs[0]?.run.updatedAt ?? b.runs[0]?.run.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });
  if (unnamedRuns.length > 0) {
    ordered.push({ name: "Recent runs", runs: unnamedRuns, fallback: true });
  }

  return ordered;
}

/**
 * Filter runs by branch (and when currentBranch, include runs for PRs whose head is current branch).
 */
export function getFilteredRunsForDisplay(
  entry: RepoCacheEntry,
  context: BranchContext | undefined,
  filter: BranchFilterState | undefined,
): WorkflowRun[] {
  if (!context || !filter) {
    return entry.runs;
  }
  // Copied so the PR-run merge below can never mutate the cached run list.
  const runs = [...filterRunsByBranch(entry.runs, filter, context)];

  if (filter.mode === "currentBranch" && context.status === "resolved" && context.branchName) {
    const prNumbersForCurrentBranch = new Set(
      entry.pullRequests
        .filter((pr: PullRequest) => pr.headRef === context.branchName)
        .map((pr: PullRequest) => pr.number),
    );
    const seenIds = new Set(runs.map((r) => String(r.id)));
    for (const run of entry.runs) {
      const branch = run.branch ?? "unknown";
      const prMatch = /^PR #(?<number>\d+)$/.exec(branch);
      if (
        prMatch &&
        prNumbersForCurrentBranch.has(Number(prMatch[1])) &&
        !seenIds.has(String(run.id))
      ) {
        seenIds.add(String(run.id));
        runs.push(run);
      }
    }
  }

  return runs;
}

/** Command id for message node actions (must match MessageNode action union). */
export type MessageNodeCommand = "configureBaseUrl" | "setToken" | "switchBranchFilter";

/** Result of repo-child state for runs mode: what to show under a repo. */
export type RepoChildRunsState = {
  /** Show "No data yet." */
  noEntry?: boolean;
  /** Show "Loading runs." */
  loading?: boolean;
  /** Show error node with this message */
  error?: string;
  /** Filtered runs to display */
  filteredRuns: WorkflowRun[];
  /** Optional info banner (e.g. unresolved branch) */
  infoBanner?: { label: string; command: MessageNodeCommand };
  /** When filteredRuns.length === 0, optional message to show instead of runs */
  emptyMessage?: { label: string; command: MessageNodeCommand };
  /** Whether to append an Errors section */
  hasErrorsSection: boolean;
};

/**
 * Compute repo-child state for runs mode: loading/error/empty vs filtered runs and optional messages.
 */
export function getRepoChildRunsState(
  entry: RepoCacheEntry | undefined,
  context: BranchContext | undefined,
  filter: BranchFilterState | undefined,
): RepoChildRunsState {
  if (!entry) {
    return {
      noEntry: true,
      filteredRuns: [],
      hasErrorsSection: false,
    };
  }
  if (entry.loading) {
    return {
      loading: true,
      filteredRuns: [],
      hasErrorsSection: false,
    };
  }
  if (entry.error) {
    return {
      error: entry.error,
      filteredRuns: [],
      hasErrorsSection: false,
    };
  }

  const filteredRuns = getFilteredRunsForDisplay(entry, context, filter);
  const hasErrorsSection = entry.errors.length > 0;

  const showUnresolvedInfo =
    context &&
    context.status !== "resolved" &&
    (filter?.mode === "currentBranch" || !filter) &&
    entry.runs.length > 0;
  const infoBanner: { label: string; command: MessageNodeCommand } | undefined = showUnresolvedInfo
    ? {
        label: `${context.reason ?? "Automatic current-branch filtering is unavailable."} Showing all branches. Use the branch filter to choose a specific branch.`,
        command: "switchBranchFilter",
      }
    : undefined;

  let emptyMessage: { label: string; command: MessageNodeCommand } | undefined;
  if (filteredRuns.length === 0) {
    if (
      entry.runs.length > 0 &&
      context?.status === "resolved" &&
      filter?.mode === "currentBranch"
    ) {
      emptyMessage = {
        label:
          "No workflow runs for this branch. Use the branch filter to view other branches or all branches.",
        command: "switchBranchFilter",
      };
    } else if (entry.runs.length === 0) {
      emptyMessage = {
        label:
          "No workflow runs found for this branch. Switch to another branch or all branches to see existing runs.",
        command: "switchBranchFilter",
      };
    }
  }

  return {
    filteredRuns,
    infoBanner,
    emptyMessage,
    hasErrorsSection,
  };
}

/**
 * Human-readable branch filter description for repo node (e.g. "all branches", "current: main").
 */
export function getBranchFilterDescription(
  mode: ProviderMode,
  context: BranchContext | undefined,
  filter: BranchFilterState | undefined,
): string | undefined {
  if (!context || !filter) {
    return undefined;
  }
  if (filter.mode === "allBranches") {
    return "all branches";
  }
  if (filter.mode === "specificBranch" && filter.branchName !== undefined) {
    return `branch: ${filter.branchName}`;
  }
  if (filter.mode === "currentBranch" && context.status === "resolved" && context.branchName) {
    return `current: ${context.branchName}`;
  }
  return undefined;
}
