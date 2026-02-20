// ...existing code...
import {
  normalizeActionWorkflow,
  normalizeArtifact,
  normalizeConclusion,
  normalizeJob,
  normalizePullRequest,
  normalizePullRequestCommit,
  normalizePullRequestFile,
  normalizePullRequestReviewComment,
  normalizeRun,
  normalizeRepoStatus,
  normalizeStatus,
  normalizeStep,
} from "../gitea/models";

test("normalizes status values", () => {
  expect(normalizeStatus("queued")).toBe("queued");
  expect(normalizeStatus("pending")).toBe("queued");
  expect(normalizeStatus("in_progress")).toBe("running");
  expect(normalizeStatus("success")).toBe("completed");
  expect(normalizeStatus("unknown-value")).toBe("unknown");
  expect(normalizeStatus(undefined)).toBe("unknown");
});

test("normalizes conclusion values", () => {
  expect(normalizeConclusion("success")).toBe("success");
  expect(normalizeConclusion("failed")).toBe("failure");
  expect(normalizeConclusion("canceled")).toBe("cancelled");
  expect(normalizeConclusion("skipped")).toBe("skipped");
  expect(normalizeConclusion("neutral")).toBe("unknown");
  expect(normalizeConclusion("completed")).toBe("unknown");
  expect(normalizeConclusion("error")).toBe("failure");
  expect(normalizeConclusion(undefined)).toBeUndefined();
});

test("normalizes run payload", () => {
  const run = normalizeRun({
    id: 42,
    display_title: "CI",
    run_number: 17,
    head_branch: "main",
    head_sha: "abcdef123456",
    status: "running",
    conclusion: "success",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T01:00:00Z",
    html_url: "http://localhost:3000/owner/repo/actions/runs/42",
  });

  expect(run.id).toBe(42);
  expect(run.name).toBe("CI");
  expect(run.runNumber).toBe(17);
  expect(run.branch).toBe("main");
  expect(run.sha).toBe("abcdef123456");
  expect(run.status).toBe("running");
  expect(run.conclusion).toBe("success");
  expect(run.htmlUrl).toBe("http://localhost:3000/owner/repo/actions/runs/42");
});

test("normalizes run payload with fallback fields", () => {
  const run = normalizeRun({
    run_id: "99",
    display_title: "Build",
    workflow_name: "build.yml",
    run_number: "8",
    actor: { login: "octo" },
    event: "push",
    commit_message: "Add CI",
    ref: "refs/heads/main",
    sha: "deadbeef",
    status: "waiting",
    result: "neutral",
  });

  expect(run.id).toBe("99");
  expect(run.name).toBe("Build");
  expect(run.workflowName).toBe("build.yml");
  expect(run.runNumber).toBe(8);
  expect(run.actor).toBe("octo");
  expect(run.event).toBe("push");
  expect(run.commitMessage).toBe("Add CI");
  expect(run.branch).toBe("main");
  expect(run.sha).toBe("deadbeef");
  expect(run.status).toBe("queued");
  expect(run.conclusion).toBe("unknown");
});

test("normalizes branch from ref_name", () => {
  const run = normalizeRun({
    id: 1,
    display_title: "CI",
    ref_name: "feature/test",
    status: "success",
  });

  expect(run.branch).toBe("feature/test");
});

test("normalizes branch from path ref", () => {
  const run = normalizeRun({
    id: 2,
    display_title: "CI",
    path: "ci.yml@refs/pull/1/head",
    status: "success",
  });

  expect(run.branch).toBe("PR #1");
});

test("normalizes branch prefixes", () => {
  const headsRun = normalizeRun({
    id: 3,
    display_title: "CI",
    ref: "refs/heads/dev",
    status: "success",
  });
  const tagsRun = normalizeRun({
    id: 4,
    display_title: "CI",
    ref: "refs/tags/v1.0.0",
    status: "success",
  });
  const pullRun = normalizeRun({
    id: 5,
    display_title: "CI",
    ref: "pull/42/head",
    status: "success",
  });

  expect(headsRun.branch).toBe("dev");
  expect(tagsRun.branch).toBe("v1.0.0");
  expect(pullRun.branch).toBe("PR #42");
});

