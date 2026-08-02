import * as fs from "node:fs";
import path from "node:path";
import { HttpError, type GiteaHttpClient } from "./client";
import { discoverEndpoints, fallbackEndpoints, fetchSwagger, type EndpointMap } from "./swagger";
import { computeArtifactSavePath } from "../util/artifactDownload";
import {
  normalizeArtifact,
  normalizeJob,
  normalizePullRequest,
  normalizePullRequestReview,
  normalizePullRequestReviewComment,
  normalizeRepoStatus,
  normalizeRun,
  type Artifact,
  type Job,
  type PullRequest,
  type PullRequestReview,
  type PullRequestReviewComment,
  type RepoRef,
  type RepoStatus,
  type WorkflowRun,
} from "./models";

export class EndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EndpointError";
  }
}

export class GiteaApi {
  private endpoints?: EndpointMap;
  private lastBaseUrl?: string;

  constructor(
    private readonly client: GiteaHttpClient,
    private readonly baseUrlProvider: () => string,
  ) {}

  async testConnection(): Promise<string> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.version ?? fallbackEndpoints().version;
    if (!path) {
      throw new EndpointError("Version endpoint not available");
    }
    const response = await this.client.getJson<{ version?: string }>(path);
    return response.version ?? "OK";
  }

  async listRuns(repo: RepoRef, limit: number, branch?: string): Promise<WorkflowRun[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listRuns;
    if (!path) {
      throw new EndpointError("Runs endpoint not available");
    }
    const url = withQuery(fillRepoPath(path, repo), {
      limit: String(limit),
      branch,
    });
    const response = await this.client.getJson<Record<string, unknown>>(url);
    const list = extractArray(response, ["workflow_runs", "entries", "runs"]);
    return list.map((item) => normalizeRun(item as Record<string, unknown>));
  }

  async listJobs(repo: RepoRef, runId: number | string, limit?: number): Promise<Job[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listJobs;
    if (!path) {
      throw new EndpointError("Jobs endpoint not available");
    }
    const runPath = fillPlaceholder(
      fillPlaceholder(fillRepoPath(path, repo), "{run}", runId),
      "{run_id}",
      runId,
    );
    const url = withQuery(runPath, {
      limit: limit ? String(limit) : undefined,
    });
    const response = await this.client.getJson<Record<string, unknown>>(url);
    const list = extractArray(response, ["workflow_jobs", "jobs", "entries"]);
    return list.map((item) => normalizeJob(item as Record<string, unknown>));
  }

  async getJobLogs(repo: RepoRef, jobId: number | string): Promise<string> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.jobLogs;
    if (!path) {
      throw new EndpointError("Job logs endpoint not available");
    }
    const url = fillPlaceholder(
      fillPlaceholder(fillRepoPath(path, repo), "{job_id}", jobId),
      "{job}",
      jobId,
    );
    return this.client.getText(url);
  }

  async listArtifacts(repo: RepoRef, runId: number | string): Promise<Artifact[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listRunArtifacts ?? endpoints.listRepoArtifacts;
    if (!path) {
      return [];
    }
    const base = fillPlaceholder(
      fillPlaceholder(fillRepoPath(path, repo), "{run}", runId),
      "{run_id}",
      runId,
    );
    const response = await this.client.getJson<Record<string, unknown>>(base);
    const list = extractArray(response, ["artifacts", "entries"]);
    return list.map((item) => normalizeArtifact(item as Record<string, unknown>));
  }

  /**
   * Downloads an artifact to a file at the given base directory.
   * Uses artifact.downloadUrl (GET); saves as zip/single file. No partial file on failure.
   * If the server returns 200 with an HTML page containing a redirect link (e.g. Gitea's "Found" page),
   * follows that link to get the actual binary.
   * @returns The full path of the saved file.
   */
  async downloadArtifactToFile(
    repo: RepoRef,
    runId: number | string,
    artifact: Artifact,
    baseDir: string,
  ): Promise<string> {
    if (!artifact.downloadUrl?.trim()) {
      throw new EndpointError("Artifact has no download URL");
    }
    const savePath = computeArtifactSavePath(baseDir, repo, runId, artifact);
    let buffer: Uint8Array;
    try {
      buffer = await this.client.getBinary(artifact.downloadUrl.trim());
      const redirectUrl = extractRedirectUrlFromHtml(buffer);
      if (redirectUrl) {
        buffer = await this.client.getBinary(redirectUrl);
      }
    } catch (error) {
      if (error instanceof HttpError) {
        throw new EndpointError(
          `Failed to download artifact: ${error.status} ${error.message}`.trim(),
        );
      }
      throw error;
    }
    const dir = path.dirname(savePath);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (error) {
      throw new EndpointError(`Cannot create directory for artifact: ${String(error)}`);
    }
    try {
      fs.writeFileSync(savePath, buffer);
    } catch (error) {
      try {
        fs.unlinkSync(savePath);
      } catch {
        /* ignore */
      }
      throw new EndpointError(`Failed to write artifact file: ${String(error)}`);
    }
    return savePath;
  }

  async listPullRequests(repo: RepoRef): Promise<PullRequest[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listPullRequests;
    if (!path) {
      return [];
    }
    const url = withQuery(fillRepoPath(path, repo), { state: "open" });
    const response = await this.client.getJson<Record<string, unknown> | unknown[]>(url);
    const list = Array.isArray(response) ? response : extractArray(response, ["entries", "pulls"]);
    return list.map((item) => normalizePullRequest(item as Record<string, unknown>));
  }

  async listPullRequestReviews(
    repo: RepoRef,
    pullRequestNumber: number,
  ): Promise<PullRequestReview[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listPullRequestReviews;
    if (!path) {
      return [];
    }
    const url = withQuery(fillPlaceholder(fillRepoPath(path, repo), "{index}", pullRequestNumber), {
      state: "all",
    });
    const response = await this.client.getJson<Record<string, unknown> | unknown[]>(url);
    const list = Array.isArray(response)
      ? response
      : extractArray(response, ["entries", "reviews"]);
    const items = list.length === 0 && isObjectWithId(response) ? [response] : list;
    return items.map((item) => normalizePullRequestReview(item as Record<string, unknown>));
  }

  async listPullRequestReviewComments(
    repo: RepoRef,
    pullRequestNumber: number,
    reviewId: number | string,
  ): Promise<PullRequestReviewComment[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listPullRequestReviewComments;
    if (!path) {
      return [];
    }
    const url = fillPlaceholder(
      fillPlaceholder(fillRepoPath(path, repo), "{index}", pullRequestNumber),
      "{id}",
      reviewId,
    );
    const response = await this.client.getJson<Record<string, unknown> | unknown[]>(url);
    const list = Array.isArray(response)
      ? response
      : extractArray(response, ["entries", "comments"]);
    return list.map((item) => normalizePullRequestReviewComment(item as Record<string, unknown>));
  }

  async createPullRequestReviewComment(
    repo: RepoRef,
    pullRequestNumber: number,
    options: { body: string; path: string; line: number; commitId?: string },
  ): Promise<void> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listPullRequestReviews;
    if (!path) {
      throw new EndpointError("Pull request reviews endpoint not available");
    }
    const url = fillPlaceholder(fillRepoPath(path, repo), "{index}", pullRequestNumber);
    await this.client.requestText("POST", url, {
      body: {
        event: "COMMENT",
        commit_id: options.commitId,
        comments: [
          {
            body: options.body,
            path: options.path,
            new_position: options.line,
            old_position: 0,
          },
        ],
      },
    });
  }

  async getPullRequestDiff(repo: RepoRef, pullRequestNumber: number): Promise<string> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/pulls/${encodeURIComponent(String(pullRequestNumber))}.diff`;
    return this.client.getText(path);
  }

  async fetchBinaryUrl(url: string): Promise<Uint8Array> {
    return this.client.getBinary(url);
  }

  async getCombinedStatus(repo: RepoRef, ref: string): Promise<RepoStatus> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/commits/${encodeURIComponent(ref)}/status`;
    const response = await this.client.getJson<Record<string, unknown>>(path);
    return normalizeRepoStatus(response);
  }

  async listSecrets(repo: RepoRef): Promise<Secret[]> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/secrets`;
    const response = await this.client.getJson<{ secrets?: Secret[] }>(path);
    return response.secrets ?? [];
  }

  async createOrUpdateSecret(
    repo: RepoRef,
    secretName: string,
    data: string,
    description?: string,
  ): Promise<void> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/actions/secrets/${encodeURIComponent(secretName)}`;
    await this.client.requestText("PUT", path, {
      body: {
        data,
        description,
      },
    });
  }

  async deleteSecret(repo: RepoRef, secretName: string): Promise<void> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/actions/secrets/${encodeURIComponent(secretName)}`;
    await this.client.requestText("DELETE", path);
  }

  async listVariables(repo: RepoRef): Promise<ActionVariable[]> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/actions/variables`;
    const response = await this.client.getJson<{ variables?: ActionVariable[] }>(path);
    return response.variables ?? [];
  }

  async getVariable(repo: RepoRef, variableName: string): Promise<ActionVariable> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/actions/variables/${encodeURIComponent(variableName)}`;
    return this.client.getJson<ActionVariable>(path);
  }

  async createVariable(
    repo: RepoRef,
    variableName: string,
    value: string,
    description?: string,
  ): Promise<void> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/actions/variables/${encodeURIComponent(variableName)}`;
    await this.client.requestText("POST", path, {
      body: {
        name: variableName,
        value,
        description,
      },
    });
  }

  async updateVariable(
    repo: RepoRef,
    variableName: string,
    value: string,
    description?: string,
    newName?: string,
  ): Promise<void> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/actions/variables/${encodeURIComponent(variableName)}`;
    await this.client.requestText("PUT", path, {
      body: {
        name: newName ?? variableName,
        value,
        description,
      },
    });
  }

  async deleteVariable(repo: RepoRef, variableName: string): Promise<void> {
    const path = `/api/v1/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.name,
    )}/actions/variables/${encodeURIComponent(variableName)}`;
    await this.client.requestText("DELETE", path);
  }

  async listAccessibleRepos(): Promise<RepoRef[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listRepos;
    if (!path) {
      throw new EndpointError("Repository listing endpoint not available");
    }
    const pageSize = 50;
    const response: unknown[] = [];
    for (let page = 1; ; page += 1) {
      const items = await this.client.getJson<unknown[]>(
        withQuery(path, { page: String(page), limit: String(pageSize) }),
      );
      response.push(...items);
      if (items.length < pageSize) {
        break;
      }
    }
    const host = getHost(this.baseUrlProvider());
    if (!host) {
      return [];
    }

    return response
      .map((item) => item as Record<string, unknown>)
      .map((repo) => ({
        host,
        owner: asString((repo.owner as Record<string, unknown> | undefined)?.login) ?? "",
        name: asString(repo.name) ?? "",
        htmlUrl: asString(repo.html_url),
      }))
      .filter((repo) => repo.owner && repo.name);
  }

  async ensureEndpoints(): Promise<EndpointMap> {
    const baseUrl = this.baseUrlProvider();
    if (this.endpoints && this.lastBaseUrl === baseUrl) {
      return this.endpoints;
    }

    try {
      const swagger = await fetchSwagger(this.client);
      this.endpoints = discoverEndpoints(swagger);
    } catch (error) {
      this.endpoints = error instanceof HttpError ? fallbackEndpoints() : fallbackEndpoints();
    }

    this.lastBaseUrl = baseUrl;
    return this.endpoints;
  }
}

/**
 * Substitutes a `{placeholder}` in an endpoint template with a URL-encoded value.
 *
 * The replacement is passed as a function so `$`-sequences in the value are never interpreted as
 * `String#replace` patterns.
 */
