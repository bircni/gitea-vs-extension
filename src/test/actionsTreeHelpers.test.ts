import {
  buildWorkflowGroupDescriptors,
  getBranchFilterDescription,
  getFilteredRunsForDisplay,
  getRepoChildRunsState,
  getRootMessage,
  type ProviderMode,
} from "../views/actionsTreeHelpers";
import type { BranchContext, BranchFilterState } from "../util/branchContext";
import type { RepoCacheEntry } from "../util/cache";
import type { PullRequest, RepoRef, WorkflowRun } from "../gitea/models";

function repo(owner: string, name: string): RepoRef {
  return { host: "gitea.example", owner, name };
}

function run(
  id: number,
  branch: string,
  status: WorkflowRun["status"] = "completed",
  updatedAt?: string,
): WorkflowRun {
  return {
    id,
    name: "wf",
    branch,
    status,
    updatedAt: updatedAt ?? "2025-01-01T00:00:00Z",
  };
}

function entry(
  repoRef: RepoRef,
  runs: WorkflowRun[],
  opts: { loading?: boolean; error?: string; errors?: string[]; pullRequests?: PullRequest[] } = {},
): RepoCacheEntry {
  const jobsByRun = new Map<string, unknown[]>();
  const jobsStateByRun = new Map<string, "unloaded" | "loading" | "idle" | "error">();
  const jobsErrorByRun = new Map<string, string | undefined>();
  const artifactsByRun = new Map<string, unknown[]>();
  const artifactsStateByRun = new Map<string, "unloaded" | "loading" | "idle" | "error">();
  const artifactsErrorByRun = new Map<string, string | undefined>();
  for (const r of runs) {
    const k = String(r.id);
    jobsByRun.set(k, []);
    jobsStateByRun.set(k, "unloaded");
    jobsErrorByRun.set(k, undefined);
    artifactsByRun.set(k, []);
    artifactsStateByRun.set(k, "unloaded");
    artifactsErrorByRun.set(k, undefined);
  }
  return {
    repo: repoRef,
    runs,
    jobsByRun,
    jobsStateByRun,
    jobsErrorByRun,
    artifactsByRun,
    artifactsStateByRun,
    artifactsErrorByRun,
    pullRequests: opts.pullRequests ?? [],
    errors: opts.errors ?? [],
    loading: opts.loading ?? false,
    error: opts.error,
  };
}

describe("getRootMessage", () => {
  it("returns configureBaseUrl when no baseUrl", () => {
    const msg = getRootMessage(false, true, false, 1, "runs");
    expect(msg).toEqual({
      label: "Set gitea-vs-extension.baseUrl to get started.",
      command: "configureBaseUrl",
    });
  });

  it("returns setToken when no token", () => {
    const msg = getRootMessage(true, false, false, 1, "runs");
    expect(msg).toEqual({ label: "Set a token to access Gitea.", command: "setToken" });
  });

  it("returns loading when repos loading", () => {
    const msg = getRootMessage(true, true, true, 0, "runs");
    expect(msg).toEqual({ label: "Discovering repositories..." });
  });

  it("returns no repos when reposCount 0", () => {
    const msg = getRootMessage(true, true, false, 0, "runs");
    expect(msg).toEqual({ label: "No repositories found." });
  });

  it("returns no runs yet for workflows when groupCount 0", () => {
    const msg = getRootMessage(true, true, false, 2, "workflows", 0);
    expect(msg).toEqual({ label: "No runs yet." });
  });

  it("returns null when showing repos (runs mode)", () => {
    const msg = getRootMessage(true, true, false, 2, "runs");
    expect(msg).toBeNull();
  });

  it("returns null when showing workflow groups", () => {
    const msg = getRootMessage(true, true, false, 2, "workflows", 3);
    expect(msg).toBeNull();
  });
});

describe("buildWorkflowGroupDescriptors", () => {
  it("returns empty array when no entries", () => {
    expect(buildWorkflowGroupDescriptors([])).toEqual([]);
  });

  it("groups runs by branch", () => {
    const r = repo("o", "n");
    const e = entry(r, [run(1, "main"), run(2, "main"), run(3, "feat")]);
    const groups = buildWorkflowGroupDescriptors([e]);
    expect(groups).toHaveLength(2);
    const mainGroup = groups.find((g) => g.name === "main");
    const featGroup = groups.find((g) => g.name === "feat");
    expect(mainGroup?.runs).toHaveLength(2);
    expect(featGroup?.runs).toHaveLength(1);
  });

  it("sorts active branches first", () => {
    const r = repo("o", "n");
    const e = entry(r, [
      run(1, "main", "completed", "2025-01-02T00:00:00Z"),
      run(2, "feat", "running"),
    ]);
    const groups = buildWorkflowGroupDescriptors([e]);
    expect(groups[0].name).toBe("feat");
    expect(groups[1].name).toBe("main");
  });

  it("sorts by most recent when none active", () => {
    const r = repo("o", "n");
    const e = entry(r, [
      run(1, "main", "completed", "2025-01-01T00:00:00Z"),
      run(2, "feat", "completed", "2025-01-03T00:00:00Z"),
    ]);
    const groups = buildWorkflowGroupDescriptors([e]);
    expect(groups[0].name).toBe("feat");
    expect(groups[1].name).toBe("main");
  });

  it("skips entries with error", () => {
    const r = repo("o", "n");
    const e = entry(r, [run(1, "main")], { error: "fail" });
    expect(buildWorkflowGroupDescriptors([e])).toEqual([]);
  });
});

