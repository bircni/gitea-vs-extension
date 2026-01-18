import type { RepoRef } from "../gitea/models";

export function repoKey(repo: RepoRef): string {
  return `${repo.host}/${repo.owner}/${repo.name}`;
}

export function expandedRepoKey(repo: RepoRef): string {
  return `repo:${repoKey(repo)}`;
}

export function expandedRunKey(repo: RepoRef, runId: number | string): string {
  return `run:${repoKey(repo)}/${runId}`;
}

export function expandedWorkflowKey(name: string): string {
  return `workflow:${name}`;
}
