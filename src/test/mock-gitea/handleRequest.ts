import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { requireToken } from "./auth";
import { TEST_REPO_NAME, TEST_REPO_OWNER } from "./fixture";
import { MIN_SWAGGER_JSON } from "./swaggerDoc";
import type { MockState } from "./state";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(s, "utf8"),
  });
  res.end(s);
}

function sendText(
  res: ServerResponse,
  status: number,
  body: string,
  contentType = "text/plain; charset=utf-8",
): void {
  res.writeHead(status, {
    "content-type": contentType,
    "content-length": Buffer.byteLength(body, "utf8"),
  });
  res.end(body);
}

function sendBytes(res: ServerResponse, status: number, body: Buffer, contentType: string): void {
  res.writeHead(status, { "content-type": contentType, "content-length": body.length });
  res.end(body);
}

function sendNoContent(res: ServerResponse): void {
  res.writeHead(204);
  res.end();
}

/** Run ids the mock serves; anything else answers 404 like a real instance would. */
const KNOWN_RUN_IDS = new Set(["101", "106"]);

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      chunks.push(c);
    });
    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

export function createRequestListener(
  server: Server,
  state: MockState,
): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res): void => {
    void handle(server, state, req, res);
  };
}

async function handle(
  server: Server,
  state: MockState,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const addr = server.address();
    const port = typeof addr === "object" && addr?.port ? addr.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;
    const url = new URL(req.url ?? "/", baseUrl);
    const pathname = url.pathname;
    const method = req.method ?? "GET";

    if (!requireToken(req)) {
      sendText(res, 401, "Unauthorized");
      return;
    }

    if (
      method === "GET" &&
      ["/swagger.v1.json", "/api/swagger.v1.json", "/api/swagger.json", "/api/swagger"].includes(
        pathname,
      )
    ) {
      sendText(res, 200, MIN_SWAGGER_JSON, "application/json");
      return;
    }

    if (method === "GET" && pathname === "/api/v1/version") {
      sendJson(res, 200, { version: "mock-1.0.0" });
      return;
    }

    if (method === "GET" && pathname === "/api/v1/user/repos") {
      sendJson(res, 200, [
        {
          name: TEST_REPO_NAME,
          html_url: `${baseUrl}/${TEST_REPO_OWNER}/${TEST_REPO_NAME}`,
          owner: { login: TEST_REPO_OWNER },
        },
      ]);
      return;
    }

    if (method === "GET" && pathname === "/api/v1/mock/avatar.png") {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      );
      sendBytes(res, 200, png, "image/png");
      return;
    }

    const repoRe = /^\/api\/v1\/repos\/(?<owner>[^/]+)\/(?<repo>[^/]+)\/(?<rest>.*)$/;
    const mRepo = repoRe.exec(pathname);
    if (mRepo) {
      const owner = decodeURIComponent(mRepo[1]);
      const repo = decodeURIComponent(mRepo[2]);
      if (owner !== TEST_REPO_OWNER || repo !== TEST_REPO_NAME) {
        sendText(res, 404, "not found");
        return;
      }
      const rest = mRepo[3];
      await handleRepoRoutes(state, req, res, method, baseUrl, rest, url.searchParams);
      return;
    }

    sendText(res, 404, "not found");
  } catch {
    if (!res.writableEnded) {
      sendText(res, 500, "error");
    }
  }
}

