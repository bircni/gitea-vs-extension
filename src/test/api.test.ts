import { EndpointError, GiteaApi } from "../gitea/api";
import type { RepoRef } from "../gitea/models";
import { HttpError } from "../gitea/client";
import { fetchSwagger } from "../gitea/swagger";

jest.mock("../gitea/swagger", () => {
  const actual = jest.requireActual("../gitea/swagger");
  return {
    ...actual,
    fetchSwagger: jest.fn(async () => undefined),
  };
});

const repo: RepoRef = { host: "example.com", owner: "owner", name: "repo" };

describe("GiteaApi review comment endpoints", () => {
  const client = {
    getJson: jest.fn(),
    getText: jest.fn(),
    requestText: jest.fn(),
  };
  const api = new GiteaApi(client as any, () => "http://example.com");

  beforeEach(() => {
    client.getJson.mockReset();
    client.getText.mockReset();
    client.requestText.mockReset();
    (fetchSwagger as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  test("requests pull request reviews with state=all", async () => {
    client.getJson.mockResolvedValueOnce([]);

    await api.listPullRequestReviews(repo, 12);

    expect(client.getJson).toHaveBeenCalledWith(
      "/api/v1/repos/owner/repo/pulls/12/reviews?state=all",
    );
  });

  test("requests review comments for a review", async () => {
    client.getJson.mockResolvedValueOnce([{ id: 1, body: "ok" }]);

    const comments = await api.listPullRequestReviewComments(repo, 3, 9);

    expect(client.getJson).toHaveBeenCalledWith(
      "/api/v1/repos/owner/repo/pulls/3/reviews/9/comments",
    );
    expect(comments).toHaveLength(1);
  });

  test("creates a new review comment via review creation endpoint", async () => {
    client.requestText.mockResolvedValueOnce("ok");

    await api.createPullRequestReviewComment(repo, 5, {
      body: "Looks good",
      path: "README.md",
      line: 7,
      commitId: "abc123",
    });

    expect(client.requestText).toHaveBeenCalledWith(
      "POST",
      "/api/v1/repos/owner/repo/pulls/5/reviews",
      {
        body: {
          event: "COMMENT",
          commit_id: "abc123",
          comments: [
            {
              body: "Looks good",
              path: "README.md",
              new_position: 7,
              old_position: 0,
            },
          ],
        },
      },
    );
  });

  test("fetches pull request diff", async () => {
    client.getText.mockResolvedValueOnce("diff");

    const diff = await api.getPullRequestDiff(repo, 22);

    expect(client.getText).toHaveBeenCalledWith("/api/v1/repos/owner/repo/pulls/22.diff");
    expect(diff).toBe("diff");
  });
});

describe("GiteaApi core endpoints", () => {
  const client = {
    getJson: jest.fn(),
    getText: jest.fn(),
    requestText: jest.fn(),
  };
  let api: GiteaApi;

  beforeEach(() => {
    client.getJson.mockReset();
    client.getText.mockReset();
    client.requestText.mockReset();
    (fetchSwagger as jest.Mock).mockReset().mockResolvedValue(undefined);
    api = new GiteaApi(client as any, () => "http://example.com");
  });

  test("lists runs with limit query param", async () => {
    client.getJson.mockResolvedValueOnce({ workflow_runs: [] });

    await api.listRuns(repo, 5);

    expect(client.getJson).toHaveBeenCalledWith("/api/v1/repos/owner/repo/actions/runs?limit=5");
  });

  test("lists jobs with run id", async () => {
    client.getJson.mockResolvedValueOnce({ jobs: [] });

    await api.listJobs(repo, 42, 10);

    expect(client.getJson).toHaveBeenCalledWith(
      "/api/v1/repos/owner/repo/actions/runs/42/jobs?limit=10",
    );
  });

  test("lists jobs without limit when not provided", async () => {
    client.getJson.mockResolvedValueOnce({ jobs: [] });

    await api.listJobs(repo, 42);

    expect(client.getJson).toHaveBeenCalledWith("/api/v1/repos/owner/repo/actions/runs/42/jobs");
  });

  test("lists artifacts for run", async () => {
    client.getJson.mockResolvedValueOnce({ artifacts: [] });

    await api.listArtifacts(repo, 99);

    expect(client.getJson).toHaveBeenCalledWith(
      "/api/v1/repos/owner/repo/actions/runs/99/artifacts",
    );
  });

  test("uses run artifacts endpoint when available", async () => {
    (fetchSwagger as jest.Mock).mockResolvedValueOnce({
      basePath: "/api/v1",
      paths: {
        "/repos/{owner}/{repo}/actions/runs/{run}/artifacts": {},
      },
    });
    client.getJson.mockResolvedValueOnce({ artifacts: [] });

    await api.listArtifacts(repo, 77);

    expect(client.getJson).toHaveBeenCalledWith(
      "/api/v1/repos/owner/repo/actions/runs/77/artifacts",
    );
  });

  test("lists workflows", async () => {
    client.getJson.mockResolvedValueOnce({ workflows: [{ id: 1, name: "build" }] });

    const workflows = await api.listWorkflows(repo);

    expect(client.getJson).toHaveBeenCalledWith("/api/v1/repos/owner/repo/actions/workflows");
    expect(workflows[0]?.name).toBe("build");
  });

  test("dispatches and toggles workflows", async () => {
    client.requestText.mockResolvedValue("ok");

    await api.dispatchWorkflow(repo, 9, "main", { env: "prod" });
    await api.enableWorkflow(repo, 9);
    await api.disableWorkflow(repo, 9);

    expect(client.requestText).toHaveBeenCalledWith(
      "POST",
      "/api/v1/repos/owner/repo/actions/workflows/9/dispatches",
      { body: { ref: "main", inputs: { env: "prod" } } },
    );
    expect(client.requestText).toHaveBeenCalledWith(
      "PUT",
      "/api/v1/repos/owner/repo/actions/workflows/9/enable",
    );
    expect(client.requestText).toHaveBeenCalledWith(
      "PUT",
      "/api/v1/repos/owner/repo/actions/workflows/9/disable",
    );
  });

  test("deletes run and downloads artifact", async () => {
    client.requestText.mockResolvedValueOnce("ok");
    (client as any).getBinary = jest.fn().mockResolvedValueOnce(new Uint8Array([1, 2, 3]));

    await api.deleteRun(repo, 42);
    const artifact = await api.downloadArtifact(repo, 77);

    expect(client.requestText).toHaveBeenCalledWith(
      "DELETE",
      "/api/v1/repos/owner/repo/actions/runs/42",
    );
    expect((client as any).getBinary).toHaveBeenCalledWith(
      "/api/v1/repos/owner/repo/actions/artifacts/77/zip",
    );
    expect(Array.from(artifact)).toEqual([1, 2, 3]);
  });

  test("lists pull requests from array response", async () => {
    client.getJson.mockResolvedValueOnce([{ id: 1, number: 1, title: "PR" }]);

    const prs = await api.listPullRequests(repo);

    expect(client.getJson).toHaveBeenCalledWith("/api/v1/repos/owner/repo/pulls?state=open");
    expect(prs).toHaveLength(1);
  });

  test("lists pull requests from entries response", async () => {
    client.getJson.mockResolvedValueOnce({ entries: [{ id: 2, number: 2, title: "PR2" }] });

    const prs = await api.listPullRequests(repo);

    expect(prs).toHaveLength(1);
    expect(prs[0]?.number).toBe(2);
  });

  test("lists pull request files and commits", async () => {
    client.getJson
      .mockResolvedValueOnce([{ filename: "src/a.ts", status: "modified", additions: 2 }])
      .mockResolvedValueOnce([{ sha: "abcdef", commit: { message: "feat: test" } }]);

    const files = await api.listPullRequestFiles(repo, 3);
    const commits = await api.listPullRequestCommits(repo, 3);

    expect(client.getJson).toHaveBeenCalledWith("/api/v1/repos/owner/repo/pulls/3/files");
    expect(client.getJson).toHaveBeenCalledWith("/api/v1/repos/owner/repo/pulls/3/commits");
    expect(files[0]?.filename).toBe("src/a.ts");
    expect(commits[0]?.message).toBe("feat: test");
  });

  test("updates pull request branch", async () => {
    client.requestText.mockResolvedValueOnce("ok");

    await api.updatePullRequest(repo, 4, "rebase");

    expect(client.requestText).toHaveBeenCalledWith(
      "POST",
      "/api/v1/repos/owner/repo/pulls/4/update?style=rebase",
    );
  });

  test("returns empty when pull request reviews endpoint missing", async () => {
    (api as any).ensureEndpoints = jest.fn(async () => ({}));

    const reviews = await api.listPullRequestReviews(repo, 1);

    expect(reviews).toEqual([]);
  });

  test("returns empty when review comments endpoint missing", async () => {
    (api as any).ensureEndpoints = jest.fn(async () => ({}));

    const comments = await api.listPullRequestReviewComments(repo, 1, 2);

    expect(comments).toEqual([]);
  });

  test("returns empty when artifacts endpoint missing", async () => {
    (api as any).ensureEndpoints = jest.fn(async () => ({}));

    const artifacts = await api.listArtifacts(repo, 1);

    expect(artifacts).toEqual([]);
  });

  test("uses repo artifacts fallback when run artifacts missing", async () => {
    (fetchSwagger as jest.Mock).mockResolvedValueOnce({
      basePath: "/api/v1",
      paths: {
        "/repos/{owner}/{repo}/actions/artifacts": {},
      },
    });
    client.getJson.mockResolvedValueOnce({ artifacts: [] });

    await api.listArtifacts(repo, 5);

    expect(client.getJson).toHaveBeenCalledWith("/api/v1/repos/owner/repo/actions/artifacts");
  });

  test("listRuns throws when endpoint missing", async () => {
    (api as any).ensureEndpoints = jest.fn(async () => ({}));

    await expect(api.listRuns(repo, 1)).rejects.toBeInstanceOf(EndpointError);
  });

  test("testConnection uses version endpoint", async () => {
    (fetchSwagger as jest.Mock).mockResolvedValueOnce({
      basePath: "/api/v1",
      paths: {
        "/version": {},
      },
    });
    client.getJson.mockResolvedValueOnce({ version: "1.0.0" });

    const version = await api.testConnection();

    expect(client.getJson).toHaveBeenCalledWith("/api/v1/version");
    expect(version).toBe("1.0.0");
  });

  test("testConnection throws when version endpoint missing", async () => {
    (fetchSwagger as jest.Mock).mockResolvedValueOnce({
      basePath: "/api/v1",
      paths: {},
    });
    client.getJson.mockResolvedValueOnce({ version: "fallback" });

    const version = await api.testConnection();

    expect(version).toBe("fallback");
  });

  test("lists secrets and variables", async () => {
    client.getJson
      .mockResolvedValueOnce({ secrets: [{ name: "TOKEN" }] })
      .mockResolvedValueOnce({ variables: [{ name: "REGION" }] });

    const secrets = await api.listSecrets(repo);
    const variables = await api.listVariables(repo);

    expect(secrets).toEqual([{ name: "TOKEN" }]);
    expect(variables).toEqual([{ name: "REGION" }]);
  });

  test("creates, updates, and deletes secrets", async () => {
    client.requestText.mockResolvedValue("ok");

    await api.createOrUpdateSecret(repo, "TOKEN", "abc", "desc");
    await api.deleteSecret(repo, "TOKEN");

    expect(client.requestText).toHaveBeenCalledWith(
      "PUT",
      "/api/v1/repos/owner/repo/actions/secrets/TOKEN",
      { body: { data: "abc", description: "desc" } },
    );
    expect(client.requestText).toHaveBeenCalledWith(
      "DELETE",
      "/api/v1/repos/owner/repo/actions/secrets/TOKEN",
    );
  });

  test("creates, updates, and deletes variables", async () => {
    client.requestText.mockResolvedValue("ok");
    client.getJson.mockResolvedValueOnce({ name: "REGION", value: "eu" });

    await api.createVariable(repo, "REGION", "eu", "desc");
    await api.updateVariable(repo, "REGION", "us", "desc2", "REGION2");
    await api.getVariable(repo, "REGION");
    await api.deleteVariable(repo, "REGION");

    expect(client.requestText).toHaveBeenCalledWith(
      "POST",
      "/api/v1/repos/owner/repo/actions/variables/REGION",
      { body: { name: "REGION", value: "eu", description: "desc" } },
    );
    expect(client.requestText).toHaveBeenCalledWith(
      "PUT",
      "/api/v1/repos/owner/repo/actions/variables/REGION",
      { body: { name: "REGION2", value: "us", description: "desc2" } },
    );
    expect(client.getJson).toHaveBeenCalledWith(
      "/api/v1/repos/owner/repo/actions/variables/REGION",
    );
    expect(client.requestText).toHaveBeenCalledWith(
      "DELETE",
      "/api/v1/repos/owner/repo/actions/variables/REGION",
    );
  });

  test("lists accessible repos and filters invalid base URL", async () => {
    client.getJson.mockResolvedValueOnce([
      { owner: { login: "octo" }, name: "demo", html_url: "http://x" },
    ]);
    const apiWithHost = new GiteaApi(client as any, () => "http://example.com");

    const repos = await apiWithHost.listAccessibleRepos();

    expect(repos).toHaveLength(1);

    client.getJson.mockResolvedValueOnce([
      { owner: { login: "" }, name: "", html_url: "http://x" },
    ]);
    const emptyFiltered = await apiWithHost.listAccessibleRepos();
    expect(emptyFiltered).toEqual([]);

    const apiWithoutHost = new GiteaApi(client as any, () => "not-a-url");
    client.getJson.mockResolvedValueOnce([]);
    const empty = await apiWithoutHost.listAccessibleRepos();
    expect(empty).toEqual([]);
  });

  test("ensureEndpoints falls back on HttpError", async () => {
    (fetchSwagger as jest.Mock).mockRejectedValueOnce(new HttpError(404, "/swagger", "not found"));
    client.getJson.mockResolvedValueOnce({ version: "fallback" });

    const version = await api.testConnection();

    expect(version).toBe("fallback");
  });

  test("ensureEndpoints falls back on non-HttpError", async () => {
    (fetchSwagger as jest.Mock).mockRejectedValueOnce(new Error("boom"));
    client.getJson.mockResolvedValueOnce({ version: "fallback2" });

    const version = await api.testConnection();

    expect(version).toBe("fallback2");
  });

  test("returns capability map from discovered endpoints", async () => {
    (fetchSwagger as jest.Mock).mockResolvedValueOnce({
      basePath: "/api/v1",
      paths: {
        "/repos/{owner}/{repo}/actions/runs": {},
        "/repos/{owner}/{repo}/pulls": {},
      },
    });

    const caps = await api.getCapabilities();

    expect(caps.runs).toBe(true);
    expect(caps.pullRequests).toBe(true);
    expect(caps.pullRequestReviews).toBe(false);
  });
});
