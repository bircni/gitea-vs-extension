import * as vscode from "vscode";
import type { RepoRef } from "./models";
import { hostMatches } from "./remotes";
import type { GiteaApiRouter } from "./apiRouter";
import type { DiscoveryMode } from "../config/settings";
import { resolveRepoFromFolder } from "../util/repoResolution";

export class RepoDiscovery {
  constructor(private readonly api: GiteaApiRouter) {}

  async discoverRepos(
    mode: DiscoveryMode,
    baseUrls: string | readonly string[],
  ): Promise<RepoRef[]> {
    const urls = typeof baseUrls === "string" ? [baseUrls] : baseUrls;
    if (urls.length === 0) {
      return [];
    }

    if (mode === "allAccessible") {
      return this.getAllAccessibleRepos(urls);
    }

    return this.getWorkspaceRepos(baseUrls);
  }

  private async getAllAccessibleRepos(baseUrls: readonly string[]): Promise<RepoRef[]> {
    const hosts = baseUrls.flatMap((url) => {
      try {
        return [new URL(url).host];
      } catch {
        return [];
      }
    });
    const repos = await this.api.listAccessibleRepos();
    return repos.filter((repo) => hosts.some((host) => hostMatches(host, repo.host)));
  }

  private async getWorkspaceRepos(baseUrls: string | readonly string[]): Promise<RepoRef[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const repos: RepoRef[] = [];

    for (const folder of workspaceFolders) {
      const repo = await resolveRepoFromFolder(folder.uri.fsPath, baseUrls);
      if (repo) {
        repos.push(repo);
      }
    }

    return uniqRepos(repos);
  }
}

function uniqRepos(repos: RepoRef[]): RepoRef[] {
  const seen = new Set<string>();
  const result: RepoRef[] = [];

  for (const repo of repos) {
    const key = `${repo.host}/${repo.owner}/${repo.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(repo);
  }

  return result;
}
