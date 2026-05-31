/**
 * Unit tests for checkout PR branch command handler.
 */
import { checkoutPrBranch, type CheckoutCommandsDeps } from "../controllers/checkoutCommands";
import { PullRequestNode } from "../views/nodes";
import type { PullRequest, RepoRef } from "../gitea/models";

function makeDeps(overrides?: Partial<CheckoutCommandsDeps>): CheckoutCommandsDeps {
  return {
    getWorkspaceFolderPath: vi.fn().mockReturnValue("/workspace/repo"),
    execGit: vi.fn().mockResolvedValue(""),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    ...overrides,
  };
}

const repo: RepoRef = { host: "gitea.example.com", owner: "owner", name: "repo" };
const pr: PullRequest = {
  id: 1,
  number: 42,
  title: "Test PR",
  state: "open",
  author: "alice",
  headRef: "feature/cool",
  headSha: "abc123",
  baseRef: "main",
};

describe("checkoutPrBranch", () => {
  it("shows warning when arg is undefined", async () => {
    const deps = makeDeps();
    await checkoutPrBranch(deps, undefined);
    expect(deps.showWarningMessage).toHaveBeenCalledWith("No pull request selected.");
  });

  it("shows warning when headRef is not available", async () => {
    const deps = makeDeps();
    const prNoHead: PullRequest = { ...pr, headRef: undefined };
    const node = new PullRequestNode(repo, prNoHead);
    await checkoutPrBranch(deps, node);
    expect(deps.showWarningMessage).toHaveBeenCalledWith(
      "Pull request head branch is not available.",
    );
  });

  it("shows warning when workspace folder is not found", async () => {
    const deps = makeDeps({ getWorkspaceFolderPath: vi.fn().mockReturnValue(undefined) });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);
    expect(deps.showWarningMessage).toHaveBeenCalledWith(
      "Open the repository in your workspace to checkout the PR branch.",
    );
  });

  it("fetches and creates new branch when it does not exist locally", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("origin\n");
      }
      if (args[0] === "branch" && args[1] === "--list") {
        return Promise.resolve("");
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    expect(execGit).toHaveBeenCalledWith(["fetch", "origin", "feature/cool"], "/workspace/repo");
    expect(execGit).toHaveBeenCalledWith(
      ["checkout", "-b", "feature/cool", "--track", "origin/feature/cool"],
      "/workspace/repo",
    );
    expect(deps.showInformationMessage).toHaveBeenCalledWith(
      "Checked out branch 'feature/cool' for PR #42.",
    );
  });

  it("checks out existing branch and attempts fast-forward merge", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("origin\n");
      }
      if (args[0] === "branch" && args[1] === "--list") {
        return Promise.resolve("  feature/cool\n");
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    expect(execGit).toHaveBeenCalledWith(["fetch", "origin", "feature/cool"], "/workspace/repo");
    expect(execGit).toHaveBeenCalledWith(["checkout", "feature/cool"], "/workspace/repo");
    expect(execGit).toHaveBeenCalledWith(
      ["merge", "--ff-only", "origin/feature/cool"],
      "/workspace/repo",
    );
    expect(deps.showInformationMessage).toHaveBeenCalledWith(
      "Checked out branch 'feature/cool' for PR #42.",
    );
  });

  it("shows error with sanitized message on git failure", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("origin\n");
      }
      if (args[0] === "fetch") {
        return Promise.reject(
          new Error("fatal: could not read from https://mytoken@gitea.example.com/o/r.git"),
        );
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    expect(deps.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining("https://***@"));
    expect(deps.showErrorMessage).toHaveBeenCalledWith(expect.not.stringContaining("mytoken"));
  });

  it("uses first available remote when origin is not present", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("upstream\ngitea\n");
      }
      if (args[0] === "branch" && args[1] === "--list") {
        return Promise.resolve("");
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    expect(execGit).toHaveBeenCalledWith(["fetch", "upstream", "feature/cool"], "/workspace/repo");
  });

  it("accepts plain object arg with repo and pullRequest", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("origin\n");
      }
      if (args[0] === "branch" && args[1] === "--list") {
        return Promise.resolve("");
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    await checkoutPrBranch(deps, { repo, pullRequest: pr });

    expect(deps.showInformationMessage).toHaveBeenCalledWith(
      "Checked out branch 'feature/cool' for PR #42.",
    );
  });

  it("still succeeds when fast-forward merge fails on existing branch", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("origin\n");
      }
      if (args[0] === "branch" && args[1] === "--list") {
        return Promise.resolve("  feature/cool\n");
      }
      if (args[0] === "merge") {
        return Promise.reject(new Error("Not possible to fast-forward"));
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    expect(deps.showInformationMessage).toHaveBeenCalledWith(
      "Checked out branch 'feature/cool' for PR #42.",
    );
    expect(deps.showErrorMessage).not.toHaveBeenCalled();
  });

  it("falls back to origin when git remote command fails", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.reject(new Error("git not found"));
      }
      if (args[0] === "branch" && args[1] === "--list") {
        return Promise.resolve("");
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    expect(execGit).toHaveBeenCalledWith(["fetch", "origin", "feature/cool"], "/workspace/repo");
  });

  it("handles non-Error throw in catch path", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("origin\n");
      }
      if (args[0] === "fetch") {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject("string error");
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    expect(deps.showErrorMessage).toHaveBeenCalledWith(
      "Checkout failed: Failed to checkout PR branch.",
    );
  });

  it("treats branch as not existing when git branch --list fails", async () => {
    const execGit = vi.fn().mockImplementation((args: string[]) => {
      if (args[0] === "remote") {
        return Promise.resolve("origin\n");
      }
      if (args[0] === "branch" && args[1] === "--list") {
        return Promise.reject(new Error("branch list failed"));
      }
      return Promise.resolve("");
    });
    const deps = makeDeps({ execGit });
    const node = new PullRequestNode(repo, pr);
    await checkoutPrBranch(deps, node);

    // Should attempt to create a new branch (branch not found = create new)
    expect(execGit).toHaveBeenCalledWith(
      ["checkout", "-b", "feature/cool", "--track", "origin/feature/cool"],
      "/workspace/repo",
    );
  });
});
