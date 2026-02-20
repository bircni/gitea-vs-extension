export type RepoRef = {
  host: string;
  owner: string;
  name: string;
  htmlUrl?: string;
};

export type WorkflowRun = {
  id: number | string;
  name: string;
  workflowName?: string;
  displayTitle?: string;
  runNumber?: number;
  actor?: string;
  event?: string;
  commitMessage?: string;
  branch?: string;
  sha?: string;
  status: "queued" | "running" | "completed" | "unknown";
  conclusion?: "success" | "failure" | "cancelled" | "skipped" | "unknown";
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  completedAt?: string;
  htmlUrl?: string;
};

export type Job = {
  id: number | string;
  name: string;
  status: "queued" | "running" | "completed" | "unknown";
  conclusion?: "success" | "failure" | "cancelled" | "skipped" | "unknown";
  startedAt?: string;
  completedAt?: string;
  htmlUrl?: string;
  steps?: Step[];
};

export type Step = {
  name?: string;
  status: "queued" | "running" | "completed" | "unknown";
  conclusion?: "success" | "failure" | "cancelled" | "skipped" | "unknown";
  startedAt?: string;
  completedAt?: string;
};
export type Artifact = {
  id: number | string;
  name: string;
  sizeInBytes?: number;
  createdAt?: string;
  updatedAt?: string;
  downloadUrl?: string;
};

export type ActionWorkflow = {
  id: number | string;
  name: string;
  path?: string;
  state?: string;
  createdAt?: string;
  updatedAt?: string;
  url?: string;
  htmlUrl?: string;
};

export type PullRequest = {
  id: number | string;
  number: number;
  title: string;
  state: "open" | "closed" | "merged" | "unknown";
  author?: string;
  labels?: PullRequestLabel[];
  htmlUrl?: string;
  updatedAt?: string;
  headRef?: string;
  headSha?: string;
  baseRef?: string;
  baseSha?: string;
};

export type PullRequestLabel = {
  name: string;
  color?: string;
};

export type PullRequestReview = {
  id: number | string;
  state?: string;
  body?: string;
  author?: string;
  submittedAt?: string;
  htmlUrl?: string;
};

export type PullRequestReviewComment = {
  id: number | string;
  body?: string;
  path?: string;
  line?: number;
  originalLine?: number;
  position?: number;
  originalPosition?: number;
  commitId?: string;
  diffHunk?: string;
  author?: string;
  avatarUrl?: string;
  resolver?: string;
  createdAt?: string;
  updatedAt?: string;
  reviewId?: number | string;
};

export type RepoStatusState =
  | "pending"
  | "success"
  | "error"
  | "failure"
  | "warning"
  | "skipped"
  | "unknown";

export type RepoStatus = {
  state: RepoStatusState;
  description?: string;
  targetUrl?: string;
  updatedAt?: string;
};

export type ApiStatus = "queued" | "running" | "completed" | "unknown";
export type ApiConclusion = "success" | "failure" | "cancelled" | "skipped" | "unknown";

export function normalizeStatus(input?: string): ApiStatus {
  if (!input) {
    return "unknown";
  }
  const value = input.toLowerCase();
  if (["queued", "pending", "waiting"].includes(value)) {
    return "queued";
  }
  if (["running", "in_progress"].includes(value)) {
    return "running";
  }
  if (["completed", "success", "failure", "cancelled", "skipped"].includes(value)) {
    return "completed";
  }
  return "unknown";
}

export function normalizeConclusion(input?: string): ApiConclusion | undefined {
  if (!input) {
    return undefined;
  }
  const value = input.toLowerCase();
  if (value === "success") {
    return "success";
  }
  if (value === "failure" || value === "failed" || value === "error") {
    return "failure";
  }
  if (value === "cancelled" || value === "canceled") {
    return "cancelled";
  }
  if (value === "skipped") {
    return "skipped";
  }
  if (value === "neutral" || value === "completed") {
    return "unknown";
  }
  return "unknown";
}

