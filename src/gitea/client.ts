import { Agent, request, type Dispatcher } from "undici";

export type ClientConfig = {
  baseUrl: string;
  token?: string;
  insecureSkipVerify: boolean;
};

export class HttpError extends Error {
  status: number;
  url: string;

  constructor(status: number, url: string, message: string) {
    super(message);
    this.status = status;
    this.url = url;
  }
}

export class GiteaHttpClient {
  private readonly configProvider: () => ClientConfig;
  private readonly agentProvider: () => Agent | undefined;

  constructor(configProvider: () => ClientConfig) {
    this.configProvider = configProvider;
    this.agentProvider = () => {
      const config = this.configProvider();
      if (!config.baseUrl || !config.baseUrl.startsWith("https")) {
        return undefined;
      }
      return new Agent({
        connect: {
          rejectUnauthorized: !config.insecureSkipVerify,
        },
      });
    };
  }

  async getJson<T>(path: string, options?: { allowMissingBaseUrl?: boolean }): Promise<T> {
    return this.requestJson<T>("GET", path, options);
  }

  async getText(path: string): Promise<string> {
    return this.requestText("GET", path);
  }

  async requestJson<T>(
    method: Dispatcher.HttpMethod,
    path: string,
    options?: { allowMissingBaseUrl?: boolean; body?: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const response = await this.request(method, path, options);
    return (await response.body.json()) as T;
  }

  async requestText(
    method: Dispatcher.HttpMethod,
    path: string,
    options?: { allowMissingBaseUrl?: boolean; body?: unknown; headers?: Record<string, string> },
  ): Promise<string> {
    const response = await this.request(method, path, options);
    return response.body.text();
  }

  private async request(
    method: Dispatcher.HttpMethod,
    path: string,
    options?: { allowMissingBaseUrl?: boolean; body?: unknown; headers?: Record<string, string> },
  ): Promise<ReturnType<typeof request>> {
    const { baseUrl, token } = this.configProvider();
    if (!baseUrl && !options?.allowMissingBaseUrl) {
      throw new Error("Base URL is not configured");
    }

    const url = buildUrl(baseUrl, path);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    const dispatcher = this.agentProvider();
    const response = await request(url, {
      method,
      headers,
      body,
      dispatcher,
    });

    if (response.statusCode >= 400) {
      const body = await response.body.text();
      throw new HttpError(response.statusCode, url, body || `HTTP ${response.statusCode}`);
    }

    return response;
  }
}

function buildUrl(baseUrl: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (!baseUrl) {
    return path;
  }
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}
