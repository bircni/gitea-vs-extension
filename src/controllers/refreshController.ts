import { getSettings } from "../config/settings";
import type { RepoStateStore } from "../util/cache";
import { getCurrentBranchInFolder } from "../util/git";
import { createLimiter } from "../util/limiter";
import type { Logger } from "../util/logging";
import {
  buildBranchContext,
  buildRunDetailMapsForRuns,
  computeRefreshSummary,
  formatRefreshError,
  getInitialBranchFilterMode,
  mergeRunsById,
  nextEntryErrorState,
  nextEntryLoadingState,
  nextEntrySuccessState,
  resolveBranchFetch,
  type RefreshSummary,
} from "../util/refreshHelpers";
import type { GiteaApi } from "../gitea/api";
import type { RepoDiscovery } from "../gitea/discovery";
import type { PullRequest, RepoRef } from "../gitea/models";
import { resolveWorkspaceRepos } from "../util/repoResolution";

export type { RefreshSummary } from "../util/refreshHelpers";

export class RefreshController {
  private timer?: NodeJS.Timeout;
  /** In-flight full refresh; concurrent callers await the same promise (see `refreshAll`). */
  private refreshAllInFlight?: Promise<void>;
  private readonly limiter = createLimiter(4);

  constructor(
    private readonly api: GiteaApi,
    private readonly store: RepoStateStore,
    private readonly discovery: RepoDiscovery,
    private readonly logger: Logger,
    private readonly onDidUpdate: () => void,
    private readonly onSummary: (summary: RefreshSummary) => void,
  ) {}

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  async refreshAll(): Promise<void> {
    if (this.refreshAllInFlight) {
      return this.refreshAllInFlight;
    }
    this.refreshAllInFlight = this.runRefreshAll();
    try {
      await this.refreshAllInFlight;
    } finally {
      this.refreshAllInFlight = undefined;
    }
  }

  private async runRefreshAll(): Promise<void> {
    const hadRepos = this.store.getRepos().length > 0;
    if (!hadRepos) {
      this.store.setReposLoading(true);
      this.onDidUpdate();
    }

    try {
      const settings = getSettings();
      let repos: RepoRef[] = [];
      let discoverySucceeded = true;

      try {
        repos = await this.discovery.discoverRepos(settings.discoveryMode, settings.baseUrl);
      } catch (error) {
        discoverySucceeded = false;
        this.logger.warn(`Repository discovery failed: ${formatRefreshError(error)}`);
      }

      // Keep previously discovered repositories visible when discovery fails transiently. They can
      // still be refreshed individually, while replacing the store with an empty list would make
      // a network outage look like the user has no repositories.
      if (discoverySucceeded) {
        this.store.setRepos(repos);
      } else {
        repos = this.store.getRepos();
      }

      try {
        const discoveredRepoKeys = new Set(repos.map((repo) => repoKey(repo)));
        const workspaceRepos = await resolveWorkspaceRepos(settings.baseUrl);
        const repoToFolder = new Map<string, string>();
        for (const { repo, folder } of workspaceRepos) {
          const key = repoKey(repo);
          if (discoveredRepoKeys.has(key)) {
            repoToFolder.set(key, folder.uri.fsPath);
          }
        }
        this.store.setWorkspaceFolders(repoToFolder);
      } catch (error) {
        this.logger.debug(`Workspace repo resolution failed: ${formatRefreshError(error)}`);
      }

      await this.updateBranchContextsForRepos(repos);
      this.store.setReposLoading(false);
      if (!hadRepos) {
        this.onDidUpdate();
      }

      await Promise.all(repos.map((repo) => this.refreshRepo(repo, settings.maxRunsPerRepo)));

      this.updateSummary();
    } finally {
      this.scheduleNext();
    }
  }