function normalizeRepoStatusState(input: string): RepoStatusState {
  const value = input.toLowerCase();
  if (value === "pending") {
    return "pending";
  }
  if (value === "success") {
    return "success";
  }
  if (value === "error") {
    return "error";
  }
  if (value === "failure" || value === "failed") {
    return "failure";
  }
  if (value === "warning") {
    return "warning";
  }
  if (value === "skipped") {
    return "skipped";
  }
  return "unknown";
}

export function normalizeRun(raw: Record<string, unknown>): WorkflowRun {
  const status = normalizeStatus(asString(raw.status));
  const conclusion = normalizeConclusion(asString(raw.conclusion ?? raw.result ?? raw.outcome));
  const pathRef = extractRefFromPath(asString(raw.path));
  const branch = normalizeBranch(
    asString(
      raw.head_branch ??
        raw.branch ??
        raw.ref_name ??
        raw.ref ??
        raw.head_ref ??
        raw.base_ref ??
        pathRef,
    ),
  );

  return {
    id: asId(raw.id ?? raw.run_id ?? raw.number ?? raw.run_number),
    // Intentionally use || instead of ?? to treat empty strings as falsy
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
    name:
      asString(raw.name) ||
      asString(raw.display_title) ||
      asString(raw.workflow_name) ||
      "Workflow run",
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
    workflowName: asString(raw.workflow_name),
    displayTitle: asString(raw.display_title),
    runNumber: asNumber(raw.run_number),
    actor: asString((raw.actor as Record<string, unknown> | undefined)?.login),
    event: asString(raw.event),
    commitMessage: asString(raw.commit_message),
    branch,
    sha: asString(raw.head_sha ?? raw.sha),
    status,
    conclusion,
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
    startedAt: asString(raw.started_at),
    completedAt: asString(raw.completed_at),
    htmlUrl: asString(raw.html_url ?? raw.url),
  };
}

export function normalizeJob(raw: Record<string, unknown>): Job {
  const status = normalizeStatus(asString(raw.status));
  const conclusion = normalizeConclusion(asString(raw.conclusion ?? raw.result ?? raw.outcome));
  const stepsRaw = Array.isArray(raw.steps) ? raw.steps : [];
  const steps = stepsRaw.map((step) => normalizeStep(step as Record<string, unknown>));

  return {
    id: asId(raw.id ?? raw.job_id),
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    name: asString(raw.name) || "Job",
    status,
    conclusion,
    startedAt: asString(raw.started_at),
    completedAt: asString(raw.completed_at),
    htmlUrl: asString(raw.html_url ?? raw.url),
    steps,
  };
}

export function normalizeStep(raw: Record<string, unknown>): Step {
  return {
    name: asString(raw.name),
    status: normalizeStatus(asString(raw.status)),
    conclusion: normalizeConclusion(asString(raw.conclusion)),
    startedAt: asString(raw.started_at),
    completedAt: asString(raw.completed_at),
  };
}

export function normalizeArtifact(raw: Record<string, unknown>): Artifact {
  return {
    id: asId(raw.id ?? raw.artifact_id),
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    name: asString(raw.name) || "Artifact",
    sizeInBytes: asNumber(raw.size_in_bytes ?? raw.size_in_bytes_bytes ?? raw.size),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
    downloadUrl: asString(raw.archive_download_url ?? raw.url),
  };
}

export function normalizeActionWorkflow(raw: Record<string, unknown>): ActionWorkflow {
  return {
    id: asId(raw.id ?? raw.workflow_id),
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    name: asString(raw.name) || asString(raw.path) || "Workflow",
    path: asString(raw.path),
    state: asString(raw.state),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
    url: asString(raw.url),
    htmlUrl: asString(raw.html_url),
  };
}

