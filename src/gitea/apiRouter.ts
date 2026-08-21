import type { ActionVariable, GiteaApi, Secret } from "./api";
import type {
  Artifact,
  Job,
  PullRequest,
  PullRequestReview,
  PullRequestReviewComment,
  RepoRef,
  RepoStatus,
  WorkflowRun,
} from "./models";

/** Routes repository requests to the API client configured for that repository's Gitea host. */
export class GiteaApiRouter {
  constructor(
    private readonly getApi: (baseUrl: string) => GiteaApi,
    private readonly getBaseUrls: () => readonly string[],
  ) {}

  async testConnection(baseUrl: string): Promise<string> {
    return this.getApi(baseUrl).testConnection();
  }
  async listAccessibleRepos(): Promise<RepoRef[]> {
    const repos = await Promise.all(
      this.getBaseUrls().map((url) => this.getApi(url).listAccessibleRepos()),
    );
    return repos.flat();
  }
  fetchBinaryUrl(url: string): Promise<Uint8Array> {
    const baseUrl = this.getBaseUrls().find((candidate) => {
      try {
        return new URL(candidate).origin === new URL(url).origin;
      } catch {
        return false;
      }
    });
    if (!baseUrl) {
      throw new Error("No configured Gitea instance matches this URL.");
    }
    return this.getApi(baseUrl).fetchBinaryUrl(url);
  }
  listRuns(repo: RepoRef, limit: number, branch?: string): Promise<WorkflowRun[]> {
    return this.forRepo(repo).listRuns(repo, limit, branch);
  }
  listJobs(repo: RepoRef, runId: number | string, limit?: number): Promise<Job[]> {
    return this.forRepo(repo).listJobs(repo, runId, limit);
  }
  getJobLogs(repo: RepoRef, jobId: number | string): Promise<string> {
    return this.forRepo(repo).getJobLogs(repo, jobId);
  }
  rerunRun(repo: RepoRef, runId: number | string): Promise<void> {
    return this.forRepo(repo).rerunRun(repo, runId);
  }
  rerunFailedJobs(repo: RepoRef, runId: number | string): Promise<void> {
    return this.forRepo(repo).rerunFailedJobs(repo, runId);
  }
  rerunJob(repo: RepoRef, runId: number | string, jobId: number | string): Promise<void> {
    return this.forRepo(repo).rerunJob(repo, runId, jobId);
  }
  listArtifacts(repo: RepoRef, runId: number | string): Promise<Artifact[]> {
    return this.forRepo(repo).listArtifacts(repo, runId);
  }
  downloadArtifactToFile(
    repo: RepoRef,
    runId: number | string,
    artifact: Artifact,
    baseDir: string,
  ): Promise<string> {
    return this.forRepo(repo).downloadArtifactToFile(repo, runId, artifact, baseDir);
  }
  listPullRequests(repo: RepoRef): Promise<PullRequest[]> {
    return this.forRepo(repo).listPullRequests(repo);
  }
  listPullRequestReviews(repo: RepoRef, number: number): Promise<PullRequestReview[]> {
    return this.forRepo(repo).listPullRequestReviews(repo, number);
  }
  listPullRequestReviewComments(
    repo: RepoRef,
    number: number,
    reviewId: number | string,
  ): Promise<PullRequestReviewComment[]> {
    return this.forRepo(repo).listPullRequestReviewComments(repo, number, reviewId);
  }
  createPullRequestReviewComment(
    repo: RepoRef,
    number: number,
    options: { body: string; path: string; line: number; commitId?: string },
  ): Promise<void> {
    return this.forRepo(repo).createPullRequestReviewComment(repo, number, options);
  }
  getPullRequestDiff(repo: RepoRef, number: number): Promise<string> {
    return this.forRepo(repo).getPullRequestDiff(repo, number);
  }
  getCombinedStatus(repo: RepoRef, ref: string): Promise<RepoStatus> {
    return this.forRepo(repo).getCombinedStatus(repo, ref);
  }
  listSecrets(repo: RepoRef): Promise<Secret[]> {
    return this.forRepo(repo).listSecrets(repo);
  }
  createOrUpdateSecret(
    repo: RepoRef,
    name: string,
    data: string,
    description?: string,
  ): Promise<void> {
    return this.forRepo(repo).createOrUpdateSecret(repo, name, data, description);
  }
  deleteSecret(repo: RepoRef, name: string): Promise<void> {
    return this.forRepo(repo).deleteSecret(repo, name);
  }
  listVariables(repo: RepoRef): Promise<ActionVariable[]> {
    return this.forRepo(repo).listVariables(repo);
  }
  createVariable(repo: RepoRef, name: string, value: string, description?: string): Promise<void> {
    return this.forRepo(repo).createVariable(repo, name, value, description);
  }
  updateVariable(
    repo: RepoRef,
    name: string,
    value: string,
    description?: string,
    newName?: string,
  ): Promise<void> {
    return this.forRepo(repo).updateVariable(repo, name, value, description, newName);
  }
  deleteVariable(repo: RepoRef, name: string): Promise<void> {
    return this.forRepo(repo).deleteVariable(repo, name);
  }

  private forRepo(repo: RepoRef): GiteaApi {
    const baseUrl = this.getBaseUrls().find((url) => {
      try {
        return new URL(url).host.toLowerCase() === repo.host.toLowerCase();
      } catch {
        return false;
      }
    });
    if (!baseUrl) {
      throw new Error(`No Gitea instance is configured for ${repo.host}.`);
    }
    return this.getApi(baseUrl);
  }
}
