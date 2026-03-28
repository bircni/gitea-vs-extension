/**
 * Minimal Swagger 2.0 for `fetchSwagger` + `discoverEndpoints`.
 * Path keys must match regexes in `gitea/swagger.ts` (with `basePath` `/api/v1`).
 * Keep in sync with `fixtures/min-swagger.json`.
 */
const MIN_PATHS: Record<string, Record<string, unknown>> = {
  "/version": { get: { responses: { "200": { description: "ok" } } } },
  "/user/repos": { get: { responses: { "200": { description: "ok" } } } },
  "/repos/{owner}/{repo}/actions/runs": { get: { responses: { "200": { description: "ok" } } } },
  "/repos/{owner}/{repo}/actions/runs/{run}/jobs": {
    get: { responses: { "200": { description: "ok" } } },
  },
  "/repos/{owner}/{repo}/actions/jobs/{job_id}/logs": {
    get: { responses: { "200": { description: "ok" } } },
  },
  "/repos/{owner}/{repo}/actions/runs/{run}/artifacts": {
    get: { responses: { "200": { description: "ok" } } },
  },
  "/repos/{owner}/{repo}/actions/artifacts": {
    get: { responses: { "200": { description: "ok" } } },
  },
  "/repos/{owner}/{repo}/pulls": { get: { responses: { "200": { description: "ok" } } } },
  "/repos/{owner}/{repo}/pulls/{index}/reviews": {
    get: { responses: { "200": { description: "ok" } } },
    post: { responses: { "201": { description: "ok" } } },
  },
  "/repos/{owner}/{repo}/pulls/{index}/reviews/{id}/comments": {
    get: { responses: { "200": { description: "ok" } } },
  },
};

export const MIN_SWAGGER_JSON = JSON.stringify({
  swagger: "2.0",
  basePath: "/api/v1",
  info: { title: "Mock Gitea", version: "0.0" },
  paths: MIN_PATHS,
});
