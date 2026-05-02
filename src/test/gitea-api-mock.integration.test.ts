import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GiteaApi } from "../gitea/api";
import { GiteaHttpClient } from "../gitea/client";
import type { RepoRef } from "../gitea/models";
import { fetchSwagger, SWAGGER_FETCH_PATHS } from "../gitea/swagger";
import {
  MOCK_GITEA_TOKEN,
  startMockGitea,
  stopMockGitea,
  TEST_REPO_NAME,
  TEST_REPO_OWNER,
} from "./mock-gitea";
import type { MockGiteaInstance } from "./mock-gitea/lifecycle";

let mock: MockGiteaInstance;
let api: GiteaApi;

function repoRef(): RepoRef {
  const host = new URL(mock.baseUrl).host;
  return { host, owner: TEST_REPO_OWNER, name: TEST_REPO_NAME };
}

beforeAll(async () => {
  mock = await startMockGitea();
  const client = new GiteaHttpClient(() => ({
    baseUrl: mock.baseUrl,
    token: MOCK_GITEA_TOKEN,
    insecureSkipVerify: false,
  }));
  api = new GiteaApi(client, () => mock.baseUrl);
});

afterAll(async () => {
  await stopMockGitea(mock);
});

describe("GiteaApi against hermetic mock (008 inventory)", () => {
  it("row 1: fetchSwagger returns paths", async () => {
    const client = new GiteaHttpClient(() => ({
      baseUrl: mock.baseUrl,
      token: MOCK_GITEA_TOKEN,
      insecureSkipVerify: false,
    }));
    const doc = await fetchSwagger(client);
    expect(doc?.paths).toBeDefined();
    expect(Object.keys(doc?.paths ?? {}).length).toBeGreaterThan(0);
  });

  it.each([...SWAGGER_FETCH_PATHS])(
    "row 1: swagger discovery GET %s returns JSON with paths",
    async (p) => {
      const client = new GiteaHttpClient(() => ({
        baseUrl: mock.baseUrl,
        token: MOCK_GITEA_TOKEN,
        insecureSkipVerify: false,
      }));
      const doc = await client.getJson<{ paths?: Record<string, unknown> }>(p, {
        allowMissingBaseUrl: true,
      });
      expect(doc.paths).toBeDefined();
      expect(Object.keys(doc.paths ?? {}).length).toBeGreaterThan(0);
    },
  );

  it("row 2: testConnection / version", async () => {
    const v = await api.testConnection();
    expect(v).toContain("mock");
  });

  it("row 22: listAccessibleRepos", async () => {
    const repos = await api.listAccessibleRepos();
    expect(repos.some((r) => r.owner === TEST_REPO_OWNER && r.name === TEST_REPO_NAME)).toBe(true);
  });

  it("rows 3–6: runs, jobs, logs, artifacts", async () => {
    const repo = repoRef();
    const runs = await api.listRuns(repo, 10);
    expect(runs.length).toBeGreaterThan(0);
    const runId = runs[0].id;

    const jobs = await api.listJobs(repo, runId, 10);
    expect(jobs.length).toBeGreaterThan(0);
    const jobId = jobs[0].id;

    const logs = await api.getJobLogs(repo, jobId);
    expect(logs).toContain("mock log");

    const artifacts = await api.listArtifacts(repo, runId);
    expect(artifacts.length).toBeGreaterThan(0);
    const firstArtifact = artifacts[0];
    expect(firstArtifact.downloadUrl).toBeDefined();
    expect(firstArtifact.downloadUrl).toContain(mock.baseUrl);
  });

  it("row 7: downloadArtifactToFile", async () => {
    const repo = repoRef();
    const runs = await api.listRuns(repo, 1);
    const runId = runs[0].id;
    const artifacts = await api.listArtifacts(repo, runId);
    const art = artifacts.find((a) => a.name === "mock-artifact.zip");
    if (!art?.downloadUrl) {
      throw new Error("expected mock-artifact.zip with downloadUrl");
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitea-mock-art-"));
    try {
      const saved = await api.downloadArtifactToFile(repo, runId, art, dir);
      expect(fs.readFileSync(saved).toString()).toBe("ZIP");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("row 7: downloadArtifactToFile follows HTML redirect link", async () => {
    const repo = repoRef();
    const runs = await api.listRuns(repo, 1);
    const runId = runs[0].id;
    const artifacts = await api.listArtifacts(repo, runId);
    const art = artifacts.find((a) => a.name === "mock-artifact-via-html-redirect.zip");
    if (!art?.downloadUrl) {
      throw new Error("expected redirect fixture artifact");
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitea-mock-art-redir-"));
    try {
      const saved = await api.downloadArtifactToFile(repo, runId, art, dir);
      expect(fs.readFileSync(saved).toString()).toBe("REDIRECT_OK");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("row 6: repo-scoped GET .../actions/artifacts returns artifacts", async () => {
    const client = new GiteaHttpClient(() => ({
      baseUrl: mock.baseUrl,
      token: MOCK_GITEA_TOKEN,
      insecureSkipVerify: false,
    }));
    const rel = `/api/v1/repos/${encodeURIComponent(TEST_REPO_OWNER)}/${encodeURIComponent(TEST_REPO_NAME)}/actions/artifacts`;
    const data = await client.getJson<{ artifacts?: { name?: string }[] }>(rel);
    expect(data.artifacts?.length).toBeGreaterThan(0);
    expect(data.artifacts?.some((a) => a.name === "repo-scoped-artifact.zip")).toBe(true);
  });

  it("row 6/7: download from repo-scoped artifact URL", async () => {
    const repo = repoRef();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gitea-mock-repo-art-"));
    const downloadUrl = `${mock.baseUrl}/api/v1/repos/${encodeURIComponent(TEST_REPO_OWNER)}/${encodeURIComponent(TEST_REPO_NAME)}/actions/artifacts/401/download`;
    try {
      const saved = await api.downloadArtifactToFile(
        repo,
        "repo-artifacts",
        {
          id: 401,
          name: "repo-scoped-artifact.zip",
          downloadUrl,
        },
        dir,
      );
      expect(fs.readFileSync(saved).toString()).toBe("REPO");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rows 8–12: PRs, reviews, comments, create comment, diff", async () => {
    const repo = repoRef();
    const prs = await api.listPullRequests(repo);
    expect(prs.length).toBe(1);
    const num = prs[0]?.number ?? 1;

    const reviews = await api.listPullRequestReviews(repo, num);
    expect(reviews.length).toBeGreaterThan(0);
    const reviewId = reviews[0]?.id ?? 401;

    const comments = await api.listPullRequestReviewComments(repo, num, reviewId);
    expect(comments.length).toBeGreaterThan(0);

    await expect(
      api.createPullRequestReviewComment(repo, num, {
        body: "created by integration test",
        path: "README.md",
        line: 1,
        commitId: "abc123",
      }),
    ).resolves.toBeUndefined();
    const updatedReviews = await api.listPullRequestReviews(repo, num);
    const createdComments = (
      await Promise.all(
        updatedReviews.map((review) => api.listPullRequestReviewComments(repo, num, review.id)),
      )
    ).flat();
    expect(createdComments.some((comment) => comment.body === "created by integration test")).toBe(
      true,
    );

    const diff = await api.getPullRequestDiff(repo, num);
    expect(diff).toContain("diff --git");
  });

  it("row 13: getCombinedStatus", async () => {
    const status = await api.getCombinedStatus(repoRef(), "main");
    expect(status.state).toBe("success");
  });

  it("rows 14–16: secrets", async () => {
    const repo = repoRef();
    let list = await api.listSecrets(repo);
    const initial = list.length;
    await api.createOrUpdateSecret(repo, "MOCK_SECRET", "c2VjcmV0", "d");
    list = await api.listSecrets(repo);
    expect(list.length).toBeGreaterThanOrEqual(initial + 1);
    await api.deleteSecret(repo, "MOCK_SECRET");
    list = await api.listSecrets(repo);
    expect(list.some((s) => s.name === "MOCK_SECRET")).toBe(false);
  });

  it("rows 17–21: variables", async () => {
    const repo = repoRef();
    await api.createVariable(repo, "MOCK_VAR", "v1", "d");
    let v = await api.getVariable(repo, "MOCK_VAR");
    expect(v.name).toBe("MOCK_VAR");
    await api.updateVariable(repo, "MOCK_VAR", "v2", "d2", "MOCK_VAR2");
    v = await api.getVariable(repo, "MOCK_VAR2");
    expect(v.name).toBe("MOCK_VAR2");
    let list = await api.listVariables(repo);
    expect(list.some((x) => x.name === "MOCK_VAR2")).toBe(true);
    await api.deleteVariable(repo, "MOCK_VAR2");
    list = await api.listVariables(repo);
    expect(list.some((x) => x.name === "MOCK_VAR2")).toBe(false);
  });

  it("row 23: fetchBinaryUrl (avatar)", async () => {
    const avatarUrl = `${mock.baseUrl}/api/v1/mock/avatar.png`;
    const bytes = await api.fetchBinaryUrl(avatarUrl);
    expect(bytes.byteLength).toBeGreaterThan(10);
  });
});