describe("getFilteredRunsForDisplay", () => {
  const r = repo("o", "n");
  const ctx: BranchContext = {
    repo: r,
    branchName: "main",
    status: "resolved",
  };
  const filterAll: BranchFilterState = { repo: r, mode: "allBranches" };
  const filterCurrent: BranchFilterState = { repo: r, mode: "currentBranch" };

  it("returns all runs when no context or filter", () => {
    const e = entry(r, [run(1, "main"), run(2, "feat")]);
    expect(getFilteredRunsForDisplay(e, undefined, undefined)).toHaveLength(2);
  });

  it("returns all runs for allBranches", () => {
    const e = entry(r, [run(1, "main"), run(2, "feat")]);
    expect(getFilteredRunsForDisplay(e, ctx, filterAll)).toHaveLength(2);
  });

  it("filters by current branch when resolved", () => {
    const e = entry(r, [run(1, "main"), run(2, "feat")]);
    const out = getFilteredRunsForDisplay(e, ctx, filterCurrent);
    expect(out).toHaveLength(1);
    expect(out[0].branch).toBe("main");
  });

  it("includes PR runs when head matches current branch", () => {
    const e = entry(r, [run(1, "main"), run(2, "PR #42")], {
      pullRequests: [{ id: 1, number: 42, title: "x", state: "open", headRef: "main" }],
    });
    const out = getFilteredRunsForDisplay(e, ctx, filterCurrent);
    expect(out.map((x) => x.id)).toEqual([1, 2]);
  });
});

describe("getRepoChildRunsState", () => {
  const r = repo("o", "n");
  const ctx: BranchContext = {
    repo: r,
    branchName: "main",
    status: "resolved",
  };
  const filter: BranchFilterState = { repo: r, mode: "currentBranch" };

  it("returns noEntry when entry undefined", () => {
    const state = getRepoChildRunsState(undefined, ctx, filter);
    expect(state.noEntry).toBe(true);
    expect(state.filteredRuns).toEqual([]);
  });

  it("returns loading when entry.loading", () => {
    const e = entry(r, [], { loading: true });
    const state = getRepoChildRunsState(e, ctx, filter);
    expect(state.loading).toBe(true);
    expect(state.filteredRuns).toEqual([]);
  });

  it("returns error when entry.error", () => {
    const e = entry(r, [], { error: "Network error" });
    const state = getRepoChildRunsState(e, ctx, filter);
    expect(state.error).toBe("Network error");
    expect(state.filteredRuns).toEqual([]);
  });

  it("returns filtered runs and hasErrorsSection", () => {
    const e = entry(r, [run(1, "main")], { errors: ["err1"] });
    const state = getRepoChildRunsState(e, ctx, filter);
    expect(state.filteredRuns).toHaveLength(1);
    expect(state.hasErrorsSection).toBe(true);
  });

  it("returns infoBanner when context unresolved and currentBranch filter", () => {
    const unresolvedCtx: BranchContext = {
      repo: r,
      branchName: null,
      status: "unresolved",
      reason: "Not a git repo",
    };
    const e = entry(r, [run(1, "feat")]);
    const state = getRepoChildRunsState(e, unresolvedCtx, filter);
    expect(state.infoBanner?.command).toBe("switchBranchFilter");
    expect(state.infoBanner?.label).toContain("Not a git repo");
  });

  it("returns emptyMessage when no runs for current branch", () => {
    const e = entry(r, [run(1, "feat")]);
    const state = getRepoChildRunsState(e, ctx, filter);
    expect(state.filteredRuns).toHaveLength(0);
    expect(state.emptyMessage?.command).toBe("switchBranchFilter");
    expect(state.emptyMessage?.label).toContain("No workflow runs for this branch");
  });

  it("returns emptyMessage when no runs at all", () => {
    const e = entry(r, []);
    const state = getRepoChildRunsState(e, ctx, filter);
    expect(state.emptyMessage?.label).toContain("Switch to another branch");
  });
});

describe("getBranchFilterDescription", () => {
  const r = repo("o", "n");
  const ctx: BranchContext = {
    repo: r,
    branchName: "main",
    status: "resolved",
  };

  it("returns undefined for pullRequests mode", () => {
    expect(
      getBranchFilterDescription("pullRequests", ctx, { repo: r, mode: "allBranches" }),
    ).toBeUndefined();
  });

  it("returns all branches for allBranches", () => {
    expect(getBranchFilterDescription("runs", ctx, { repo: r, mode: "allBranches" })).toBe(
      "all branches",
    );
  });

  it("returns branch name for specificBranch", () => {
    expect(
      getBranchFilterDescription("runs", ctx, {
        repo: r,
        mode: "specificBranch",
        branchName: "feat",
      }),
    ).toBe("branch: feat");
  });

  it("returns current branch when resolved", () => {
    expect(getBranchFilterDescription("runs", ctx, { repo: r, mode: "currentBranch" })).toBe(
      "current: main",
    );
  });

  it("returns undefined when no context or filter", () => {
    expect(getBranchFilterDescription("runs", undefined, undefined)).toBeUndefined();
  });
});
