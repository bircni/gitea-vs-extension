import { execFile } from "child_process";
import { promisify } from "util";
import type { BranchContextStatus } from "./branchContext";

const execFileAsync = promisify(execFile);

export async function execGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout;
}

export type CurrentBranchResult = {
  branchName: string | null;
  status: BranchContextStatus;
  reason?: string;
};

/**
 * Resolves the current branch name for a given workspace folder path.
 * Returns structured status for use in BranchContext (data-model.md).
 */
export async function getCurrentBranchInFolder(folderPath: string): Promise<CurrentBranchResult> {
  try {
    const isRepo = await execGit(["rev-parse", "--is-inside-work-tree"], folderPath);
    if (!isRepo.trim().startsWith("true")) {
      return { branchName: null, status: "noRepo", reason: "Not a git repository" };
    }
  } catch {
    return { branchName: null, status: "noRepo", reason: "Not a git repository" };
  }

  try {
    const ref = await execGit(["symbolic-ref", "-q", "HEAD"], folderPath);
    const trimmed = ref.trim();
    if (trimmed.startsWith("refs/heads/")) {
      const branchName = trimmed.slice("refs/heads/".length);
      return { branchName: branchName || null, status: "resolved" };
    }
    return { branchName: null, status: "unresolved", reason: "Could not resolve branch name" };
  } catch {
    try {
      await execGit(["rev-parse", "HEAD"], folderPath);
      return { branchName: null, status: "detached", reason: "Detached HEAD" };
    } catch {
      return { branchName: null, status: "unresolved", reason: "Could not resolve HEAD" };
    }
  }
}
