/**
 * Unit tests for refresh helpers: branch context, summary, error formatting, run-detail maps.
 */
import { EndpointError } from "../gitea/api";
import { HttpError } from "../gitea/client";
import type { RepoRef, WorkflowRun } from "../gitea/models";
import type { RepoCacheEntry } from "../util/cache";
import {
  buildBranchContext,
  buildRunDetailMapsForRuns,
  computeRefreshSummary,
  formatRefreshError,
  getInitialBranchFilterMode,
  mergeRunsById,
  nextEntryErrorState,
  nextEntryLoadingState,
  nextEntrySuccessState,
  resolveBranchFetch,
} from "../util/refreshHelpers";
import type { BranchContext, BranchFilterState } from "../util/branchContext";

const mockRepo: RepoRef = { host: "gitea.example.com", owner: "o", name: "n" };

function makeEntry(runs: WorkflowRun[] = []): RepoCacheEntry {
  return {
    repo: mockRepo,
    runs,
    jobsByRun: new Map(),
    jobsStateByRun: new Map(),
    jobsErrorByRun: new Map(),
    artifactsByRun: new Map(),
    artifactsStateByRun: new Map(),
    artifactsErrorByRun: new Map(),
    pullRequests: [],
    errors: [],
    loading: false,
  };
}

describe("buildBranchContext", () => {
  it("returns noRepo when folderPath is undefined", () => {
    const ctx = buildBranchContext(mockRepo, undefined, null);
    expect(ctx.status).toBe("noRepo");
    expect(ctx.branchName).toBeNull();
    expect(ctx.reason).toContain("No workspace folder");
  });

  it("returns noRepo when folderPath is set but branchResult is null", () => {
    const ctx = buildBranchContext(mockRepo, "/path", null);
    expect(ctx.status).toBe("noRepo");
    expect(ctx.reason).toBe("Branch not resolved");
  });

  it("returns resolved context when folderPath and branchResult are set", () => {
    const ctx = buildBranchContext(mockRepo, "/path", {
      branchName: "main",
      status: "resolved",
    });
    expect(ctx.status).toBe("resolved");
    expect(ctx.branchName).toBe("main");
    expect(ctx.repo).toBe(mockRepo);
  });

  it("returns unresolved context when status is unresolved", () => {
    const ctx = buildBranchContext(mockRepo, "/path", {
      branchName: null,
      status: "unresolved",
      reason: "Not a git repo",
    });
    expect(ctx.status).toBe("unresolved");
    expect(ctx.reason).toBe("Not a git repo");
  });
});

describe("getInitialBranchFilterMode", () => {
  it("returns currentBranch when context status is resolved", () => {
    expect(
      getInitialBranchFilterMode({
        repo: mockRepo,
        branchName: "main",
        status: "resolved",
      }),
    ).toBe("currentBranch");
  });

  it("returns allBranches when context status is not resolved", () => {
    expect(
      getInitialBranchFilterMode({
        repo: mockRepo,
        branchName: null,
        status: "noRepo",
      }),
    ).toBe("allBranches");
  });
});

describe("computeRefreshSummary", () => {
  it("returns zeros for empty entries", () => {
    expect(computeRefreshSummary([])).toEqual({
      runningCount: 0,
      failedCount: 0,
    });
  });

  it("counts running and failed across entries", () => {
    const entries = [
      { runs: [{ id: 1, name: "r1", status: "running" } as WorkflowRun] },
      {
        runs: [
          { id: 2, name: "r2", status: "completed", conclusion: "failure" } as WorkflowRun,
          { id: 3, name: "r3", status: "queued" } as WorkflowRun,
        ],
      },
    ];
    expect(computeRefreshSummary(entries)).toEqual({
      runningCount: 2,
      failedCount: 1,
    });
  });
});

describe("formatRefreshError", () => {
  it("formats EndpointError as message", () => {
    expect(formatRefreshError(new EndpointError("Runs endpoint not available"))).toBe(
      "Runs endpoint not available",
    );
  });

  it("formats HttpError 401 as Unauthorized", () => {
    expect(formatRefreshError(new HttpError(401, "u", "body"))).toBe(
      "Unauthorized. Set a valid token.",
    );
  });

  it("formats HttpError 403 as Insufficient permission", () => {
    expect(formatRefreshError(new HttpError(403, "u", "body"))).toBe(
      "Insufficient permission to access Actions.",
    );
  });

  it("formats HttpError 404 as Actions not supported", () => {
    expect(formatRefreshError(new HttpError(404, "u", "body"))).toBe(
      "Actions endpoint not supported by this Gitea version.",
    );
  });

  it("formats generic Error as message", () => {
    expect(formatRefreshError(new Error("Network failed"))).toBe("Network failed");
  });

  it("formats unknown as Unknown error", () => {
    expect(formatRefreshError("string")).toBe("Unknown error");
  });
});

