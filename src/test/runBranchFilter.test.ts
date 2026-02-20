import { selectBranchRuns } from "../util/runBranchFilter";
import type { WorkflowRun } from "../gitea/models";

function buildRun(id: number, branch: string): WorkflowRun {
  return {
    id,
    name: `Run ${id}`,
    branch,
    status: "completed",
    conclusion: "success",
  };
}

describe("selectBranchRuns", () => {
  test("returns only runs that match current branch", () => {
    const selection = selectBranchRuns({
      runs: [buildRun(1, "main"), buildRun(2, "feature/test"), buildRun(3, "main")],
      currentBranch: "main",
    });

    expect(selection.warning).toBeUndefined();
    expect(selection.emptyMessage).toBeUndefined();
    expect(selection.runs.map((run) => run.id)).toEqual([1, 3]);
  });

  test("returns branch-specific empty message when no runs match", () => {
    const selection = selectBranchRuns({
      runs: [buildRun(1, "feature/test")],
      currentBranch: "main",
    });

    expect(selection.warning).toBeUndefined();
    expect(selection.runs).toEqual([]);
    expect(selection.emptyMessage).toBe('No workflow runs found for branch "main".');
  });

  test("returns warning and suppresses runs when branch warning is present", () => {
    const selection = selectBranchRuns({
      runs: [buildRun(1, "main")],
      currentBranch: "main",
      branchWarning: "Cannot determine current branch.",
    });

    expect(selection.warning).toBe("Cannot determine current branch.");
    expect(selection.runs).toEqual([]);
    expect(selection.emptyMessage).toBeUndefined();
  });
});