function fillPlaceholder(path: string, placeholder: string, value: string | number): string {
  return path.replace(placeholder, () => encodeURIComponent(String(value)));
}

function fillRepoPath(path: string, repo: RepoRef): string {
  return fillPlaceholder(fillPlaceholder(path, "{owner}", repo.owner), "{repo}", repo.name);
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return path;
  }
  const url = new URL(path, "http://localhost");
  for (const [key, value] of entries) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  const query = url.searchParams.toString();
  return query ? `${path}?${query}` : path;
}

export type Secret = {
  name: string;
  description?: string;
  created_at?: string;
  createdAt?: string;
};

export type ActionVariable = {
  name: string;
  value?: string;
  data?: string;
  description?: string;
};

function extractArray(response: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  if (Array.isArray(response)) {
    return response;
  }
  return [];
}

function isObjectWithId(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && "id" in value;
}

function getHost(baseUrl: string): string | undefined {
  try {
    return new URL(baseUrl).host;
  } catch {
    return undefined;
  }
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

/**
 * If the response body looks like an HTML redirect page (e.g. Gitea's "Found" link),
 * extracts the first href URL. Returns null otherwise.
 */
function extractRedirectUrlFromHtml(buffer: Uint8Array): string | null {
  const max = Math.min(buffer.length, 4096);
  if (max < 10) {
    return null;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(buffer.subarray(0, max));
  } catch {
    return null;
  }
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("<")) {
    return null;
  }
  const hrefMatch = /href\s*=\s*["'](?<url>[^"']+)["']/i.exec(text);
  if (!hrefMatch?.[1]) {
    return null;
  }
  return hrefMatch[1].replaceAll(/&amp;/gi, "&");
}