describe("buildRunDetailMapsForRuns", () => {
  it("preserves existing job/artifact state for run keys", () => {
    const previous = makeEntry([]);
    previous.jobsByRun.set("1", [{ id: 1, name: "j1", status: "completed" }] as never);
    previous.jobsStateByRun.set("1", "idle");
    const runs = [{ id: 1, name: "r1", status: "completed" }] as WorkflowRun[];
    const result = buildRunDetailMapsForRuns(runs, previous);
    expect(result.jobsByRun.get("1")).toHaveLength(1);
    expect(result.jobsStateByRun.get("1")).toBe("idle");
  });

  it("adds unloaded state for new run keys", () => {
    const previous = makeEntry([]);
    const runs = [{ id: 42, name: "r1", status: "completed" }] as WorkflowRun[];
    const result = buildRunDetailMapsForRuns(runs, previous);
    expect(result.jobsStateByRun.get("42")).toBe("unloaded");
    expect(result.artifactsStateByRun.get("42")).toBe("unloaded");
  });
});

describe("nextEntryLoadingState", () => {
  it("returns loading true when no data", () => {
    expect(nextEntryLoadingState(false)).toEqual({ loading: true, error: undefined });
  });

  it("returns loading false when has data", () => {
    expect(nextEntryLoadingState(true)).toEqual({ loading: false, error: undefined });
  });
});

describe("nextEntrySuccessState", () => {
  it("returns loading false and no error", () => {
    expect(nextEntrySuccessState()).toEqual({ loading: false, error: undefined });
  });
});

describe("nextEntryErrorState", () => {
  it("returns loading false and error message", () => {
    expect(nextEntryErrorState("Failed")).toEqual({ loading: false, error: "Failed" });
  });
});

describe("resolveBranchFetch", () => {
  const context: BranchContext = { repo: mockRepo, branchName: "main", status: "resolved" };

  it("returns the resolved current branch in currentBranch mode", () => {
    const filter: BranchFilterState = { repo: mockRepo, mode: "currentBranch" };
    expect(resolveBranchFetch(context, filter)).toBe("main");
  });

  it("returns the filter branch in specificBranch mode", () => {
    const filter: BranchFilterState = { repo: mockRepo, mode: "specificBranch", branchName: "dev" };
    expect(resolveBranchFetch(context, filter)).toBe("dev");
  });

  it("returns undefined in allBranches mode", () => {
    const filter: BranchFilterState = { repo: mockRepo, mode: "allBranches" };
    expect(resolveBranchFetch(context, filter)).toBeUndefined();
  });

  it("returns undefined when current branch is unresolved", () => {
    const unresolved: BranchContext = { repo: mockRepo, branchName: null, status: "detached" };
    const filter: BranchFilterState = { repo: mockRepo, mode: "currentBranch" };
    expect(resolveBranchFetch(unresolved, filter)).toBeUndefined();
  });

  it("returns undefined when no filter is set", () => {
    expect(resolveBranchFetch(context, undefined)).toBeUndefined();
  });
});

const run = (id: number, createdAt: string): WorkflowRun => ({
  id,
  name: `run ${id}`,
  status: "completed",
  createdAt,
});

describe("mergeRunsById", () => {
  it("de-duplicates by id keeping the first occurrence", () => {
    const primary = [run(1, "2024-01-03T00:00:00Z")];
    const extra = [run(1, "2024-01-03T00:00:00Z"), run(2, "2024-01-02T00:00:00Z")];
    const merged = mergeRunsById(primary, extra);
    expect(merged.map((r) => r.id)).toEqual([1, 2]);
  });

  it("sorts most-recent first by createdAt", () => {
    const primary = [run(1, "2024-01-01T00:00:00Z")];
    const extra = [run(2, "2024-01-05T00:00:00Z"), run(3, "2024-01-03T00:00:00Z")];
    const merged = mergeRunsById(primary, extra);
    expect(merged.map((r) => r.id)).toEqual([2, 3, 1]);
  });
});
