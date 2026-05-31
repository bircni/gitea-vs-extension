/**
 * Checkout PR branch command handler.
 * Fetches and checks out the head branch of a pull request from the tree view.
 */
import type { PullRequest, RepoRef } from "../gitea/models";
import { PullRequestNode } from "../views/nodes";

export type CheckoutCommandsDeps = {
  getWorkspaceFolderPath: (repo: RepoRef) => string | undefined;
  execGit: (args: string[], cwd: string) => Promise<string>;
  showInformationMessage: (msg: string) => void;
  showWarningMessage: (msg: string) => void;
  showErrorMessage: (msg: string) => void;
};

type PrCheckoutArg = { repo: RepoRef; pullRequest: PullRequest };

function isRepoRefLike(obj: unknown): obj is RepoRef {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "owner" in obj &&
    typeof (obj as { owner?: unknown }).owner === "string" &&
    "name" in obj &&
    typeof (obj as { name?: unknown }).name === "string"
  );
}

function isPullRequestLike(obj: unknown): obj is PullRequest {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "number" in obj &&
    typeof (obj as { number?: unknown }).number === "number" &&
    "headRef" in obj &&
    typeof (obj as { headRef?: unknown }).headRef === "string"
  );
}

function normalizePrArg(arg: unknown): PrCheckoutArg | undefined {
  if (arg instanceof PullRequestNode) {
    return { repo: arg.repo, pullRequest: arg.pullRequest };
  }
  if (arg && typeof arg === "object" && "repo" in arg && "pullRequest" in arg) {
    const repo = (arg as { repo?: unknown }).repo;
    const pullRequest = (arg as { pullRequest?: unknown }).pullRequest;
    if (isRepoRefLike(repo) && isPullRequestLike(pullRequest)) {
      return { repo, pullRequest };
    }
  }
  return undefined;
}

export async function checkoutPrBranch(deps: CheckoutCommandsDeps, arg: unknown): Promise<void> {
  const prArg = normalizePrArg(arg);
  if (!prArg) {
    deps.showWarningMessage("No pull request selected.");
    return;
  }

  const { repo, pullRequest } = prArg;

  const headRef = pullRequest.headRef;
  if (!headRef) {
    deps.showWarningMessage("Pull request head branch is not available.");
    return;
  }
  // Validate headRef: must be a safe git ref (no leading dash, no spaces, no dangerous chars)
  if (!/^([A-Za-z0-9._\-/]+)$/.test(headRef) || headRef.startsWith("-")) {
    deps.showWarningMessage(`PR head branch name is invalid or unsafe for git: ${headRef}`);
    return;
  }

  const cwd = deps.getWorkspaceFolderPath(repo);
  if (!cwd) {
    deps.showWarningMessage("Open the repository in your workspace to checkout the PR branch.");
    return;
  }

  try {
    // Determine the remote that tracks this repo (default to "origin")
    const remote = await resolveRemote(deps, cwd);

    // Fetch the head branch from the remote
    await deps.execGit(["fetch", remote, headRef], cwd);

    // Check if a local branch with the same name already exists
    const localBranchExists = await branchExists(deps, cwd, headRef);

    if (localBranchExists) {
      // Switch to existing branch and update it
      await deps.execGit(["checkout", headRef], cwd);
      try {
        await deps.execGit(["merge", "--ff-only", `${remote}/${headRef}`], cwd);
      } catch (_mergeErr) {
        deps.showWarningMessage(
          `Fast-forward merge from ${remote}/${headRef} failed. Your branch may be behind the PR head.`,
        );
      }
    } else {
      // Create and checkout a new local branch tracking the remote
      await deps.execGit(["checkout", "-b", headRef, "--track", `${remote}/${headRef}`], cwd);
    }

    deps.showInformationMessage(`Checked out branch '${headRef}' for PR #${pullRequest.number}.`);
  } catch (error) {
    let message: string;
    if (error instanceof Error) {
      message = error.message;
    } else {
      // For non-Error throws, show a generic message to match test expectation
      message = "Failed to checkout PR branch.";
    }
    // Sanitize error to avoid leaking tokens/URLs
    const sanitized = sanitizeGitError(message);
    deps.showErrorMessage(`Checkout failed: ${sanitized}`);
  }
}

async function resolveRemote(deps: CheckoutCommandsDeps, cwd: string): Promise<string> {
  try {
    const output = await deps.execGit(["remote"], cwd);
    const remotes = output
      .trim()
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    // Prefer "origin" if it exists, otherwise use the first remote
    if (remotes.includes("origin")) {
      return "origin";
    }
    return remotes[0] || "origin";
  } catch {
    return "origin";
  }
}

async function branchExists(
  deps: CheckoutCommandsDeps,
  cwd: string,
  branchName: string,
): Promise<boolean> {
  try {
    const output = await deps.execGit(["branch", "--list", branchName], cwd);
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

function sanitizeGitError(message: string): string {
  // Remove potential tokens from URLs (e.g. https://token@host/...)
  // Preserve the original scheme (http or https)
  return message.replace(/(https?):\/\/[^@]*@/g, "$1://***@");
}
