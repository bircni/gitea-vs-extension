import { HttpError, type GiteaHttpClient } from "./client";
import { discoverEndpoints, fallbackEndpoints, fetchSwagger, type EndpointMap } from "./swagger";
import {
  normalizeArtifact,
  normalizeJob,
  normalizeNotificationThread,
  normalizePullRequest,
  normalizeRepoStatus,
  normalizeRun,
  type Artifact,
  type Job,
  type NotificationThread,
  type PullRequest,
  type RepoRef,
  type RepoStatus,
  type WorkflowRun,
} from "./models";

export class EndpointError extends Error {
  constructor(message: string) {
    super(message);
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

  async listRuns(repo: RepoRef, limit: number): Promise<WorkflowRun[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listRuns;
    if (!path) {
      throw new EndpointError("Runs endpoint not available");
    }
    const url = withQuery(fillRepoPath(path, repo), { limit: String(limit) });
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
    const url = withQuery(
      fillRepoPath(path, repo)
        .replace("{run}", encodeURIComponent(String(runId)))
        .replace("{run_id}", encodeURIComponent(String(runId))),
      {
        limit: limit ? String(limit) : undefined,
      },
    );
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
    const url = fillRepoPath(path, repo)
      .replace("{job_id}", encodeURIComponent(String(jobId)))
      .replace("{job}", encodeURIComponent(String(jobId)));
    return this.client.getText(url);
  }

  async listArtifacts(repo: RepoRef, runId: number | string): Promise<Artifact[]> {
    const endpoints = await this.ensureEndpoints();
    const path = endpoints.listRunArtifacts ?? endpoints.listRepoArtifacts;
    if (!path) {
      return [];
    }
    const base = fillRepoPath(path, repo)
      .replace("{run}", encodeURIComponent(String(runId)))
      .replace("{run_id}", encodeURIComponent(String(runId)));
    const response = await this.client.getJson<Record<string, unknown>>(base);
    const list = extractArray(response, ["artifacts", "entries"]);
    return list.map((item) => normalizeArtifact(item as Record<string, unknown>));
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

  async listNotifications(): Promise<NotificationThread[]> {
    const url = withQuery("/api/v1/notifications", { "status-types": "unread,pinned" });
    const response = await this.client.getJson<Record<string, unknown> | unknown[]>(url);
    const list = Array.isArray(response)
      ? response
      : extractArray(response, ["entries", "notifications"]);
    return list.map((item) => normalizeNotificationThread(item as Record<string, unknown>));
  }

  async markNotificationRead(id: number | string): Promise<void> {
    const url = withQuery(`/api/v1/notifications/threads/${encodeURIComponent(String(id))}`, {
      "to-status": "read",
    });
    await this.client.requestText("PATCH", url);
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
    const response = await this.client.getJson<unknown[]>(path);
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
      if (error instanceof HttpError) {
        this.endpoints = fallbackEndpoints();
      } else {
        this.endpoints = fallbackEndpoints();
      }
    }

    this.lastBaseUrl = baseUrl;
    return this.endpoints;
  }
}

function fillRepoPath(path: string, repo: RepoRef): string {
  return path
    .replace("{owner}", encodeURIComponent(repo.owner))
    .replace("{repo}", encodeURIComponent(repo.name));
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