  async refreshRepo(repo: RepoRef, limit: number): Promise<void> {
    const folderPath = this.store.getWorkspaceFolderPath(repo);
    const branchResult = folderPath ? await getCurrentBranchInFolder(folderPath) : null;
    const context = buildBranchContext(repo, folderPath ?? undefined, branchResult);
    this.store.setBranchContext(context);
    if (this.store.getBranchFilter(repo) === undefined) {
      this.store.setBranchFilter({ repo, mode: getInitialBranchFilterMode(context) });
    }

    const existing = this.store.getEntry(repo);
    const hasData =
      existing !== undefined && (existing.runs.length > 0 || existing.pullRequests.length > 0);
    const loadingState = nextEntryLoadingState(hasData);
    this.store.updateEntry(repo, (entry) => {
      entry.loading = loadingState.loading;
      entry.error = loadingState.error;
    });
    if (!hasData) {
      this.onDidUpdate();
    }

    try {
      const allBranchesRuns = await this.limiter(() => this.api.listRuns(repo, limit));
      // The all-branches fetch only covers the most-recent `limit` runs across every branch, so a
      // less-active branch (e.g. the current one) can be crowded out. When a specific branch is in
      // effect, fetch its runs directly from the server and merge so that view shows the full set.
      const branchToFetch = resolveBranchFetch(context, this.store.getBranchFilter(repo));
      let runs = allBranchesRuns;
      if (branchToFetch) {
        try {
          const branchRuns = await this.limiter(() =>
            this.api.listRuns(repo, limit, branchToFetch),
          );
          runs = mergeRunsById(allBranchesRuns, branchRuns);
        } catch (error) {
          this.logger.debug(
            `Failed to load branch runs for ${repo.owner}/${repo.name} (${branchToFetch}): ${formatRefreshError(error)}`,
          );
        }
      }
      this.store.updateEntry(repo, (entry) => {
        entry.runs = runs;
      });

      if (runs.length > 0) {
        const latestRun = runs[0];
        const sha = latestRun.sha;
        if (sha) {
          try {
            const status = await this.limiter(() => this.api.getCombinedStatus(repo, sha));
            this.store.updateEntry(repo, (entry) => {
              entry.repoStatus = status;
            });
          } catch (error) {
            this.logger.debug(
              `Failed to load repo status for ${repo.owner}/${repo.name}: ${formatRefreshError(error)}`,
            );
          }
        }
      }

      let pullRequests: PullRequest[] = [];
      try {
        pullRequests = await this.limiter(() => this.api.listPullRequests(repo));
      } catch (error) {
        const prError = formatRefreshError(error);
        this.recordError(repo, `Pull requests: ${prError}`);
        this.logger.debug(
          `Failed to load pull requests for ${repo.owner}/${repo.name}: ${prError}`,
        );
      }

      this.store.updateEntry(repo, (entry) => {
        const maps = buildRunDetailMapsForRuns(runs, entry);
        entry.jobsByRun = maps.jobsByRun;
        entry.jobsStateByRun = maps.jobsStateByRun;
        entry.jobsErrorByRun = maps.jobsErrorByRun;
        entry.artifactsByRun = maps.artifactsByRun;
        entry.artifactsStateByRun = maps.artifactsStateByRun;
        entry.artifactsErrorByRun = maps.artifactsErrorByRun;
        entry.pullRequests = pullRequests;
        entry.lastUpdated = Date.now();
        const success = nextEntrySuccessState();
        entry.loading = success.loading;
        entry.error = success.error;
      });
    } catch (error) {
      const message = formatRefreshError(error);
      this.logger.warn(`Failed to refresh ${repo.owner}/${repo.name}: ${message}`);
      const errState = nextEntryErrorState(message);
      this.store.updateEntry(repo, (entry) => {
        entry.error = errState.error;
        entry.loading = errState.loading;
      });
      this.recordError(repo, message);
    }

    this.onDidUpdate();
  }

  async loadRunDetails(repo: RepoRef, runId: number | string): Promise<void> {
    const runKey = String(runId);
    const settings = getSettings();

    this.store.updateEntry(repo, (entry) => {
      entry.jobsStateByRun.set(runKey, "loading");
      entry.jobsErrorByRun.set(runKey, undefined);
      entry.artifactsStateByRun.set(runKey, "loading");
      entry.artifactsErrorByRun.set(runKey, undefined);
    });
    this.onDidUpdate();

    try {
      const jobs = await this.limiter(() => this.api.listJobs(repo, runId, settings.maxJobsPerRun));
      const artifacts = await this.limiter(() => this.api.listArtifacts(repo, runId));
      this.store.updateEntry(repo, (entry) => {
        entry.jobsByRun.set(runKey, jobs);
        entry.jobsStateByRun.set(runKey, "idle");
        entry.jobsErrorByRun.set(runKey, undefined);
        entry.artifactsByRun.set(runKey, artifacts);
        entry.artifactsStateByRun.set(runKey, "idle");
        entry.artifactsErrorByRun.set(runKey, undefined);
      });
    } catch (error) {
      const message = formatRefreshError(error);
      this.logger.debug(
        `Failed to load run details for ${repo.owner}/${repo.name} run ${runId}: ${message}`,
      );
      this.store.updateEntry(repo, (entry) => {
        entry.jobsStateByRun.set(runKey, "error");
        entry.jobsErrorByRun.set(runKey, message);
        entry.artifactsStateByRun.set(runKey, "error");
        entry.artifactsErrorByRun.set(runKey, message);
      });
    }

    this.onDidUpdate();
  }

  private async updateBranchContextsForRepos(repos: RepoRef[]): Promise<void> {
    for (const repo of repos) {
      const folderPath = this.store.getWorkspaceFolderPath(repo);
      const branchResult = folderPath ? await getCurrentBranchInFolder(folderPath) : null;
      const context = buildBranchContext(repo, folderPath ?? undefined, branchResult);
      this.logger.debug(
        `Branch context for ${repo.owner}/${repo.name}: ${context.status}${context.branchName ? ` (${context.branchName})` : ""}${context.reason ? ` - ${context.reason}` : ""}`,
      );
      this.store.setBranchContext(context);
      if (this.store.getBranchFilter(repo) === undefined) {
        this.store.setBranchFilter({ repo, mode: getInitialBranchFilterMode(context) });
      }
    }
  }

  scheduleNext(): void {
    const settings = getSettings();
    const intervalMs = this.isAnythingRunning()
      ? settings.runningRefreshSeconds * 1000
      : settings.idleRefreshSeconds * 1000;

    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      void this.refreshAll();
    }, intervalMs);
  }

  private isAnythingRunning(): boolean {
    return this.store
      .getEntries()
      .some((entry) =>
        entry.runs.some((run) => run.status === "running" || run.status === "queued"),
      );
  }

  private updateSummary(): void {
    this.onSummary(computeRefreshSummary(this.store.getEntries()));
  }

  private recordError(repo: RepoRef, message: string): void {
    this.store.updateEntry(repo, (entry) => {
      const next = [message, ...entry.errors].slice(0, 10);
      entry.errors = next;
    });
  }
}

function repoKey(repo: RepoRef): string {
  return `${repo.host}/${repo.owner}/${repo.name}`;
}
