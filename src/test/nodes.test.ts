/**
 * Unit tests for the capability tokens the run-control menus match on.
 */
import type { Job, RepoRef, WorkflowRun } from "../gitea/models";
import { buildJobContextValue, buildRunContextValue, JobNode, RunNode } from "../views/nodes";

const repo: RepoRef = { host: "gitea.example.com", owner: "o", name: "n" };

function run(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return { id: 1, name: "CI", status: "completed", conclusion: "success", ...overrides };
}

describe("buildRunContextValue", () => {
  it("marks a completed run as re-runnable", () => {
    expect(buildRunContextValue(run())).toBe("giteaRun rerunnable");
  });

  it("adds hasFailedJobs only for a failed run", () => {
    expect(buildRunContextValue(run({ conclusion: "failure" }))).toBe(
      "giteaRun rerunnable hasFailedJobs",
    );
  });

  it("keeps a running run out of the re-run menus", () => {
    const value = buildRunContextValue(run({ status: "running", conclusion: undefined }));
    expect(value).toBe("giteaRun");
  });

  it("is what RunNode exposes to when-clauses", () => {
    expect(new RunNode(repo, run()).contextValue).toBe(buildRunContextValue(run()));
  });
});

describe("buildJobContextValue", () => {
  it.each([
    ["completed", "giteaJob rerunnable"],
    ["running", "giteaJob"],
    ["queued", "giteaJob"],
  ] as const)("maps job status %s to %s", (status, expected) => {
    const job: Job = { id: 2, name: "build", status };
    expect(buildJobContextValue(job)).toBe(expected);
    expect(new JobNode(repo, run(), job).contextValue).toBe(expected);
  });
});
