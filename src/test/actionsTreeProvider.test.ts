/**
 * Unit tests for ActionsTreeProvider with mocked store and config.
 */
import { getSettings } from "../config/settings";
import { getEffectiveToken } from "../config/secrets";
import { ActionsTreeProvider } from "../views/actionsTreeProvider";
import { JobNode, MessageNode, PullRequestNode, RepoNode, RunNode, StepNode } from "../views/nodes";
import type { Job, RepoRef, WorkflowRun } from "../gitea/models";
import type { Mock } from "vitest";

vi.mock(import("../config/settings"), () => ({
  getSettings: vi.fn(() => ({ baseUrl: "https://gitea.example", discoveryMode: "all" })),
}));

vi.mock(import("../config/secrets"), () => {
  const fn = vi.fn().mockResolvedValue("mock-token");
  return {
    getToken: fn,
    getEffectiveToken: fn,
  };
});

const mockRepo: RepoRef = { host: "gitea.example", owner: "o", name: "n" };

function createMockStore() {
  return {
    getRepos: vi.fn(() => [mockRepo] as RepoRef[]),
    getEntry: vi.fn(() => ({
      repo: mockRepo,
      runs: [],
      pullRequests: [],
      loading: false,
      error: undefined,
      errors: [],
    })),
    getEntries: vi.fn(() => []),
    isReposLoading: vi.fn(() => false),
    getBranchContext: vi.fn(() => ({
      repo: mockRepo,
      branchName: "main",
      status: "resolved" as const,
    })),
    getBranchFilter: vi.fn(() => ({ repo: mockRepo, mode: "currentBranch" as const })),
  };
}

describe("ActionsTreeProvider", () => {
  it("runs mode with a single repo flattens runs to the root (no RepoNode)", async () => {
    const run: WorkflowRun = { id: 1, name: "build", branch: "main", status: "completed" };
    const store = createMockStore();
    store.getEntry.mockReturnValue({
      repo: mockRepo,
      runs: [run],
      pullRequests: [],
      loading: false,
      error: undefined,
      errors: [],
    });
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren();
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(RunNode);
    expect(children[0]).not.toBeInstanceOf(RepoNode);
    expect((children[0] as RunNode).repo).toEqual(mockRepo);
  });

  it("runs mode with a single repo and no runs shows a flattened message (no RepoNode)", async () => {
    const store = createMockStore();
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren();
    expect(children).toHaveLength(1);
    expect(children[0]).toBeInstanceOf(MessageNode);
    expect(children[0]).not.toBeInstanceOf(RepoNode);
  });

  it("shows the current branch pull request above its runs", async () => {
    const run: WorkflowRun = { id: 1, name: "build", branch: "main", status: "completed" };
    const store = createMockStore();
    store.getEntry.mockReturnValue({
      repo: mockRepo,
      runs: [run],
      pullRequests: [{ id: 42, number: 42, title: "Improve CI", state: "open", headRef: "main" }],
      loading: false,
      error: undefined,
      errors: [],
    });
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());

    const children = await provider.getChildren();

    expect(children[0]).toBeInstanceOf(PullRequestNode);
    expect(children[1]).toBeInstanceOf(RunNode);
  });

  it("sorts failed jobs and steps before successful ones", async () => {
    const run: WorkflowRun = { id: 1, name: "build", branch: "main", status: "completed" };
    const successful: Job = {
      id: 1,
      name: "Build",
      status: "completed",
      conclusion: "success",
      steps: [
        { name: "Install", status: "completed", conclusion: "success" },
        { name: "Test", status: "completed", conclusion: "failure" },
      ],
    };
    const failed: Job = {
      id: 2,
      name: "Lint",
      status: "completed",
      conclusion: "failure",
    };
    const store = createMockStore();
    store.getEntry.mockReturnValue({
      repo: mockRepo,
      runs: [run],
      pullRequests: [],
      loading: false,
      error: undefined,
      errors: [],
      jobsStateByRun: new Map([["1", "loaded"]]),
      jobsByRun: new Map([["1", [successful, failed]]]),
      artifactsByRun: new Map(),
    });
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());

    const jobs = await provider.getChildren(new RunNode(mockRepo, run));
    const steps = await provider.getChildren(new JobNode(mockRepo, run, successful));

    expect((jobs[0] as JobNode).job.name).toBe("Lint");
    expect(jobs[0]).toBeInstanceOf(JobNode);
    expect((steps[0] as StepNode).step.name).toBe("Test");
    expect(steps[0]).toBeInstanceOf(StepNode);
  });

  it("runs mode with multiple repos keeps the RepoNode grouping", async () => {
    const otherRepo: RepoRef = { host: "gitea.example", owner: "o", name: "other" };
    const store = createMockStore();
    store.getRepos.mockReturnValue([mockRepo, otherRepo]);
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren();
    expect(children).toHaveLength(2);
    expect(children[0]).toBeInstanceOf(RepoNode);
    expect((children[0] as RepoNode).repo).toEqual(mockRepo);
  });

  it("getChildren(undefined) returns message when no baseUrl", async () => {
    (getSettings as Mock).mockReturnValueOnce({ baseUrl: "", discoveryMode: "all" });
    const store = createMockStore();
    store.getRepos.mockReturnValue([]);
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren();
    expect(children).toHaveLength(1);
    expect(children[0].label).toContain("baseUrl");
  });

  it("accepts a token configured for a secondary Gitea instance", async () => {
    (getSettings as Mock).mockReturnValueOnce({
      baseUrl: "https://first.example",
      instanceUrls: ["https://first.example", "https://second.example"],
      discoveryMode: "all",
    });
    (getEffectiveToken as Mock)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("secondary-token");
    const store = createMockStore();
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());

    const children = await provider.getChildren();

    expect(children[0].label).not.toContain("Set a token");
  });

  it("refresh() fires tree change event", () => {
    const store = createMockStore();
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);
    provider.refresh();
    expect(listener).toHaveBeenCalled();
  });
});
