/**
 * Unit tests for util/commandArgs (extractRepo, normalizeLogArg, normalizeRunArg, build*Url, resolveOpenUrl).
 */
import {
  isRepoRef,
  extractRepo,
  normalizeLogArg,
  normalizeRunArg,
  buildRepoUrl,
  buildRunUrl,
  buildJobUrl,
  buildPullRequestUrl,
  resolveOpenUrl,
} from "../util/commandArgs";
import {
  RepoNode,
  RunNode,
  JobNode,
  StepNode,
  ArtifactNode,
  SectionNode,
  PullRequestNode,
  SecretsRootNode,
  SecretNode,
  VariablesRootNode,
  VariableNode,
} from "../views/nodes";
import type { RepoRef, WorkflowRun, Job, Step, Artifact, PullRequest } from "../gitea/models";

const repo: RepoRef = { host: "gitea.example", owner: "o", name: "n" };
const run: WorkflowRun = {
  id: 1,
  name: "Run",
  status: "completed",
  conclusion: "success",
};
const job: Job = { id: 10, name: "job1", status: "completed" };
const step: Step = { name: "step1", status: "completed" };
const artifact: Artifact = { id: 100, name: "out", downloadUrl: "https://gitea.example/a" };
const pull: PullRequest = { id: 2, number: 42, title: "PR", state: "open" };

describe("isRepoRef", () => {
  it("returns true for valid RepoRef", () => {
    expect(isRepoRef(repo)).toBe(true);
    expect(isRepoRef({ host: "h", owner: "o", name: "n" })).toBe(true);
  });

  it("returns false for null or non-object", () => {
    expect(isRepoRef(null)).toBe(false);
    expect(isRepoRef()).toBe(false);
    expect(isRepoRef("")).toBe(false);
    expect(isRepoRef(1)).toBe(false);
  });

  it("returns false for object missing host/owner/name", () => {
    expect(isRepoRef({})).toBe(false);
    expect(isRepoRef({ owner: "o", name: "n" })).toBe(false);
    expect(isRepoRef({ host: "h", name: "n" })).toBe(false);
    expect(isRepoRef({ host: "h", owner: "o" })).toBe(false);
  });
});

describe("extractRepo", () => {
  it("returns repo from plain object with owner and name", () => {
    expect(extractRepo({ host: "h", owner: "o", name: "n" })).toEqual({
      host: "h",
      owner: "o",
      name: "n",
    });
  });

  it("returns undefined for object with empty owner or name", () => {
    expect(extractRepo({ host: "h", owner: "", name: "n" })).toBeUndefined();
    expect(extractRepo({ host: "h", owner: "o", name: "" })).toBeUndefined();
  });

  it("returns undefined for non-object or missing keys", () => {
    expect(extractRepo(null)).toBeUndefined();
    expect(extractRepo({})).toBeUndefined();
    expect(extractRepo({ owner: "o" })).toBeUndefined();
  });

  it("returns repo from RepoNode", () => {
    const node = new RepoNode(repo);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from RunNode", () => {
    const node = new RunNode(repo, run);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from JobNode", () => {
    const node = new JobNode(repo, run, job);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from PullRequestNode", () => {
    const node = new PullRequestNode(repo, pull);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from ArtifactNode", () => {
    const node = new ArtifactNode(repo, run.id, artifact);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from SectionNode", () => {
    const node = new SectionNode("pullRequests", "PRs", repo);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from SecretsRootNode", () => {
    const node = new SecretsRootNode(repo);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from VariablesRootNode", () => {
    const node = new VariablesRootNode(repo);
    expect(extractRepo(node)).toEqual(repo);
  });

  it("returns repo from SecretNode and VariableNode", () => {
    const secretNode = new SecretNode(repo, "SEC", "secret");
    const variableNode = new VariableNode(repo, "VAR", "var", "val");
    expect(extractRepo(secretNode)).toEqual(repo);
    expect(extractRepo(variableNode)).toEqual(repo);
  });
});

describe("normalizeLogArg", () => {
  it("returns LogArg from plain object with repo, run, job", () => {
    const arg = { repo, run, job };
    expect(normalizeLogArg(arg)).toEqual({ repo, run, job });
  });

  it("returns from JobNode", () => {
    const node = new JobNode(repo, run, job);
    const result = normalizeLogArg(node);
    expect(result).toBeDefined();
    expect(result?.repo).toEqual(repo);
    expect(result?.run).toEqual(run);
    expect(result?.job).toEqual(job);
  });

  it("returns from StepNode with step", () => {
    const node = new StepNode(repo, run, job, step);
    const result = normalizeLogArg(node);
    expect(result).toBeDefined();
    expect(result?.repo).toEqual(repo);
    expect(result?.run).toEqual(run);
    expect(result?.job).toEqual(job);
    expect(result?.step).toEqual(step);
  });

  it("returns undefined for invalid input", () => {
    expect(normalizeLogArg(null)).toBeUndefined();
    expect(normalizeLogArg({})).toBeUndefined();
    expect(normalizeLogArg({ repo, run })).toBeUndefined();
  });
});

