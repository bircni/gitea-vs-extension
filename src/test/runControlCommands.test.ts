/**
 * Unit tests for the run control command handlers.
 */
import {
  rerunFailedJobs,
  rerunJob,
  rerunRun,
  type RunControlCommandsDeps,
} from "../controllers/runControlCommands";
import type { Job, RepoRef, WorkflowRun } from "../gitea/models";
import { JobNode, RunNode } from "../views/nodes";

const mockRepo: RepoRef = { host: "gitea.example.com", owner: "o", name: "n" };
const mockRun: WorkflowRun = {
  id: 42,
  name: "CI",
  runNumber: 7,
  status: "completed",
  conclusion: "failure",
};
const mockJob: Job = { id: 99, name: "build", status: "completed", conclusion: "failure" };

function makeDeps(overrides: Partial<RunControlCommandsDeps> = {}): RunControlCommandsDeps {
  return {
    rerunRun: vi.fn(async () => {}),
    rerunFailedJobs: vi.fn(async () => {}),
    rerunJob: vi.fn(async () => {}),
    refreshRepo: vi.fn(async () => {}),
    withProgress: async (_title, task) => task(),
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    ...overrides,
  };
}

describe("rerunRun", () => {
  it("re-runs the run behind a RunNode and refreshes its repo", async () => {
    const deps = makeDeps();

    await rerunRun(deps, new RunNode(mockRepo, mockRun));

    expect(deps.rerunRun).toHaveBeenCalledWith(mockRepo, 42);
    expect(deps.refreshRepo).toHaveBeenCalledWith(mockRepo);
    expect(deps.showInformationMessage).toHaveBeenCalledWith("Re-run of #7 requested.");
  });

  it("asks for a selection when the argument is not a run", async () => {
    const deps = makeDeps();

    await rerunRun(deps, "nonsense");

    expect(deps.rerunRun).not.toHaveBeenCalled();
    expect(deps.showInformationMessage).toHaveBeenCalledWith(
      "Select a workflow run in the tree to re-run.",
    );
  });

  it("surfaces the API error and skips the refresh", async () => {
    const deps = makeDeps({
      rerunRun: vi.fn(async () => {
        throw new Error("Re-run failed: the token needs Actions write access for this repository.");
      }),
    });

    await rerunRun(deps, new RunNode(mockRepo, mockRun));

    expect(deps.showErrorMessage).toHaveBeenCalledWith(
      "Re-run failed: the token needs Actions write access for this repository.",
    );
    expect(deps.refreshRepo).not.toHaveBeenCalled();
  });
});

describe("rerunFailedJobs", () => {
  it("re-runs the failed jobs of the selected run", async () => {
    const deps = makeDeps();

    await rerunFailedJobs(deps, new RunNode(mockRepo, mockRun));

    expect(deps.rerunFailedJobs).toHaveBeenCalledWith(mockRepo, 42);
    expect(deps.refreshRepo).toHaveBeenCalledWith(mockRepo);
  });
});

describe("rerunJob", () => {
  it("re-runs the job behind a JobNode", async () => {
    const deps = makeDeps();

    await rerunJob(deps, new JobNode(mockRepo, mockRun, mockJob));

    expect(deps.rerunJob).toHaveBeenCalledWith(mockRepo, 42, 99);
    expect(deps.showInformationMessage).toHaveBeenCalledWith("Re-run of build requested.");
  });

  it("asks for a selection when the argument is not a job", async () => {
    const deps = makeDeps();

    await rerunJob(deps, new RunNode(mockRepo, mockRun));

    expect(deps.rerunJob).not.toHaveBeenCalled();
    expect(deps.showInformationMessage).toHaveBeenCalledWith("Select a job in the tree to re-run.");
  });
});