async function handleRepoRoutes(
  state: MockState,
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  baseUrl: string,
  rest: string,
  search: URLSearchParams,
): Promise<void> {
  if (rest === "actions/runs" && method === "GET") {
    // The all-branches fetch (no `branch`) only sees run 101 on main. A server-side branch fetch
    // returns an extra run (106) scoped to that branch, so the client's merge produces two runs —
    // this lets the e2e suite verify the branch param is forwarded and mergeRunsById combines them.
    const branch = search.get("branch");
    const runs: Record<string, unknown>[] = [
      {
        id: 101,
        status: "completed",
        conclusion: "success",
        name: "Mock workflow",
        workflow_name: "Mock CI",
        head_branch: "main",
        head_sha: "abc123",
        created_at: "2020-01-02T00:00:00Z",
        run_attempt: state.runAttempts.get("101") ?? 1,
      },
    ];
    if (branch) {
      runs.push({
        id: 106,
        status: "completed",
        conclusion: "success",
        name: `Mock ${branch} run`,
        workflow_name: "Mock CI",
        head_branch: branch,
        head_sha: "feed106",
        created_at: "2020-01-01T00:00:00Z",
        run_attempt: state.runAttempts.get("106") ?? 1,
      });
    }
    sendJson(res, 200, { workflow_runs: runs });
    return;
  }

  const rerunRe = /^actions\/runs\/(?<runId>[^/]+)\/(?:rerun|rerun-failed-jobs)$/;
  const mRerun = rerunRe.exec(rest);
  if (mRerun && method === "POST") {
    const runId = decodeURIComponent(mRerun[1]);
    if (!KNOWN_RUN_IDS.has(runId)) {
      sendText(res, 404, "not found");
      return;
    }
    state.runAttempts.set(runId, (state.runAttempts.get(runId) ?? 1) + 1);
    sendJson(res, 201, { id: Number(runId), run_attempt: state.runAttempts.get(runId) });
    return;
  }

  const rerunJobRe = /^actions\/runs\/(?<runId>[^/]+)\/jobs\/(?<jobId>[^/]+)\/rerun$/;
  const mRerunJob = rerunJobRe.exec(rest);
  if (mRerunJob && method === "POST") {
    const runId = decodeURIComponent(mRerunJob[1]);
    if (!KNOWN_RUN_IDS.has(runId)) {
      sendText(res, 404, "not found");
      return;
    }
    state.runAttempts.set(runId, (state.runAttempts.get(runId) ?? 1) + 1);
    sendJson(res, 201, { id: Number(decodeURIComponent(mRerunJob[2])) });
    return;
  }

  const runJobsRe = /^actions\/runs\/(?<runId>[^/]+)\/jobs$/;
  if (runJobsRe.test(rest) && method === "GET") {
    sendJson(res, 200, {
      jobs: [
        {
          id: 201,
          name: "Build",
          status: "completed",
          conclusion: "success",
          steps: [
            { name: "Install", status: "completed", conclusion: "success" },
            { name: "Test", status: "completed", conclusion: "failure" },
          ],
        },
        {
          id: 202,
          name: "Lint",
          status: "completed",
          conclusion: "failure",
        },
      ],
    });
    return;
  }

  if (/^actions\/jobs\/[^/]+\/logs$/.test(rest) && method === "GET") {
    sendText(res, 200, "mock log line\n");
    return;
  }

  const runArtRe = /^actions\/runs\/(?<runId>[^/]+)\/artifacts$/;
  const mRA = runArtRe.exec(rest);
  if (mRA && method === "GET") {
    const runId = mRA[1];
    sendJson(res, 200, {
      artifacts: [
        {
          id: 301,
          name: "mock-artifact.zip",
          size_in_bytes: 3,
          created_at: "2020-01-01T00:00:00Z",
          archive_download_url: `${baseUrl}/api/v1/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/actions/runs/${encodeURIComponent(runId)}/artifacts/301/download`,
        },
        {
          id: 302,
          name: "mock-artifact-via-html-redirect.zip",
          size_in_bytes: 8,
          created_at: "2020-01-01T00:00:00Z",
          archive_download_url: `${baseUrl}/api/v1/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/actions/runs/${encodeURIComponent(runId)}/artifacts/302/download`,
        },
      ],
    });
    return;
  }

  if (/^actions\/runs\/[^/]+\/artifacts\/302\/download$/.test(rest) && method === "GET") {
    const runId =
      /^actions\/runs\/(?<runId>[^/]+)\/artifacts\/302\/download$/.exec(rest)?.[1] ?? "101";
    const zipUrl = `${baseUrl}/api/v1/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/actions/runs/${encodeURIComponent(runId)}/artifacts/303/download`;
    const html = `<!DOCTYPE html><html><body><a href="${zipUrl.replaceAll("&", "&amp;")}">Found</a></body></html>`;
    sendText(res, 200, html, "text/html; charset=utf-8");
    return;
  }

  if (/^actions\/runs\/[^/]+\/artifacts\/303\/download$/.test(rest) && method === "GET") {
    sendBytes(res, 200, Buffer.from("REDIRECT_OK"), "application/zip");
    return;
  }

  if (/^actions\/runs\/[^/]+\/artifacts\/[^/]+\/download$/.test(rest) && method === "GET") {
    sendBytes(res, 200, Buffer.from("ZIP"), "application/zip");
    return;
  }

  if (rest === "actions/artifacts" && method === "GET") {
    sendJson(res, 200, {
      artifacts: [
        {
          id: 401,
          name: "repo-scoped-artifact.zip",
          size_in_bytes: 4,
          created_at: "2020-01-01T00:00:00Z",
          archive_download_url: `${baseUrl}/api/v1/repos/${TEST_REPO_OWNER}/${TEST_REPO_NAME}/actions/artifacts/401/download`,
        },
      ],
    });
    return;
  }

  if (rest === "actions/artifacts/401/download" && method === "GET") {
    sendBytes(res, 200, Buffer.from("REPO"), "application/zip");
    return;
  }

  if (rest === "pulls" && method === "GET") {
    sendJson(res, 200, [
      {
        number: 1,
        title: "Mock PR",
        state: "open",
        user: { login: "reviewer", avatar_url: `${baseUrl}/api/v1/mock/avatar.png` },
        html_url: `${baseUrl}/pulls/1`,
        updated_at: "2020-01-01T00:00:00Z",
        head: { ref: "feature", sha: "def456" },
        base: { ref: "main", sha: "abc123" },
      },
    ]);
    return;
  }

  const reviewsRe = /^pulls\/(?<index>[^/]+)\/reviews$/;
  const mRev = reviewsRe.exec(rest);
  if (mRev) {
    if (method === "GET") {
      sendJson(res, 200, {
        reviews: [
          {
            id: 401,
            state: "COMMENTED",
            user: { login: "reviewer" },
            body: "",
            submitted_at: "2020-01-02T00:00:00Z",
          },
          ...[...state.reviewComments.keys()].map((id) => ({
            id,
            state: "COMMENTED",
            user: { login: "reviewer" },
            body: "",
            submitted_at: "2020-01-02T00:00:00Z",
          })),
        ],
      });
      return;
    }
    if (method === "POST") {
      const raw = await readBody(req);
      const body = raw
        ? (JSON.parse(raw) as {
            comments?: { body?: string; path?: string; new_position?: number }[];
          })
        : {};
      const reviewId = state.nextReviewId++;
      state.reviewComments.set(
        reviewId,
        (body.comments ?? []).map((comment) => ({
          id: state.nextReviewCommentId++,
          body: comment.body,
          path: comment.path,
          line: comment.new_position,
        })),
      );
      sendJson(res, 201, { id: reviewId });
      return;
    }
  }

  const commentsRe = /^pulls\/(?<index>[^/]+)\/reviews\/(?<reviewId>[^/]+)\/comments$/;
  const mComments = commentsRe.exec(rest);
  if (mComments && method === "GET") {
    const reviewId = Number(mComments[2]);
    const createdComments = state.reviewComments.get(reviewId);
    if (createdComments) {
      sendJson(res, 200, {
        comments: createdComments.map((comment) => ({
          ...comment,
          user: { login: "reviewer", avatar_url: `${baseUrl}/api/v1/mock/avatar.png` },
          created_at: "2020-01-03T00:00:00Z",
        })),
      });
      return;
    }
    sendJson(res, 200, {
      comments: [
        {
          id: 501,
          body: "nit",
          path: "README.md",
          line: 2,
          user: { login: "reviewer", avatar_url: `${baseUrl}/api/v1/mock/avatar.png` },
          created_at: "2020-01-03T00:00:00Z",
        },
      ],
    });
    return;
  }

  if (/^pulls\/[^/]+\.diff$/.test(rest) && method === "GET") {
    sendText(res, 200, "diff --git a/README.md b/README.md\n", "text/plain; charset=utf-8");
    return;
  }

  if (/^commits\/[^/]+\/status$/.test(rest) && method === "GET") {
    sendJson(res, 200, {
      state: "success",
      description: "mock",
      updated_at: "2020-01-01T00:00:00Z",
    });
    return;
  }

  if (rest === "actions/secrets" && method === "GET") {
    sendJson(
      res,
      200,
      [...state.secrets].map(([name, v]) => ({
        name,
        description: v.description,
        created_at: "2020-01-01T00:00:00Z",
      })),
    );
    return;
  }

  const secRe = /^actions\/secrets\/(?<name>[^/]+)$/;
  const mSec = secRe.exec(rest);
  if (mSec) {
    if (method === "PUT") {
      const raw = await readBody(req);
      const body = raw ? (JSON.parse(raw) as { data?: string; description?: string }) : {};
      state.secrets.set(mSec[1], { description: body.description });
      sendNoContent(res);
      return;
    }
    if (method === "DELETE") {
      state.secrets.delete(mSec[1]);
      sendNoContent(res);
      return;
    }
  }

  if (rest === "actions/variables" && method === "GET") {
    sendJson(
      res,
      200,
      [...state.variables.values()].map((v) => ({
        name: v.name,
        value: v.value ?? v.data,
        description: v.description,
      })),
    );
    return;
  }

  const varRe = /^actions\/variables\/(?<name>[^/]+)$/;
  const mVar = varRe.exec(rest);
  if (mVar) {
    if (method === "GET") {
      const v = state.variables.get(mVar[1]);
      if (!v) {
        sendText(res, 404, "not found");
        return;
      }
      sendJson(res, 200, { name: v.name, data: v.value ?? v.data, description: v.description });
      return;
    }
    if (method === "POST") {
      const raw = await readBody(req);
      const body = raw
        ? (JSON.parse(raw) as { name?: string; value?: string; description?: string })
        : {};
      const name = mVar[1];
      state.variables.set(name, { name, value: body.value, description: body.description });
      sendNoContent(res);
      return;
    }
    if (method === "PUT") {
      const raw = await readBody(req);
      const body = raw
        ? (JSON.parse(raw) as { name?: string; value?: string; description?: string })
        : {};
      const oldName = mVar[1];
      const newName = body.name ?? oldName;
      const prev = state.variables.get(oldName);
      state.variables.delete(oldName);
      state.variables.set(newName, {
        name: newName,
        value: body.value ?? prev?.value,
        description: body.description ?? prev?.description,
      });
      sendNoContent(res);
      return;
    }
    if (method === "DELETE") {
      state.variables.delete(mVar[1]);
      sendNoContent(res);
      return;
    }
  }

  sendText(res, 404, "not found");
}
