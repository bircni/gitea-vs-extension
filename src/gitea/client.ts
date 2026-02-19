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
  private cachedAgent?: Agent;
  private lastInsecureSkipVerify?: boolean;

  constructor(configProvider: () => ClientConfig) {
    this.configProvider = configProvider;
  }

  private getAgent(): Agent | undefined {
    const config = this.configProvider();
    if (!config.baseUrl.startsWith("https")) {
      return undefined;
    }

    // Cache and reuse agent if insecureSkipVerify hasn't changed
    if (this.cachedAgent && this.lastInsecureSkipVerify === config.insecureSkipVerify) {
      return this.cachedAgent;
    }

    this.cachedAgent = new Agent({
      connect: {
        rejectUnauthorized: !config.insecureSkipVerify,
      },
    });
    this.lastInsecureSkipVerify = config.insecureSkipVerify;
    return this.cachedAgent;
  }

  async getJson<T>(path: string, options?: { allowMissingBaseUrl?: boolean }): Promise<T> {
    return this.requestJson<T>("GET", path, options);
  }

  async getText(path: string): Promise<string> {
    return this.requestText("GET", path);
  }

  async getBinary(path: string): Promise<Uint8Array> {
    return this.requestBinary("GET", path);
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

  async requestBinary(
    method: Dispatcher.HttpMethod,
    path: string,
    options?: { allowMissingBaseUrl?: boolean; body?: unknown; headers?: Record<string, string> },
  ): Promise<Uint8Array> {
    const response = await this.request(method, path, options);
    const buffer = await response.body.arrayBuffer();
    return new Uint8Array(buffer);
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
    const sameOrigin = isSameOrigin(baseUrl, url);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token && sameOrigin) {
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

    const dispatcher = sameOrigin ? this.getAgent() : undefined;
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

function isSameOrigin(baseUrl: string, url: string): boolean {
  try {
    const targetOrigin = new URL(url).origin;
    if (!baseUrl) {
      return false;
    }
    const baseOrigin = new URL(baseUrl).origin;
    return targetOrigin === baseOrigin;
  } catch {
    return false;
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
