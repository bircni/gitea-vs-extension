import { HttpError, type GiteaHttpClient } from "./client";

export type SwaggerDoc = {
  basePath?: string;
  paths?: Record<string, unknown>;
};

export type EndpointMap = {
  listRuns?: string;
  getRun?: string;
  deleteRun?: string;
  listJobs?: string;
  getJob?: string;
  jobLogs?: string;
  listRunArtifacts?: string;
  listRepoArtifacts?: string;
  getArtifact?: string;
  downloadArtifact?: string;
  listWorkflows?: string;
  getWorkflow?: string;
  enableWorkflow?: string;
  disableWorkflow?: string;
  dispatchWorkflow?: string;
  listPullRequests?: string;
  getPullRequest?: string;
  listPullRequestCommits?: string;
  listPullRequestFiles?: string;
  mergePullRequest?: string;
  updatePullRequest?: string;
  requestedReviewers?: string;
  listPullRequestReviews?: string;
  listPullRequestReviewComments?: string;
  listRepos?: string;
  version?: string;
};

export type CapabilityMap = {
  runs: boolean;
  runDetails: boolean;
  runDelete: boolean;
  jobs: boolean;
  jobDetails: boolean;
  jobLogs: boolean;
  runArtifacts: boolean;
  repoArtifacts: boolean;
  artifactDetails: boolean;
  artifactDownload: boolean;
  workflows: boolean;
  workflowDetails: boolean;
  workflowEnable: boolean;
  workflowDisable: boolean;
  workflowDispatch: boolean;
  pullRequests: boolean;
  pullRequestDetails: boolean;
  pullRequestCommits: boolean;
  pullRequestFiles: boolean;
  pullRequestMerge: boolean;
  pullRequestUpdate: boolean;
  requestedReviewers: boolean;
  pullRequestReviews: boolean;
  pullRequestReviewComments: boolean;
  reposListing: boolean;
  version: boolean;
};

const SWAGGER_PATHS = [
  "/swagger.v1.json",
  "/api/swagger.v1.json",
  "/api/swagger.json",
  "/api/swagger",
];

export async function fetchSwagger(client: GiteaHttpClient): Promise<SwaggerDoc | undefined> {
  for (const path of SWAGGER_PATHS) {
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
  const getRun = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/runs\/\{[^}]+\}$/);
  const deleteRun = getRun;
  const listJobs = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/runs\/\{[^}]+\}\/jobs$/,
  );
  const getJob = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/jobs\/\{[^}]+\}$/);
  const jobLogs =
    pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/jobs\/\{[^}]+\}\/logs$/) ??
    pickPath(paths, /^\/actions\/jobs\/\{[^}]+\}\/logs$/);
  const listRunArtifacts = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/runs\/\{[^}]+\}\/artifacts$/,
  );
  const listRepoArtifacts = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/artifacts$/);
  const getArtifact = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/artifacts\/\{[^}]+\}$/);
  const downloadArtifact = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/artifacts\/\{[^}]+\}\/zip$/,
  );
  const listWorkflows = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/actions\/workflows$/);
  const getWorkflow = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/workflows\/\{[^}]+\}$/,
  );
  const enableWorkflow = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/workflows\/\{[^}]+\}\/enable$/,
  );
  const disableWorkflow = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/workflows\/\{[^}]+\}\/disable$/,
  );
  const dispatchWorkflow = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/actions\/workflows\/\{[^}]+\}\/dispatches$/,
  );
  const listPullRequests = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/pulls$/);
  const getPullRequest = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}$/);
  const listPullRequestCommits = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}\/commits$/,
  );
  const listPullRequestFiles = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}\/files$/,
  );
  const mergePullRequest = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}\/merge$/);
  const updatePullRequest = pickPath(paths, /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}\/update$/);
  const requestedReviewers = pickPath(
    paths,
    /^\/repos\/\{owner\}\/\{repo\}\/pulls\/\{[^}]+\}\/requested_reviewers$/,
  );
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
    getRun: joinPath(basePath, getRun),
    deleteRun: joinPath(basePath, deleteRun),
    listJobs: joinPath(basePath, listJobs),
    getJob: joinPath(basePath, getJob),
    jobLogs: joinPath(basePath, jobLogs),
    listRunArtifacts: joinPath(basePath, listRunArtifacts),
    listRepoArtifacts: joinPath(basePath, listRepoArtifacts),
    getArtifact: joinPath(basePath, getArtifact),
    downloadArtifact: joinPath(basePath, downloadArtifact),
    listWorkflows: joinPath(basePath, listWorkflows),
    getWorkflow: joinPath(basePath, getWorkflow),
    enableWorkflow: joinPath(basePath, enableWorkflow),
    disableWorkflow: joinPath(basePath, disableWorkflow),
    dispatchWorkflow: joinPath(basePath, dispatchWorkflow),
    listPullRequests: joinPath(basePath, listPullRequests),
    getPullRequest: joinPath(basePath, getPullRequest),
    listPullRequestCommits: joinPath(basePath, listPullRequestCommits),
    listPullRequestFiles: joinPath(basePath, listPullRequestFiles),
    mergePullRequest: joinPath(basePath, mergePullRequest),
    updatePullRequest: joinPath(basePath, updatePullRequest),
    requestedReviewers: joinPath(basePath, requestedReviewers),
    listPullRequestReviews: joinPath(basePath, listPullRequestReviews),
    listPullRequestReviewComments: joinPath(basePath, listPullRequestReviewComments),
    listRepos: joinPath(basePath, listRepos),
    version: joinPath(basePath, version),
  };
}

