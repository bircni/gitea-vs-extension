import { getSettings } from "../config/settings";
import type { RepoStateStore } from "../util/cache";
import { createLimiter } from "../util/limiter";
import type { Logger } from "../util/logging";
import { EndpointError, type GiteaApi } from "../gitea/api";
import { HttpError } from "../gitea/client";
import type { RepoDiscovery } from "../gitea/discovery";
import type { Artifact, Job, PullRequest, RepoRef } from "../gitea/models";
import type { NotificationStore } from "../util/notificationStore";

export type RefreshSummary = {
  runningCount: number;
  failedCount: number;
};

export class RefreshController {
  private timer?: NodeJS.Timeout;
  private refreshInProgress = false;
  private readonly limiter = createLimiter(4);

  constructor(
    private readonly api: GiteaApi,
    private readonly store: RepoStateStore,
    private readonly notifications: NotificationStore,
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
    if (this.refreshInProgress) {
      return;
    }

    this.refreshInProgress = true;
    const hadRepos = this.store.getRepos().length > 0;
    if (!hadRepos) {
      this.store.setReposLoading(true);
      this.onDidUpdate();
    }

    try {
      const settings = getSettings();
      let repos: RepoRef[] = [];

      try {
        repos = await this.discovery.discoverRepos(settings.discoveryMode, settings.baseUrl);
      } catch (error) {
        this.logger.warn(`Repository discovery failed: ${formatError(error)}`);
      }

      this.store.setRepos(repos);
      this.store.setReposLoading(false);
      if (!hadRepos) {
        this.onDidUpdate();
      }

      await Promise.all([
        ...repos.map((repo) => this.refreshRepo(repo, settings.maxRunsPerRepo)),
        this.refreshNotifications(),
      ]);

      this.updateSummary();
    } finally {
      this.refreshInProgress = false;
      this.scheduleNext();
    }
  }

  async refreshRepo(repo: RepoRef, limit: number): Promise<void> {
    const existing = this.store.getEntry(repo);
    const hasData =
      existing !== undefined && (existing.runs.length > 0 || existing.pullRequests.length > 0);
    this.store.updateEntry(repo, (entry) => {
      entry.loading = true;
      entry.error = undefined;
      if (hasData) {
        entry.loading = false;
      }
    });
    if (!hasData) {
      this.onDidUpdate();
    }

    try {
      const runs = await this.limiter(() => this.api.listRuns(repo, limit));
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
              `Failed to load repo status for ${repo.owner}/${repo.name}: ${formatError(error)}`,
            );
          }
        }
      }

      let pullRequests: PullRequest[] = [];
      try {
        pullRequests = await this.limiter(() => this.api.listPullRequests(repo));
      } catch (error) {
        this.recordError(repo, `Pull requests: ${formatError(error)}`);
        this.logger.debug(
          `Failed to load pull requests for ${repo.owner}/${repo.name}: ${formatError(error)}`,
        );
      }

      this.store.updateEntry(repo, (entry) => {
        const nextJobsByRun = new Map<string, Job[]>();
        const nextJobsStateByRun = new Map<string, "unloaded" | "loading" | "idle" | "error">();
        const nextJobsErrorByRun = new Map<string, string | undefined>();
        const nextArtifactsByRun = new Map<string, Artifact[]>();
        const nextArtifactsStateByRun = new Map<
          string,
          "unloaded" | "loading" | "idle" | "error"
        >();
        const nextArtifactsErrorByRun = new Map<string, string | undefined>();

        for (const run of runs) {
          const runKey = String(run.id);
          nextJobsByRun.set(runKey, entry.jobsByRun.get(runKey) ?? []);
          nextJobsStateByRun.set(runKey, entry.jobsStateByRun.get(runKey) ?? "unloaded");
          nextJobsErrorByRun.set(runKey, entry.jobsErrorByRun.get(runKey));

          nextArtifactsByRun.set(runKey, entry.artifactsByRun.get(runKey) ?? []);
          nextArtifactsStateByRun.set(runKey, entry.artifactsStateByRun.get(runKey) ?? "unloaded");
          nextArtifactsErrorByRun.set(runKey, entry.artifactsErrorByRun.get(runKey));
        }

        entry.jobsByRun = nextJobsByRun;
        entry.jobsStateByRun = nextJobsStateByRun;
        entry.jobsErrorByRun = nextJobsErrorByRun;
        entry.artifactsByRun = nextArtifactsByRun;
        entry.artifactsStateByRun = nextArtifactsStateByRun;
        entry.artifactsErrorByRun = nextArtifactsErrorByRun;
        entry.pullRequests = pullRequests;
        entry.lastUpdated = Date.now();
        entry.loading = false;
      });
    } catch (error) {
      const message = formatError(error);
      this.logger.warn(`Failed to refresh ${repo.owner}/${repo.name}: ${message}`);
      this.store.updateEntry(repo, (entry) => {
        entry.error = message;
        entry.loading = false;
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
      const message = formatError(error);
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

  async refreshNotifications(): Promise<void> {
    this.notifications.setLoading(true);
    this.notifications.setError(undefined);
    this.onDidUpdate();

    try {
      const list = await this.api.listNotifications();
      this.notifications.setNotifications(list);
      this.notifications.setLoading(false);
    } catch (error) {
      this.notifications.setError(formatError(error));
      this.notifications.setLoading(false);
    }

    this.onDidUpdate();
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
    const summary = this.computeSummary();
    this.onSummary(summary);
  }

  private computeSummary(): RefreshSummary {
    let runningCount = 0;
    let failedCount = 0;

    for (const entry of this.store.getEntries()) {
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

  private recordError(repo: RepoRef, message: string): void {
    this.store.updateEntry(repo, (entry) => {
      const next = [message, ...entry.errors].slice(0, 10);
      entry.errors = next;
    });
  }
}

function formatError(error: unknown): string {
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
