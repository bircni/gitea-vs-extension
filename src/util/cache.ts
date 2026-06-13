import type { Artifact, Job, PullRequest, RepoRef, RepoStatus, WorkflowRun } from "../gitea/models";
import type { BranchContext, BranchFilterState } from "./branchContext";

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
  private readonly branchContextByRepo = new Map<string, BranchContext>();
  private readonly branchFilterByRepo = new Map<string, BranchFilterState>();
  private workspaceFolderByRepo = new Map<string, string>();

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

  setWorkspaceFolders(repoToFolderPath: Map<string, string>): void {
    this.workspaceFolderByRepo = new Map(repoToFolderPath);
  }

  getWorkspaceFolderPath(repo: RepoRef): string | undefined {
    return this.workspaceFolderByRepo.get(this.key(repo));
  }

  getBranchContext(repo: RepoRef): BranchContext | undefined {
    return this.branchContextByRepo.get(this.key(repo));
  }

  setBranchContext(context: BranchContext): void {
    this.branchContextByRepo.set(this.key(context.repo), context);
  }

  getBranchFilter(repo: RepoRef): BranchFilterState | undefined {
    return this.branchFilterByRepo.get(this.key(repo));
  }

  setBranchFilter(filter: BranchFilterState): void {
    this.branchFilterByRepo.set(this.key(filter.repo), filter);
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
    return [...this.entries.values()];
  }

  private key(repo: RepoRef): string {
    return `${repo.host}/${repo.owner}/${repo.name}`;
  }
}
