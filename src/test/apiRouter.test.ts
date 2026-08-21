import { GiteaApiRouter } from "../gitea/apiRouter";
import type { RepoRef } from "../gitea/models";

const repo: RepoRef = { host: "gitea.example:3000", owner: "octo", name: "demo" };

function createApi() {
  return {
    testConnection: vi.fn().mockResolvedValue("1.27.2"),
    listAccessibleRepos: vi.fn().mockResolvedValue([repo]),
    fetchBinaryUrl: vi.fn().mockResolvedValue(new Uint8Array([1])),
    listRuns: vi.fn().mockResolvedValue([]),
    listJobs: vi.fn().mockResolvedValue([]),
    getJobLogs: vi.fn().mockResolvedValue("logs"),
    rerunRun: vi.fn().mockResolvedValue(undefined),
    rerunFailedJobs: vi.fn().mockResolvedValue(undefined),
    rerunJob: vi.fn().mockResolvedValue(undefined),
    listArtifacts: vi.fn().mockResolvedValue([]),
    downloadArtifactToFile: vi.fn().mockResolvedValue("/tmp/artifact.zip"),
    listPullRequests: vi.fn().mockResolvedValue([]),
    listPullRequestReviews: vi.fn().mockResolvedValue([]),
    listPullRequestReviewComments: vi.fn().mockResolvedValue([]),
    createPullRequestReviewComment: vi.fn().mockResolvedValue(undefined),
    getPullRequestDiff: vi.fn().mockResolvedValue("diff"),
    getCombinedStatus: vi.fn().mockResolvedValue({ state: "success" }),
    listSecrets: vi.fn().mockResolvedValue([]),
    createOrUpdateSecret: vi.fn().mockResolvedValue(undefined),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
    listVariables: vi.fn().mockResolvedValue([]),
    createVariable: vi.fn().mockResolvedValue(undefined),
    updateVariable: vi.fn().mockResolvedValue(undefined),
    deleteVariable: vi.fn().mockResolvedValue(undefined),
  };
}

describe("GiteaApiRouter", () => {
  it("routes every repository operation to the matching configured instance", async () => {
    const api = createApi();
    const router = new GiteaApiRouter(
      () => api as never,
      () => ["https://gitea.example:3000", "https://other.example"],
    );

    await router.testConnection("https://gitea.example:3000");
    await router.listRuns(repo, 20, "main");
    await router.listJobs(repo, 1, 50);
    await router.getJobLogs(repo, 2);
    await router.rerunRun(repo, 1);
    await router.rerunFailedJobs(repo, 1);
    await router.rerunJob(repo, 1, 2);
    await router.listArtifacts(repo, 1);
    await router.downloadArtifactToFile(repo, 1, { id: 1, name: "artifact" }, "/tmp");
    await router.listPullRequests(repo);
    await router.listPullRequestReviews(repo, 3);
    await router.listPullRequestReviewComments(repo, 3, 4);
    await router.createPullRequestReviewComment(repo, 3, {
      body: "looks good",
      path: "README.md",
      line: 1,
    });
    await router.getPullRequestDiff(repo, 3);
    await router.getCombinedStatus(repo, "abc123");
    await router.listSecrets(repo);
    await router.createOrUpdateSecret(repo, "TOKEN", "value", "description");
    await router.deleteSecret(repo, "TOKEN");
    await router.listVariables(repo);
    await router.createVariable(repo, "NAME", "value", "description");
    await router.updateVariable(repo, "NAME", "value", "description", "RENAMED");
    await router.deleteVariable(repo, "NAME");

    expect(api.listRuns).toHaveBeenCalledWith(repo, 20, "main");
    expect(api.rerunJob).toHaveBeenCalledWith(repo, 1, 2);
    expect(api.createPullRequestReviewComment).toHaveBeenCalledWith(repo, 3, {
      body: "looks good",
      path: "README.md",
      line: 1,
    });
    expect(api.updateVariable).toHaveBeenCalledWith(
      repo,
      "NAME",
      "value",
      "description",
      "RENAMED",
    );
  });

  it("queries all configured instances and uses origin matching for absolute binary URLs", async () => {
    const first = createApi();
    const second = createApi();
    const getApi = vi.fn((baseUrl: string) =>
      baseUrl === "https://gitea.example:3000" ? first : second,
    );
    const router = new GiteaApiRouter(getApi as never, () => [
      "https://gitea.example:3000",
      "https://other.example",
    ]);

    const repos = await router.listAccessibleRepos();
    await router.fetchBinaryUrl("https://other.example/api/artifacts/1");

    expect(repos).toEqual([repo, repo]);
    expect(second.fetchBinaryUrl).toHaveBeenCalledWith("https://other.example/api/artifacts/1");
  });

  it("rejects malformed and unconfigured instance URLs", async () => {
    const router = new GiteaApiRouter(
      () => createApi() as never,
      () => ["not a url"],
    );

    expect(() => router.fetchBinaryUrl("https://gitea.example/file")).toThrow(
      "No configured Gitea instance matches this URL.",
    );
    expect(() => router.listRuns(repo, 20)).toThrow(
      "No Gitea instance is configured for gitea.example:3000.",
    );
  });
});
