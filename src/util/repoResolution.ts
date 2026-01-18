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
  baseUrl: string,
): Promise<RepoRef | undefined> {
  const host = getHost(baseUrl);
  if (!host) {
    return undefined;
  }

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

export async function resolveWorkspaceRepos(baseUrl: string): Promise<WorkspaceRepo[]> {
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

function getHost(baseUrl: string): string | undefined {
  try {
    return new URL(baseUrl).host;
  } catch {
    return undefined;
  }
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
