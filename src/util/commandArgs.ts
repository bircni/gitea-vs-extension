/**
 * Shared argument normalization and URL resolution for command handlers.
 * Used by controllers/commands and extracted command units.
 */
import type { Job, PullRequest, RepoRef, WorkflowRun } from "../gitea/models";
import {
  ArtifactNode,
  PullRequestNode,
  RepoNode,
  RunNode,
  JobNode,
  SectionNode,
  SecretNode,
  SecretsRootNode,
  StepNode,
  VariablesRootNode,
  VariableNode,
} from "../views/nodes";

export function isRepoRef(obj: unknown): obj is RepoRef {
  return (
    typeof obj === "object" && obj !== null && "host" in obj && "owner" in obj && "name" in obj
  );
}

export function extractRepo(arg: unknown): RepoRef | undefined {
  if (arg && typeof arg === "object" && "owner" in arg && "name" in arg) {
    const repo = arg as RepoRef;
    if (repo.owner && repo.name) {
      return repo;
    }
  }
  if (arg instanceof RepoNode) {
    return arg.repo;
  }
  if (arg instanceof RunNode) {
    return arg.repo;
  }
  if (arg instanceof JobNode) {
    return arg.repo;
  }
  if (arg instanceof PullRequestNode) {
    return arg.repo;
  }
  if (arg instanceof ArtifactNode) {
    return arg.repo;
  }
  if (arg instanceof SectionNode) {
    return arg.repo;
  }
  if (arg instanceof SecretNode) {
    return arg.repo;
  }
  if (arg instanceof SecretsRootNode) {
    return arg.repo;
  }
  if (arg instanceof VariablesRootNode) {
    return arg.repo;
  }
  if (arg instanceof VariableNode) {
    return arg.repo;
  }
  return undefined;
}

export type LogArg = { repo: RepoRef; run: WorkflowRun; job: Job; step?: unknown };

export function normalizeLogArg(arg: unknown): LogArg | undefined {
  if (arg && typeof arg === "object" && "repo" in arg && "job" in arg && "run" in arg) {
    return arg as LogArg;
  }
  if (arg instanceof JobNode) {
    return { repo: arg.repo, run: arg.run, job: arg.job };
  }
  if (arg instanceof StepNode) {
    return { repo: arg.repo, run: arg.run, job: arg.job, step: arg.step };
  }
  return undefined;
}

export function normalizeRunArg(arg: unknown): { repo: RepoRef; run: WorkflowRun } | undefined {
  if (arg && typeof arg === "object" && "repo" in arg && "run" in arg) {
    return arg as { repo: RepoRef; run: WorkflowRun };
  }
  if (arg instanceof RunNode) {
    return { repo: arg.repo, run: arg.run };
  }
  return undefined;
}

function trimBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function buildRepoUrl(baseUrl: string, repo: RepoRef): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}`;
}

export function buildRunUrl(baseUrl: string, repo: RepoRef, run: WorkflowRun): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}/actions/runs/${run.id}`;
}

export function buildJobUrl(baseUrl: string, repo: RepoRef, job: Job): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}/actions/jobs/${job.id}`;
}

export function buildPullRequestUrl(
  baseUrl: string,
  repo: RepoRef,
  pull: PullRequest,
): string | undefined {
  if (!baseUrl) {
    return undefined;
  }
  return `${trimBase(baseUrl)}/${repo.owner}/${repo.name}/pulls/${pull.number}`;
}

export function resolveOpenUrl(arg: unknown, baseUrl: string): string | undefined {
  if (arg instanceof RepoNode) {
    return arg.repo.htmlUrl ?? buildRepoUrl(baseUrl, arg.repo);
  }
  if (arg instanceof RunNode) {
    return arg.run.htmlUrl ?? buildRunUrl(baseUrl, arg.repo, arg.run);
  }
  if (arg instanceof JobNode) {
    return arg.job.htmlUrl ?? buildJobUrl(baseUrl, arg.repo, arg.job);
  }
  if (arg instanceof PullRequestNode) {
    return arg.pullRequest.htmlUrl ?? buildPullRequestUrl(baseUrl, arg.repo, arg.pullRequest);
  }
  if (arg instanceof ArtifactNode) {
    return arg.artifact.downloadUrl;
  }
  if (arg instanceof SectionNode) {
    return undefined;
  }
  if (arg instanceof StepNode) {
    return arg.job.htmlUrl ?? buildJobUrl(baseUrl, arg.repo, arg.job);
  }
  return undefined;
}
