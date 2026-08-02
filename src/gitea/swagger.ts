import { HttpError, type GiteaHttpClient } from "./client";

export type SwaggerDoc = {
  basePath?: string;
  paths?: Record<string, unknown>;
};

export type EndpointMap = {
  listRuns?: string;
  listJobs?: string;
  jobLogs?: string;
  listRunArtifacts?: string;
  listRepoArtifacts?: string;
  listPullRequests?: string;
  listPullRequestReviews?: string;
  listPullRequestReviewComments?: string;
  listRepos?: string;
  version?: string;
};

/** Ordered discovery URLs tried by `fetchSwagger` (first 200 + `paths` wins). */
export const SWAGGER_FETCH_PATHS = [
  "/swagger.v1.json",
  "/api/swagger.v1.json",
  "/api/swagger.json",
  "/api/swagger",
] as const;

export async function fetchSwagger(client: GiteaHttpClient): Promise<SwaggerDoc | undefined> {
  for (const path of SWAGGER_FETCH_PATHS) {
    try {
      const doc = await client.getJson<SwaggerDoc>(path, { allowMissingBaseUrl: true });
      if (doc.paths) {
        return doc;
      }
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        continue;
      }
    }
  }
  return undefined;
}

export function discoverEndpoints(doc?: SwaggerDoc): EndpointMap {
  if (!doc?.paths) {
    return fallbackEndpoints();
  }

  const basePath = doc.basePath ?? "";
  const paths = Object.keys(doc.paths);

  const listRuns = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/runs$/);
  const listJobs = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/runs\/\{[^}]+\}\/jobs$/,
  );
  const jobLogs =
    pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/jobs\/\{[^}]+\}\/logs$/) ??
    pickPath(paths, /^\/actions\/jobs\/\{[^}]+\}\/logs$/);
  const listRunArtifacts = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/runs\/\{[^}]+\}\/artifacts$/,
  );
  const listRepoArtifacts = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/artifacts$/);
  const listPullRequests = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/pulls$/);
  const listPullRequestReviews = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}\/reviews$/,
  );
  const listPullRequestReviewComments = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}\/reviews\/\{[^}]+\}\/comments$/,
  );
  const listRepos = pickPath(paths, /^\/user\/repos$/);
  const version = pickPath(paths, /^\/version$/);

  return {
    listRuns: joinPath(basePath, listRuns),
    listJobs: joinPath(basePath, listJobs),
    jobLogs: joinPath(basePath, jobLogs),
    listRunArtifacts: joinPath(basePath, listRunArtifacts),
    listRepoArtifacts: joinPath(basePath, listRepoArtifacts),
    listPullRequests: joinPath(basePath, listPullRequests),
    listPullRequestReviews: joinPath(basePath, listPullRequestReviews),
    listPullRequestReviewComments: joinPath(basePath, listPullRequestReviewComments),
    listRepos: joinPath(basePath, listRepos),
    version: joinPath(basePath, version),
  };
}

export function fallbackEndpoints(): EndpointMap {
  // `{owner}`, `{repo}`, … are Gitea path placeholders filled in per request, not interpolations.
  const basePath = "/api/v1";
  return {
    listRuns: joinPath(basePath, "/repos/{owner}/{repo}/actions/runs"),
    listJobs: joinPath(basePath, "/repos/{owner}/{repo}/actions/runs/{run}/jobs"),
    jobLogs: joinPath(basePath, "/repos/{owner}/{repo}/actions/jobs/{job_id}/logs"),
    listRunArtifacts: joinPath(basePath, "/repos/{owner}/{repo}/actions/runs/{run}/artifacts"),
    listRepoArtifacts: joinPath(basePath, "/repos/{owner}/{repo}/actions/artifacts"),
    listPullRequests: joinPath(basePath, "/repos/{owner}/{repo}/pulls"),
    listPullRequestReviews: joinPath(basePath, "/repos/{owner}/{repo}/pulls/{index}/reviews"),
    listPullRequestReviewComments: joinPath(
      basePath,
      "/repos/{owner}/{repo}/pulls/{index}/reviews/{id}/comments",
    ),
    listRepos: joinPath(basePath, "/user/repos"),
    version: joinPath(basePath, "/version"),
  };
}

function pickPath(paths: string[], regex: RegExp): string | undefined {
  return paths.find((path) => regex.test(path));
}

function joinPath(basePath: string, path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  if (!basePath || basePath === "/") {
    return path;
  }
  return `${basePath}${path}`;
}
