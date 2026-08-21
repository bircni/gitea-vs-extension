import * as vscode from "vscode";
import type { RepoRef } from "../gitea/models";
import { hostMatches, parseRemoteUrl } from "../gitea/remotes";
import { execGit } from "./git";

export type WorkspaceRepo = {
  repo: RepoRef;
  folder: vscode.WorkspaceFolder;
};

export async function resolveRepoFromFolder(
  folderPath: string,
  baseUrl: string | readonly string[],
): Promise<RepoRef | undefined> {
  const hosts = getHosts(baseUrl);
  if (hosts.length === 0) {
    return undefined;
  }

  try {
    const isRepo = await execGit(["rev-parse", "--is-inside-work-tree"], folderPath);
    if (!isRepo.trimStart().startsWith("true")) {
      return undefined;
    }

    const remotes = await execGit(["remote", "-v"], folderPath);
    const remoteUrls = remotes
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, url, direction] = line.split(/\s+/);
        return { name, url, direction };
      })
      .filter((remote): remote is { name: string; url: string; direction: string } =>
        Boolean(remote.name && remote.url && remote.direction),
      )
      .filter((remote) => remote.direction === "(fetch)")
      .toSorted((a, b) => Number(b.name === "origin") - Number(a.name === "origin"))
      .map((remote) => remote.url);

    for (const remoteUrl of remoteUrls) {
      const parsed = parseRemoteUrl(remoteUrl);
      if (!parsed) {
        continue;
      }
      const host = hosts.find((candidate) => hostMatches(candidate, parsed.host));
      if (!host) {
        continue;
      }
      return {
        host,
        owner: parsed.owner,
        name: parsed.repo,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function resolveWorkspaceRepos(
  baseUrl: string | readonly string[],
): Promise<WorkspaceRepo[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const repos: WorkspaceRepo[] = [];

  for (const folder of workspaceFolders) {
    const repo = await resolveRepoFromFolder(folder.uri.fsPath, baseUrl);
    if (repo) {
      repos.push({ repo, folder });
    }
  }

  return uniqWorkspaceRepos(repos);
}

function getHosts(baseUrl: string | readonly string[]): string[] {
  const urls = typeof baseUrl === "string" ? [baseUrl] : baseUrl;
  return urls.flatMap((url) => {
    try {
      return [new URL(url).host];
    } catch {
      return [];
    }
  });
}

function uniqWorkspaceRepos(repos: WorkspaceRepo[]): WorkspaceRepo[] {
  const seen = new Set<string>();
  const result: WorkspaceRepo[] = [];

  for (const entry of repos) {
    const key = `${entry.repo.host}/${entry.repo.owner}/${entry.repo.name}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }

  return result;
}