describe("normalizeRunArg", () => {
  it("returns from plain object with repo and run", () => {
    expect(normalizeRunArg({ repo, run })).toEqual({ repo, run });
  });

  it("returns from RunNode", () => {
    const node = new RunNode(repo, run);
    const result = normalizeRunArg(node);
    expect(result).toBeDefined();
    expect(result?.repo).toEqual(repo);
    expect(result?.run).toEqual(run);
  });

  it("returns undefined for invalid input", () => {
    expect(normalizeRunArg(null)).toBeUndefined();
    expect(normalizeRunArg({ repo })).toBeUndefined();
  });
});

describe("buildRepoUrl", () => {
  it("builds URL without trailing slash", () => {
    expect(buildRepoUrl("https://gitea.example", repo)).toBe("https://gitea.example/o/n");
  });

  it("trims trailing slash from baseUrl", () => {
    expect(buildRepoUrl("https://gitea.example/", repo)).toBe("https://gitea.example/o/n");
  });

  it("returns undefined for empty baseUrl", () => {
    expect(buildRepoUrl("", repo)).toBeUndefined();
  });
});

describe("buildRunUrl", () => {
  it("builds run URL", () => {
    expect(buildRunUrl("https://gitea.example", repo, run)).toBe(
      "https://gitea.example/o/n/actions/runs/1",
    );
  });

  it("returns undefined for empty baseUrl", () => {
    expect(buildRunUrl("", repo, run)).toBeUndefined();
  });
});

describe("buildJobUrl", () => {
  it("builds job URL", () => {
    expect(buildJobUrl("https://gitea.example", repo, job)).toBe(
      "https://gitea.example/o/n/actions/jobs/10",
    );
  });

  it("returns undefined for empty baseUrl", () => {
    expect(buildJobUrl("", repo, job)).toBeUndefined();
  });
});

describe("buildPullRequestUrl", () => {
  it("builds PR URL", () => {
    expect(buildPullRequestUrl("https://gitea.example", repo, pull)).toBe(
      "https://gitea.example/o/n/pulls/42",
    );
  });

  it("returns undefined for empty baseUrl", () => {
    expect(buildPullRequestUrl("", repo, pull)).toBeUndefined();
  });
});

describe("resolveOpenUrl", () => {
  const baseUrl = "https://gitea.example";

  it("returns htmlUrl or buildRepoUrl for RepoNode", () => {
    const node = new RepoNode(repo);
    expect(resolveOpenUrl(node, baseUrl)).toBe("https://gitea.example/o/n");
  });

  it("returns htmlUrl or buildRunUrl for RunNode", () => {
    const node = new RunNode(repo, run);
    expect(resolveOpenUrl(node, baseUrl)).toBe("https://gitea.example/o/n/actions/runs/1");
  });

  it("returns htmlUrl or buildJobUrl for JobNode", () => {
    const node = new JobNode(repo, run, job);
    expect(resolveOpenUrl(node, baseUrl)).toBe("https://gitea.example/o/n/actions/jobs/10");
  });

  it("returns htmlUrl or buildPullRequestUrl for PullRequestNode", () => {
    const node = new PullRequestNode(repo, pull);
    expect(resolveOpenUrl(node, baseUrl)).toBe("https://gitea.example/o/n/pulls/42");
  });

  it("returns artifact downloadUrl for ArtifactNode", () => {
    const node = new ArtifactNode(repo, run.id, artifact);
    expect(resolveOpenUrl(node, baseUrl)).toBe("https://gitea.example/a");
  });

  it("returns undefined for SectionNode", () => {
    const node = new SectionNode("pullRequests", "PRs", repo);
    expect(resolveOpenUrl(node, baseUrl)).toBeUndefined();
  });

  it("returns htmlUrl or buildJobUrl for StepNode", () => {
    const node = new StepNode(repo, run, job, step);
    expect(resolveOpenUrl(node, baseUrl)).toBe("https://gitea.example/o/n/actions/jobs/10");
  });

  it("returns undefined for unknown element", () => {
    expect(resolveOpenUrl(null, baseUrl)).toBeUndefined();
    expect(resolveOpenUrl({}, baseUrl)).toBeUndefined();
  });
});
