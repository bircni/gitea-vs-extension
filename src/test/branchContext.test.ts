import type { RepoRef, WorkflowRun } from "../gitea/models";
import { filterRunsByBranch } from "../util/branchContext";

const repo: RepoRef = { host: "gitea.example", owner: "o", name: "n" };

function run(id: number, branch: string): WorkflowRun {
  return {
    id,
    name: `run-${id}`,
    branch,
    status: "completed",
    conclusion: "success",
  };
}

describe("filterRunsByBranch", () => {
  test("allBranches returns all runs", () => {
    const runs = [run(1, "main"), run(2, "feature/x")];
    const filter = { repo, mode: "allBranches" as const };
    const context = { repo, branchName: "main", status: "resolved" as const };
    expect(filterRunsByBranch(runs, filter, context)).toEqual(runs);
  });

  test("currentBranch with resolved context filters by branch name", () => {
    const runs = [run(1, "main"), run(2, "feature/x"), run(3, "main")];
    const filter = { repo, mode: "currentBranch" as const };
    const context = { repo, branchName: "main", status: "resolved" as const };
    const result = filterRunsByBranch(runs, filter, context);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.branch === "main")).toBe(true);
  });

  test("currentBranch with unresolved context returns all runs", () => {
    const runs = [run(1, "main"), run(2, "feature/x")];
    const filter = { repo, mode: "currentBranch" as const };
    const context = {
      repo,
      branchName: null,
      status: "detached" as const,
      reason: "Detached HEAD",
    };
    expect(filterRunsByBranch(runs, filter, context)).toEqual(runs);
  });

  test("specificBranch filters by filter.branchName", () => {
    const runs = [run(1, "main"), run(2, "feature/x")];
    const filter = { repo, mode: "specificBranch" as const, branchName: "feature/x" };
    const context = { repo, branchName: "main", status: "resolved" as const };
    const result = filterRunsByBranch(runs, filter, context);
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe("feature/x");
  });

  test("runs without branch are treated as unknown", () => {
    const runs = [{ ...run(1, "main"), branch: undefined }, run(2, "main")];
    const filter = { repo, mode: "currentBranch" as const };
    const context = { repo, branchName: "main", status: "resolved" as const };
    const result = filterRunsByBranch(runs, filter, context);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  test("currentBranch with noRepo context returns all runs", () => {
    const runs = [run(1, "main"), run(2, "feature/x")];
    const filter = { repo, mode: "currentBranch" as const };
    const context = {
      repo,
      branchName: null,
      status: "noRepo" as const,
      reason: "No workspace folder for this repository",
    };
    expect(filterRunsByBranch(runs, filter, context)).toEqual(runs);
  });
});
