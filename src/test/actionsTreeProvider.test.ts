/**
 * Unit tests for ActionsTreeProvider with mocked store and config.
 */
import { getSettings } from "../config/settings";
import { ActionsTreeProvider } from "../views/actionsTreeProvider";
import { MessageNode, RepoNode, RunNode } from "../views/nodes";
import type { RepoRef, WorkflowRun } from "../gitea/models";
import type { Mock } from "vitest";

vi.mock("../config/settings", () => ({
  getSettings: vi.fn(() => ({ baseUrl: "https://gitea.example", discoveryMode: "all" })),
}));

vi.mock("../config/secrets", () => {
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
    expect(children.length).toBe(1);
    expect(children[0]).toBeInstanceOf(RunNode);
    expect(children[0]).not.toBeInstanceOf(RepoNode);
    expect((children[0] as RunNode).repo).toEqual(mockRepo);
  });

  it("runs mode with a single repo and no runs shows a flattened message (no RepoNode)", async () => {
    const store = createMockStore();
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren();
    expect(children.length).toBe(1);
    expect(children[0]).toBeInstanceOf(MessageNode);
    expect(children[0]).not.toBeInstanceOf(RepoNode);
  });

  it("runs mode with multiple repos keeps the RepoNode grouping", async () => {
    const otherRepo: RepoRef = { host: "gitea.example", owner: "o", name: "other" };
    const store = createMockStore();
    store.getRepos.mockReturnValue([mockRepo, otherRepo]);
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren();
    expect(children.length).toBe(2);
    expect(children[0]).toBeInstanceOf(RepoNode);
    expect((children[0] as RepoNode).repo).toEqual(mockRepo);
  });

  it("getChildren(undefined) returns message when no baseUrl", async () => {
    (getSettings as Mock).mockReturnValueOnce({ baseUrl: "", discoveryMode: "all" });
    const store = createMockStore();
    store.getRepos.mockReturnValue([]);
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren();
    expect(children.length).toBe(1);
    expect(children[0].label).toContain("baseUrl");
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
