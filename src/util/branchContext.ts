import type { RepoRef, WorkflowRun } from "../gitea/models";

/**
 * Status of branch resolution for a repository.
 * Aligned with data-model.md BranchContext.
 */
export type BranchContextStatus = "resolved" | "unresolved" | "detached" | "noRepo";

/**
 * Represents the branch considered "current" for a given repository and user context.
 */
export type BranchContext = {
  repo: RepoRef;
  branchName: string | null;
  status: BranchContextStatus;
  reason?: string;
};

/**
 * Filter mode for the workflows view.
 */
export type BranchFilterMode = "currentBranch" | "allBranches" | "specificBranch";

/**
 * Current branch filter applied in the workflows view for a repository.
 */
export type BranchFilterState = {
  repo: RepoRef;
  mode: BranchFilterMode;
  branchName?: string;
};

/**
 * Effective filter for computing which runs to show.
 * - currentBranch: show only runs for branchContext.branchName (when resolved)
 * - allBranches: show all runs
 * - specificBranch: show only runs for filter.branchName
 */
export function filterRunsByBranch(
  runs: WorkflowRun[],
  filter: BranchFilterState,
  branchContext: BranchContext,
): WorkflowRun[] {
  if (filter.mode === "allBranches") {
    return runs;
  }
  if (filter.mode === "specificBranch" && filter.branchName !== undefined) {
    return runs.filter((r) => (r.branch ?? "unknown") === filter.branchName);
  }
  // currentBranch: use branchContext.branchName when resolved
  if (branchContext.status === "resolved" && branchContext.branchName !== null) {
    return runs.filter((r) => (r.branch ?? "unknown") === branchContext.branchName);
  }
  // Fallback when current branch not resolved: show all
  return runs;
}
