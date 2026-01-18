import * as vscode from "vscode";
import { execGit } from "../util/git";
import type { RepoRef } from "./models";
import { hostMatches, parseRemoteUrl } from "./remotes";
import type { GiteaApi } from "./api";
import type { DiscoveryMode } from "../config/settings";

export class RepoDiscovery {
  constructor(private readonly api: GiteaApi) {}

  async discoverRepos(mode: DiscoveryMode, baseUrl: string): Promise<RepoRef[]> {
    const host = getHost(baseUrl);
    if (!host) {
      return [];
    }

    if (mode === "allAccessible") {
      return this.getAllAccessibleRepos(host);
    }

    return this.getWorkspaceRepos(host, baseUrl);
  }

  private async getAllAccessibleRepos(host: string): Promise<RepoRef[]> {
    const repos = await this.api.listAccessibleRepos();
    return repos.filter((repo) => hostMatches(host, repo.host));
  }

  private async getWorkspaceRepos(host: string, baseUrl: string): Promise<RepoRef[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const repos: RepoRef[] = [];

    for (const folder of workspaceFolders) {
      const repo = await resolveRepoFromFolder(folder.uri.fsPath, host, baseUrl);
      if (repo) {
        repos.push(repo);
      }
    }

    return uniqRepos(repos);
  }
}

async function resolveRepoFromFolder(
  folderPath: string,
  host: string,
  baseUrl: string,
): Promise<RepoRef | undefined> {
  try {
    const isRepo = await execGit(["rev-parse", "--is-inside-work-tree"], folderPath);
    if (!isRepo.trim().startsWith("true")) {
      return undefined;
    }

    const remotes = await execGit(["remote", "-v"], folderPath);
    const remoteUrls = remotes
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[1])
      .filter(Boolean);

    for (const remoteUrl of remoteUrls) {
      const parsed = parseRemoteUrl(remoteUrl);
      if (!parsed) {
        continue;
      }
      if (!hostMatches(host, parsed.host)) {
        continue;
      }
      return {
        host: getHost(baseUrl) ?? host,
        owner: parsed.owner,
        name: parsed.repo,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function getHost(baseUrl: string): string | undefined {
  try {
    return new URL(baseUrl).host;
  } catch {
    return undefined;
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