test("normalizes pull request refs from refs/pull", () => {
  const run = normalizeRun({
    id: 6,
    display_title: "CI",
    ref: "refs/pull/7/head",
    status: "success",
  });

  expect(run.branch).toBe("PR #7");
});

test("normalizes job payload", () => {
  const job = normalizeJob({
    id: 7,
    name: "build",
    status: "queued",
    conclusion: "failure",
    started_at: "2024-01-01T00:00:00Z",
    completed_at: "2024-01-01T00:01:00Z",
    html_url: "http://localhost:3000/owner/repo/actions/jobs/7",
    steps: [
      {
        name: "checkout",
        status: "completed",
        conclusion: "success",
        started_at: "2024-01-01T00:00:00Z",
        completed_at: "2024-01-01T00:00:10Z",
      },
    ],
  });

  expect(job.id).toBe(7);
  expect(job.name).toBe("build");
  expect(job.status).toBe("queued");
  expect(job.conclusion).toBe("failure");
  expect(job.htmlUrl).toBe("http://localhost:3000/owner/repo/actions/jobs/7");
  expect(job.steps?.length).toBe(1);
  expect(job.steps?.[0]?.name).toBe("checkout");
});

test("normalizes job payload with empty steps", () => {
  const job = normalizeJob({
    id: "job-1",
    name: "lint",
    status: "completed",
    steps: "not-an-array",
  });

  expect(job.steps).toEqual([]);
});

test("normalizes step payload with defaults", () => {
  const step = normalizeStep({
    name: "install",
    status: "completed",
    conclusion: "error",
  });

  expect(step.name).toBe("install");
  expect(step.status).toBe("completed");
  expect(step.conclusion).toBe("failure");
});

test("normalizes artifact payload", () => {
  const artifact = normalizeArtifact({
    id: 9,
    name: "dist",
    size_in_bytes: 2048,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:10:00Z",
    url: "http://localhost:3000/api/v1/repos/owner/repo/actions/artifacts/9/zip",
  });

  expect(artifact.id).toBe(9);
  expect(artifact.name).toBe("dist");
  expect(artifact.sizeInBytes).toBe(2048);
  expect(artifact.downloadUrl).toBe(
    "http://localhost:3000/api/v1/repos/owner/repo/actions/artifacts/9/zip",
  );
});

test("normalizes artifact payload with string sizes", () => {
  const artifact = normalizeArtifact({
    id: "a1",
    name: "report",
    size: "512",
    url: "http://localhost:3000/archive.zip",
  });

  expect(artifact.id).toBe("a1");
  expect(artifact.sizeInBytes).toBe(512);
  expect(artifact.downloadUrl).toBe("http://localhost:3000/archive.zip");
});

test("normalizes artifact payload with defaults", () => {
  const artifact = normalizeArtifact({
    id: {},
    size_in_bytes_bytes: "not-a-number",
  });

  expect(artifact.id).toBe("unknown");
  expect(artifact.name).toBe("Artifact");
  expect(artifact.sizeInBytes).toBeUndefined();
});

test("normalizes action workflow payload", () => {
  const workflow = normalizeActionWorkflow({
    id: 99,
    path: ".gitea/workflows/build.yml",
    state: "active",
    created_at: "2024-01-01T00:00:00Z",
    html_url: "http://localhost:3000/owner/repo/actions/workflows/99",
  });

  expect(workflow.id).toBe(99);
  expect(workflow.name).toBe(".gitea/workflows/build.yml");
  expect(workflow.path).toBe(".gitea/workflows/build.yml");
  expect(workflow.state).toBe("active");
  expect(workflow.htmlUrl).toBe("http://localhost:3000/owner/repo/actions/workflows/99");
});

