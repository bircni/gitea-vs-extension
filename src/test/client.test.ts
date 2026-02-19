import { GiteaHttpClient } from "../gitea/client";
import { Agent, request } from "undici";

jest.mock("undici", () => {
  const request = jest.fn();
  const Agent = jest.fn().mockImplementation((options) => ({ options }));
  return { request, Agent };
});

const requestMock = request as jest.MockedFunction<typeof request>;
const AgentMock = Agent as unknown as jest.Mock;

type MockBody = {
  text?: string;
  json?: unknown;
  arrayBuffer?: Uint8Array;
};

const mockResponse = (statusCode: number, body: MockBody) => ({
  statusCode,
  body: {
    text: jest.fn(async () => body.text ?? ""),
    json: jest.fn(async () => body.json),
    arrayBuffer: jest.fn(async () => (body.arrayBuffer ?? new Uint8Array()).buffer),
  },
});

beforeEach(() => {
  requestMock.mockReset();
  AgentMock.mockClear();
});

test("builds url from base and path", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { json: { ok: true } }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com/api/",
    token: undefined,
    insecureSkipVerify: false,
  }));

  await client.getJson("repos");

  expect(requestMock).toHaveBeenCalledWith(
    "https://gitea.example.com/api/repos",
    expect.objectContaining({ method: "GET" }),
  );
});

test("passes through absolute urls", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { text: "ok" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: undefined,
    insecureSkipVerify: false,
  }));

  await client.getText("https://other.example.com/api/ping");

  expect(requestMock).toHaveBeenCalledWith(
    "https://other.example.com/api/ping",
    expect.any(Object),
  );
});

test("does not send auth header for cross-origin absolute urls", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { text: "ok" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: "token-value",
    insecureSkipVerify: true,
  }));

  await client.getText("https://avatars.example.net/u/123.png");

  const [, options] = requestMock.mock.calls[0];
  expect(options.headers).toMatchObject({
    Accept: "application/json",
  });
  expect(options.headers).not.toHaveProperty("Authorization");
  expect(options.dispatcher).toBeUndefined();
});

test("sends auth header for same-origin absolute urls", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { text: "ok" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: "token-value",
    insecureSkipVerify: false,
  }));

  await client.getText("https://gitea.example.com/avatars/1.png");

  const [, options] = requestMock.mock.calls[0];
  expect(options.headers).toMatchObject({
    Accept: "application/json",
    Authorization: "token token-value",
  });
});

test("throws when base url is missing", async () => {
  const client = new GiteaHttpClient(() => ({
    baseUrl: "",
    token: undefined,
    insecureSkipVerify: false,
  }));

  await expect(client.getText("/repos")).rejects.toThrow("Base URL is not configured");
  expect(requestMock).not.toHaveBeenCalled();
});

test("allows requests without base url when configured", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { text: "ok" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "",
    token: undefined,
    insecureSkipVerify: false,
  }));

  await client.requestText("GET", "https://example.com/api/health", {
    allowMissingBaseUrl: true,
  });

  expect(requestMock).toHaveBeenCalledWith("https://example.com/api/health", expect.any(Object));
});

test("sends auth header and json body when provided", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { json: { ok: true } }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: "token-value",
    insecureSkipVerify: false,
  }));

  await client.requestJson("POST", "/repos", {
    body: { name: "demo" },
    headers: { "x-trace-id": "abc" },
  });

  const [, options] = requestMock.mock.calls[0];
  expect(options.headers).toMatchObject({
    Accept: "application/json",
    Authorization: "token token-value",
    "content-type": "application/json",
    "x-trace-id": "abc",
  });
  expect(options.body).toBe(JSON.stringify({ name: "demo" }));
});

test("throws HttpError with response body", async () => {
  requestMock.mockResolvedValue(mockResponse(404, { text: "not found" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: undefined,
    insecureSkipVerify: false,
  }));

  await expect(client.getText("/missing")).rejects.toMatchObject({
    status: 404,
    url: "https://gitea.example.com/missing",
    message: "not found",
  });
});

test("uses https agent with insecure configuration", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { text: "ok" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: undefined,
    insecureSkipVerify: true,
  }));

  await client.getText("/repos");

  expect(AgentMock).toHaveBeenCalledWith({
    connect: { rejectUnauthorized: false },
  });
  const [, options] = requestMock.mock.calls[0];
  expect(options.dispatcher).toEqual({ options: { connect: { rejectUnauthorized: false } } });
});

test("returns binary data when requested", async () => {
  const payload = new Uint8Array([1, 2, 3]);
  requestMock.mockResolvedValue(mockResponse(200, { arrayBuffer: payload }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: undefined,
    insecureSkipVerify: false,
  }));

  const result = await client.getBinary("/avatar.png");

  expect(result).toEqual(payload);
});

test("reuses cached agent when tls setting stays the same", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { text: "ok" }));
  let insecure = true;
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: undefined,
    insecureSkipVerify: insecure,
  }));

  await client.getText("/repos");
  await client.getText("/repos");

  expect(AgentMock).toHaveBeenCalledTimes(1);

  insecure = false;
  await client.getText("/repos");
  expect(AgentMock).toHaveBeenCalledTimes(2);
});

test("does not create agent for http urls", async () => {
  requestMock.mockResolvedValue(mockResponse(200, { text: "ok" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "http://gitea.example.com",
    token: undefined,
    insecureSkipVerify: true,
  }));

  await client.getText("/repos");

  expect(AgentMock).not.toHaveBeenCalled();
  const [, options] = requestMock.mock.calls[0];
  expect(options.dispatcher).toBeUndefined();
});

test("falls back to generic http error message when body is empty", async () => {
  requestMock.mockResolvedValue(mockResponse(500, { text: "" }));
  const client = new GiteaHttpClient(() => ({
    baseUrl: "https://gitea.example.com",
    token: undefined,
    insecureSkipVerify: false,
  }));

  await expect(client.getText("/missing")).rejects.toMatchObject({
    status: 500,
    message: "HTTP 500",
  });
});
