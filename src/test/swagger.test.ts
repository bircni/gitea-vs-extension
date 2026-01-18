import * as fs from "fs";
import * as path from "path";
import { discoverEndpoints, fetchSwagger } from "../gitea/swagger";
import { HttpError } from "../gitea/client";

test("finds actions endpoints", () => {
  const swaggerPath = path.resolve(__dirname, "../../docs/swagger.v1.json");
  const content = fs.readFileSync(swaggerPath, "utf8");
  const doc = JSON.parse(content);

  const endpoints = discoverEndpoints(doc);

  expect(endpoints.listRuns).toBe("/api/v1/repos/{owner}/{repo}/actions/runs");
  expect(endpoints.listJobs).toBe("/api/v1/repos/{owner}/{repo}/actions/runs/{run}/jobs");
  expect(endpoints.jobLogs).toBe("/api/v1/repos/{owner}/{repo}/actions/jobs/{job_id}/logs");
  expect(endpoints.listRunArtifacts).toBe(
    "/api/v1/repos/{owner}/{repo}/actions/runs/{run}/artifacts",
  );
  expect(endpoints.listPullRequests).toBe("/api/v1/repos/{owner}/{repo}/pulls");
});

test("uses fallback endpoints when swagger is missing", () => {
  const endpoints = discoverEndpoints(undefined);
  expect(endpoints.listRuns).toBe("/api/v1/repos/{owner}/{repo}/actions/runs");
  expect(endpoints.listJobs).toBe("/api/v1/repos/{owner}/{repo}/actions/runs/{run}/jobs");
  expect(endpoints.version).toBe("/api/v1/version");
});

test("prefixes discovered endpoints with basePath", () => {
  const endpoints = discoverEndpoints({
    basePath: "/api/v1",
    paths: {
      "/repos/{owner}/{repo}/actions/runs": {},
      "/version": {},
    },
  });

  expect(endpoints.listRuns).toBe("/api/v1/repos/{owner}/{repo}/actions/runs");
  expect(endpoints.version).toBe("/api/v1/version");
});

test("discovers fallback job logs path and basePath root", () => {
  const endpoints = discoverEndpoints({
    basePath: "/",
    paths: {
      "/actions/jobs/{id}/logs": {},
      "/repos/{owner}/{repo}/actions/artifacts": {},
      "/user/repos": {},
    },
  });

  expect(endpoints.jobLogs).toBe("/actions/jobs/{id}/logs");
  expect(endpoints.listRepoArtifacts).toBe("/repos/{owner}/{repo}/actions/artifacts");
  expect(endpoints.listRepos).toBe("/user/repos");
});

test("fetches swagger from first matching path", async () => {
  const client = {
    getJson: jest.fn(async () => ({ paths: { "/version": {} } })),
  };

  const doc = await fetchSwagger(client as any);

  expect(doc).toEqual({ paths: { "/version": {} } });
  expect(client.getJson).toHaveBeenCalledWith("/swagger.v1.json", { allowMissingBaseUrl: true });
});

test("fetchSwagger skips 404 responses", async () => {
  const client = {
    getJson: jest
      .fn()
      .mockRejectedValueOnce(new HttpError(404, "/swagger.v1.json", "not found"))
      .mockResolvedValueOnce({ paths: { "/version": {} } }),
  };

  const doc = await fetchSwagger(client as any);

  expect(doc).toEqual({ paths: { "/version": {} } });
  expect(client.getJson).toHaveBeenCalledTimes(2);
});

test("fetchSwagger ignores invalid docs", async () => {
  const client = {
    getJson: jest.fn(async () => ({ version: "1" })),
  };

  const doc = await fetchSwagger(client as any);

  expect(doc).toBeUndefined();
  expect(client.getJson).toHaveBeenCalledTimes(4);
});
