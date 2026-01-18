import type { Artifact, Job, PullRequest, RepoRef, RepoStatus, WorkflowRun } from "../gitea/models";

export type LoadState = "unloaded" | "loading" | "idle" | "error";

export type RepoCacheEntry = {
  repo: RepoRef;
  runs: WorkflowRun[];
  jobsByRun: Map<string, Job[]>;
  jobsStateByRun: Map<string, LoadState>;
  jobsErrorByRun: Map<string, string | undefined>;
  artifactsByRun: Map<string, Artifact[]>;
  artifactsStateByRun: Map<string, LoadState>;
  artifactsErrorByRun: Map<string, string | undefined>;
  pullRequests: PullRequest[];
  errors: string[];
  repoStatus?: RepoStatus;
  error?: string;
  lastUpdated?: number;
  loading: boolean;
};

export class RepoStateStore {
  private repos: RepoRef[] = [];
  private entries = new Map<string, RepoCacheEntry>();
  private loadingRepos = false;

  setRepos(repos: RepoRef[]): void {
    this.repos = repos;
    const nextEntries = new Map<string, RepoCacheEntry>();

    for (const repo of repos) {
      const key = this.key(repo);
      const existing = this.entries.get(key);
      nextEntries.set(
        key,
        existing ?? {
          repo,
          runs: [],
          jobsByRun: new Map(),
          jobsStateByRun: new Map(),
          jobsErrorByRun: new Map(),
          artifactsByRun: new Map(),
          artifactsStateByRun: new Map(),
          artifactsErrorByRun: new Map(),
          pullRequests: [],
          errors: [],
          loading: false,
        },
      );
    }

    this.entries = nextEntries;
  }

  getRepos(): RepoRef[] {
    return this.repos;
  }

  setReposLoading(isLoading: boolean): void {
    this.loadingRepos = isLoading;
  }

  isReposLoading(): boolean {
    return this.loadingRepos;
  }

  getEntry(repo: RepoRef): RepoCacheEntry | undefined {
    return this.entries.get(this.key(repo));
  }

  updateEntry(repo: RepoRef, updater: (entry: RepoCacheEntry) => void): void {
    const key = this.key(repo);
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }
    updater(entry);
  }

  getEntries(): RepoCacheEntry[] {
    return Array.from(this.entries.values());
  }

  private key(repo: RepoRef): string {
    return `${repo.host}/${repo.owner}/${repo.name}`;
  }
}
