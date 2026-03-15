/**
 * Pure helpers for refresh logic: branch context, state transitions, summary, error formatting.
 * Used by refreshController.ts for testable logic without I/O or store access.
 */
import { EndpointError } from "../gitea/api";
import { HttpError } from "../gitea/client";
import type { Artifact, Job, RepoRef, WorkflowRun } from "../gitea/models";
import type { BranchContext, BranchContextStatus } from "./branchContext";
import type { LoadState, RepoCacheEntry } from "./cache";

export type RefreshSummary = {
  runningCount: number;
  failedCount: number;
};

export type BranchResult = {
  branchName: string | null;
  status: BranchContextStatus;
  reason?: string;
};

/**
 * Build branch context from repo, optional folder path, and optional branch resolution result.
 * When folderPath is undefined, returns noRepo context. Otherwise uses branchResult when present.
 */
export function buildBranchContext(
  repo: RepoRef,
  folderPath: string | undefined,
  branchResult: BranchResult | null,
): BranchContext {
  if (!folderPath || !branchResult) {
    return {
      repo,
      branchName: null,
      status: "noRepo",
      reason: folderPath ? "Branch not resolved" : "No workspace folder for this repository",
    };
  }
  return {
    repo,
    branchName: branchResult.branchName,
    status: branchResult.status,
    reason: branchResult.reason,
  };
}

/**
 * Initial branch filter mode when none is set: currentBranch if context is resolved, else allBranches.
 */
export function getInitialBranchFilterMode(
  context: BranchContext,
): "currentBranch" | "allBranches" {
  return context.status === "resolved" ? "currentBranch" : "allBranches";
}

/**
 * Compute refresh summary (running and failed counts) from store entries.
 */
export function computeRefreshSummary(entries: { runs: WorkflowRun[] }[]): RefreshSummary {
  let runningCount = 0;
  let failedCount = 0;
  for (const entry of entries) {
    for (const run of entry.runs) {
      if (run.status === "running" || run.status === "queued") {
        runningCount += 1;
      }
      if (run.conclusion === "failure") {
        failedCount += 1;
      }
    }
  }
  return { runningCount, failedCount };
}

/**
 * Build run-detail maps (jobs, artifacts, states) for a new runs list, preserving existing data per run.
 */
export function buildRunDetailMapsForRuns(
  runs: WorkflowRun[],
  previousEntry: RepoCacheEntry,
): {
  jobsByRun: Map<string, Job[]>;
  jobsStateByRun: Map<string, LoadState>;
  jobsErrorByRun: Map<string, string | undefined>;
  artifactsByRun: Map<string, Artifact[]>;
  artifactsStateByRun: Map<string, LoadState>;
  artifactsErrorByRun: Map<string, string | undefined>;
} {
  const nextJobsByRun = new Map<string, Job[]>();
  const nextJobsStateByRun = new Map<string, LoadState>();
  const nextJobsErrorByRun = new Map<string, string | undefined>();
  const nextArtifactsByRun = new Map<string, Artifact[]>();
  const nextArtifactsStateByRun = new Map<string, LoadState>();
  const nextArtifactsErrorByRun = new Map<string, string | undefined>();

  for (const run of runs) {
    const runKey = String(run.id);
    nextJobsByRun.set(runKey, previousEntry.jobsByRun.get(runKey) ?? []);
    nextJobsStateByRun.set(runKey, previousEntry.jobsStateByRun.get(runKey) ?? "unloaded");
    nextJobsErrorByRun.set(runKey, previousEntry.jobsErrorByRun.get(runKey));
    nextArtifactsByRun.set(runKey, previousEntry.artifactsByRun.get(runKey) ?? []);
    nextArtifactsStateByRun.set(
      runKey,
      previousEntry.artifactsStateByRun.get(runKey) ?? "unloaded",
    );
    nextArtifactsErrorByRun.set(runKey, previousEntry.artifactsErrorByRun.get(runKey));
  }

  return {
    jobsByRun: nextJobsByRun,
    jobsStateByRun: nextJobsStateByRun,
    jobsErrorByRun: nextJobsErrorByRun,
    artifactsByRun: nextArtifactsByRun,
    artifactsStateByRun: nextArtifactsStateByRun,
    artifactsErrorByRun: nextArtifactsErrorByRun,
  };
}

/**
 * Format an error for display and logging (no sensitive data).
 */
export function formatRefreshError(error: unknown): string {
  if (error instanceof EndpointError) {
    return error.message;
  }
  if (error instanceof HttpError) {
    if (error.status === 401) {
      return "Unauthorized. Set a valid token.";
    }
    if (error.status === 403) {
      return "Insufficient permission to access Actions.";
    }
    if (error.status === 404) {
      return "Actions endpoint not supported by this Gitea version.";
    }
    return `HTTP ${error.status}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

/**
 * Next entry loading/error state after a refresh attempt.
 */
export function nextEntryLoadingState(hasData: boolean): { loading: boolean; error: undefined } {
  return { loading: !hasData, error: undefined };
}

/**
 * Next entry state on refresh success (loading false, error cleared).
 */
export function nextEntrySuccessState(): { loading: boolean; error: undefined } {
  return { loading: false, error: undefined };
}

/**
 * Next entry state on refresh error.
 */
export function nextEntryErrorState(message: string): { loading: boolean; error: string } {
  return { loading: false, error: message };
}