test("normalizes pull request payload", () => {
  const pr = normalizePullRequest({
    id: 2,
    number: 2,
    title: "Fix bug",
    state: "closed",
    merged: true,
    user: { login: "octo" },
    labels: [{ name: "bug", color: "ff0000" }, { name: "docs" }],
    html_url: "http://localhost:3000/owner/repo/pulls/2",
    head: { ref: "feature", sha: "abcd" },
    base: { ref: "main", sha: "1234" },
  });

  expect(pr.state).toBe("merged");
  expect(pr.author).toBe("octo");
  expect(pr.labels).toEqual([
    { name: "bug", color: "ff0000" },
    { name: "docs", color: undefined },
  ]);
  expect(pr.htmlUrl).toBe("http://localhost:3000/owner/repo/pulls/2");
  expect(pr.headRef).toBe("feature");
  expect(pr.headSha).toBe("abcd");
  expect(pr.baseRef).toBe("main");
  expect(pr.baseSha).toBe("1234");
});

test("normalizes pull request fallback fields", () => {
  const pr = normalizePullRequest({
    number: "3",
    title: "",
    state: "closed",
    merged: false,
    labels: [{ color: "ff0000" }],
    url: "http://localhost:3000/owner/repo/pulls/3",
  });

  expect(pr.id).toBe("3");
  expect(pr.number).toBe(3);
  expect(pr.title).toBe("Pull request");
  expect(pr.state).toBe("closed");
  expect(pr.labels).toBeUndefined();
  expect(pr.htmlUrl).toBe("http://localhost:3000/owner/repo/pulls/3");
});

test("normalizes repository status payload", () => {
  const status = normalizeRepoStatus({
    state: "failed",
    description: "build failed",
    targetUrl: "http://example.com/build",
    updated_at: "2024-01-03T00:00:00Z",
  });

  expect(status.state).toBe("failure");
  expect(status.description).toBe("build failed");
  expect(status.targetUrl).toBe("http://example.com/build");
});

test("normalizes repository status with url fallback and unknown state", () => {
  const status = normalizeRepoStatus({
    state: "unexpected",
    url: "http://example.com/status",
  });

  expect(status.state).toBe("unknown");
  expect(status.targetUrl).toBe("http://example.com/status");
});

test("normalizes pull request review comment payload", () => {
  const comment = normalizePullRequestReviewComment({
    id: 5,
    body: "Needs changes",
    path: "README.md",
    line: 12,
    original_line: 10,
    position: 4,
    commit_id: "deadbeef",
    diff_hunk: "@@ -1,2 +1,3 @@",
    user: { login: "octo" },
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-03T00:00:00Z",
    review_id: 9,
  });

  expect(comment.id).toBe(5);
  expect(comment.body).toBe("Needs changes");
  expect(comment.path).toBe("README.md");
  expect(comment.line).toBe(12);
  expect(comment.originalLine).toBe(10);
  expect(comment.position).toBe(4);
  expect(comment.commitId).toBe("deadbeef");
  expect(comment.diffHunk).toBe("@@ -1,2 +1,3 @@");
  expect(comment.author).toBe("octo");
  expect(comment.reviewId).toBe(9);
});

test("normalizes pull request file payload", () => {
  const file = normalizePullRequestFile({
    filename: "src/index.ts",
    status: "modified",
    additions: 12,
    deletions: 3,
    patch: "@@",
  });

  expect(file.filename).toBe("src/index.ts");
  expect(file.status).toBe("modified");
  expect(file.additions).toBe(12);
  expect(file.deletions).toBe(3);
  expect(file.patch).toBe("@@");
});

test("normalizes pull request commit payload", () => {
  const commit = normalizePullRequestCommit({
    sha: "abcdef123456",
    commit: { message: "feat: add endpoint", author: { name: "octo" } },
    html_url: "http://localhost/commit/abcdef",
  });

  expect(commit.sha).toBe("abcdef123456");
  expect(commit.message).toBe("feat: add endpoint");
  expect(commit.author).toBe("octo");
  expect(commit.htmlUrl).toBe("http://localhost/commit/abcdef");
});