export function normalizePullRequest(raw: Record<string, unknown>): PullRequest {
  const stateRaw = asString(raw.state);
  let state: PullRequest["state"] = "unknown";
  if (stateRaw === "open") {
    state = "open";
  } else if (stateRaw === "closed") {
    state = raw.merged ? "merged" : "closed";
  }

  return {
    id: asId(raw.id ?? raw.number),
    number: asNumber(raw.number) ?? 0,
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    title: asString(raw.title) || "Pull request",
    state,
    author: asString((raw.user as Record<string, unknown> | undefined)?.login),
    labels: normalizeLabels(raw.labels),
    htmlUrl: asString(raw.html_url ?? raw.url),
    updatedAt: asString(raw.updated_at),
    headRef: asString((raw.head as Record<string, unknown> | undefined)?.ref),
    headSha: asString((raw.head as Record<string, unknown> | undefined)?.sha),
    baseRef: asString((raw.base as Record<string, unknown> | undefined)?.ref),
    baseSha: asString((raw.base as Record<string, unknown> | undefined)?.sha),
  };
}

export function normalizePullRequestReview(raw: Record<string, unknown>): PullRequestReview {
  return {
    id: asId(raw.id),
    state: asString(raw.state),
    body: asString(raw.body),
    author: asString((raw.user as Record<string, unknown> | undefined)?.login),
    submittedAt: asString(raw.submitted_at ?? raw.submittedAt),
    htmlUrl: asString(raw.html_url ?? raw.url),
  };
}

export function normalizePullRequestReviewComment(
  raw: Record<string, unknown>,
): PullRequestReviewComment {
  return {
    id: asId(raw.id),
    body: asString(raw.body),
    path: asString(raw.path),
    line: asNumber(raw.line),
    originalLine: asNumber(raw.original_line ?? raw.originalLine),
    position: asNumber(raw.position),
    originalPosition: asNumber(raw.original_position ?? raw.originalPosition),
    commitId: asString(raw.commit_id ?? raw.commitId),
    diffHunk: asString(raw.diff_hunk ?? raw.diffHunk),
    author: asString((raw.user as Record<string, unknown> | undefined)?.login),
    avatarUrl: asString((raw.user as Record<string, unknown> | undefined)?.avatar_url),
    resolver: asString((raw.resolver as Record<string, unknown> | undefined)?.login),
    createdAt: asString(raw.created_at),
    updatedAt: asString(raw.updated_at),
    reviewId: asId(raw.review_id ?? raw.reviewId ?? raw.pull_request_review_id),
  };
}

export function normalizeRepoStatus(raw: Record<string, unknown>): RepoStatus {
  const stateRaw = asString(raw.state) ?? "";
  const state = normalizeRepoStatusState(stateRaw);
  return {
    state,
    description: asString(raw.description),
    targetUrl: asString(raw.target_url ?? raw.targetUrl ?? raw.url),
    updatedAt: asString(raw.updated_at),
  };
}

function normalizeBranch(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith("refs/")) {
    return normalizeBranch(value.slice("refs/".length));
  }
  if (value.startsWith("heads/")) {
    return value.slice("heads/".length);
  }
  if (value.startsWith("tags/")) {
    return value.slice("tags/".length);
  }
  if (value.startsWith("refs/pull/")) {
    const prMatch = /^refs\/pull\/(\d+)\/head$/.exec(value);
    if (prMatch) {
      return `PR #${prMatch[1]}`;
    }
    return value;
  }
  const prMatch = /^pull\/(\d+)\/head$/.exec(value);
  if (prMatch) {
    return `PR #${prMatch[1]}`;
  }
  return value;
}

function extractRefFromPath(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  const atIndex = path.lastIndexOf("@");
  if (atIndex === -1 || atIndex === path.length - 1) {
    return undefined;
  }
  return path.slice(atIndex + 1);
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
}

function asId(value: unknown): number | string {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return "unknown";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeLabels(value: unknown): PullRequestLabel[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const labels = value
    .map((label) => label as Record<string, unknown>)
    .map((label) => ({
      name: asString(label.name) ?? "",
      color: asString(label.color),
    }))
    .filter((label) => label.name);
  return labels.length ? labels : undefined;
}
