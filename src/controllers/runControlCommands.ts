/**
 * Run control command handlers: re-run a run, re-run its failed jobs, re-run a single job.
 * Gitea exposes no cancel endpoint, so cancelling a run is deliberately absent.
 */
import type { RepoRef, WorkflowRun } from "../gitea/models";
import { normalizeLogArg, normalizeRunArg } from "../util/commandArgs";

export type RunControlCommandsDeps = {
  rerunRun: (repo: RepoRef, runId: number | string) => Promise<void>;
  rerunFailedJobs: (repo: RepoRef, runId: number | string) => Promise<void>;
  rerunJob: (repo: RepoRef, runId: number | string, jobId: number | string) => Promise<void>;
  refreshRepo: (repo: RepoRef) => Promise<void>;
  withProgress: <T>(title: string, task: () => Promise<T>) => PromiseLike<T>;
  showInformationMessage: (message: string) => void;
  showErrorMessage: (message: string) => void;
};

function runLabel(run: WorkflowRun): string {
  return run.runNumber ? `#${run.runNumber}` : `run ${run.id}`;
}

async function run(
  deps: RunControlCommandsDeps,
  repo: RepoRef,
  title: string,
  success: string,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await deps.withProgress(title, action);
    deps.showInformationMessage(success);
  } catch (error) {
    deps.showErrorMessage(error instanceof Error ? error.message : String(error));
    return;
  }
  await deps.refreshRepo(repo);
}

export async function rerunRun(deps: RunControlCommandsDeps, arg: unknown): Promise<void> {
  const target = normalizeRunArg(arg);
  if (!target) {
    deps.showInformationMessage("Select a workflow run in the tree to re-run.");
    return;
  }
  const label = runLabel(target.run);
  await run(deps, target.repo, `Re-running ${label}…`, `Re-run of ${label} requested.`, () =>
    deps.rerunRun(target.repo, target.run.id),
  );
}

export async function rerunFailedJobs(deps: RunControlCommandsDeps, arg: unknown): Promise<void> {
  const target = normalizeRunArg(arg);
  if (!target) {
    deps.showInformationMessage("Select a workflow run in the tree to re-run its failed jobs.");
    return;
  }
  const label = runLabel(target.run);
  await run(
    deps,
    target.repo,
    `Re-running failed jobs of ${label}…`,
    `Re-run of the failed jobs in ${label} requested.`,
    () => deps.rerunFailedJobs(target.repo, target.run.id),
  );
}

export async function rerunJob(deps: RunControlCommandsDeps, arg: unknown): Promise<void> {
  const target = normalizeLogArg(arg);
  if (!target) {
    deps.showInformationMessage("Select a job in the tree to re-run.");
    return;
  }
  const job = target.job;
  await run(deps, target.repo, `Re-running ${job.name}…`, `Re-run of ${job.name} requested.`, () =>
    deps.rerunJob(target.repo, target.run.id, job.id),
  );
}