export function fallbackEndpoints(): EndpointMap {
  const basePath = "/api/v1";
  return {
    listRuns: `${basePath}/repos/{owner}/{repo}/actions/runs`,
    getRun: `${basePath}/repos/{owner}/{repo}/actions/runs/{run}`,
    deleteRun: `${basePath}/repos/{owner}/{repo}/actions/runs/{run}`,
    listJobs: `${basePath}/repos/{owner}/{repo}/actions/runs/{run}/jobs`,
    getJob: `${basePath}/repos/{owner}/{repo}/actions/jobs/{job_id}`,
    jobLogs: `${basePath}/repos/{owner}/{repo}/actions/jobs/{job_id}/logs`,
    listRunArtifacts: `${basePath}/repos/{owner}/{repo}/actions/runs/{run}/artifacts`,
    listRepoArtifacts: `${basePath}/repos/{owner}/{repo}/actions/artifacts`,
    getArtifact: `${basePath}/repos/{owner}/{repo}/actions/artifacts/{artifact_id}`,
    downloadArtifact: `${basePath}/repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip`,
    listWorkflows: `${basePath}/repos/{owner}/{repo}/actions/workflows`,
    getWorkflow: `${basePath}/repos/{owner}/{repo}/actions/workflows/{workflow_id}`,
    enableWorkflow: `${basePath}/repos/{owner}/{repo}/actions/workflows/{workflow_id}/enable`,
    disableWorkflow: `${basePath}/repos/{owner}/{repo}/actions/workflows/{workflow_id}/disable`,
    dispatchWorkflow: `${basePath}/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`,
    listPullRequests: `${basePath}/repos/{owner}/{repo}/pulls`,
    getPullRequest: `${basePath}/repos/{owner}/{repo}/pulls/{index}`,
    listPullRequestCommits: `${basePath}/repos/{owner}/{repo}/pulls/{index}/commits`,
    listPullRequestFiles: `${basePath}/repos/{owner}/{repo}/pulls/{index}/files`,
    mergePullRequest: `${basePath}/repos/{owner}/{repo}/pulls/{index}/merge`,
    updatePullRequest: `${basePath}/repos/{owner}/{repo}/pulls/{index}/update`,
    requestedReviewers: `${basePath}/repos/{owner}/{repo}/pulls/{index}/requested_reviewers`,
    listPullRequestReviews: `${basePath}/repos/{owner}/{repo}/pulls/{index}/reviews`,
    listPullRequestReviewComments: `${basePath}/repos/{owner}/{repo}/pulls/{index}/reviews/{id}/comments`,
    listRepos: `${basePath}/user/repos`,
    version: `${basePath}/version`,
  };
}

export function capabilitiesFromEndpoints(endpoints: EndpointMap): CapabilityMap {
  return {
    runs: Boolean(endpoints.listRuns),
    runDetails: Boolean(endpoints.getRun),
    runDelete: Boolean(endpoints.deleteRun),
    jobs: Boolean(endpoints.listJobs),
    jobDetails: Boolean(endpoints.getJob),
    jobLogs: Boolean(endpoints.jobLogs),
    runArtifacts: Boolean(endpoints.listRunArtifacts),
    repoArtifacts: Boolean(endpoints.listRepoArtifacts),
    artifactDetails: Boolean(endpoints.getArtifact),
    artifactDownload: Boolean(endpoints.downloadArtifact),
    workflows: Boolean(endpoints.listWorkflows),
    workflowDetails: Boolean(endpoints.getWorkflow),
    workflowEnable: Boolean(endpoints.enableWorkflow),
    workflowDisable: Boolean(endpoints.disableWorkflow),
    workflowDispatch: Boolean(endpoints.dispatchWorkflow),
    pullRequests: Boolean(endpoints.listPullRequests),
    pullRequestDetails: Boolean(endpoints.getPullRequest),
    pullRequestCommits: Boolean(endpoints.listPullRequestCommits),
    pullRequestFiles: Boolean(endpoints.listPullRequestFiles),
    pullRequestMerge: Boolean(endpoints.mergePullRequest),
    pullRequestUpdate: Boolean(endpoints.updatePullRequest),
    requestedReviewers: Boolean(endpoints.requestedReviewers),
    pullRequestReviews: Boolean(endpoints.listPullRequestReviews),
    pullRequestReviewComments: Boolean(endpoints.listPullRequestReviewComments),
    reposListing: Boolean(endpoints.listRepos),
    version: Boolean(endpoints.version),
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
