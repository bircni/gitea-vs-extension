/**
 * Unit tests for ActionsTreeProvider with mocked store and config.
 */
import { getSettings } from "../config/settings";
import { ActionsTreeProvider } from "../views/actionsTreeProvider";
import { RepoNode } from "../views/nodes";
import type { RepoRef } from "../gitea/models";

jest.mock("../config/settings", () => ({
  getSettings: jest.fn(() => ({ baseUrl: "https://gitea.example", discoveryMode: "all" })),
}));

jest.mock("../config/secrets", () => ({
  getToken: jest.fn().mockResolvedValue("mock-token"),
}));

const mockRepo: RepoRef = { host: "gitea.example", owner: "o", name: "n" };

function createMockStore() {
  return {
    getRepos: jest.fn(() => [mockRepo] as RepoRef[]),
    getEntry: jest.fn(() => ({
      repo: mockRepo,
      runs: [],
      pullRequests: [],
      loading: false,
      error: undefined,
      errors: [],
    })),
    getEntries: jest.fn(() => []),
    isReposLoading: jest.fn(() => false),
    getBranchContext: jest.fn(() => ({
      repo: mockRepo,
      branchName: "main",
      status: "resolved" as const,
    })),
    getBranchFilter: jest.fn(() => ({ repo: mockRepo, mode: "currentBranch" as const })),
  };
}

describe("ActionsTreeProvider", () => {
  it("getChildren(undefined) returns root nodes", async () => {
    const store = createMockStore();
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren(undefined);
    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBeGreaterThan(0);
    expect(children[0]).toBeInstanceOf(RepoNode);
    expect((children[0] as RepoNode).repo).toEqual(mockRepo);
  });

  it("getChildren(undefined) returns message when no baseUrl", async () => {
    (getSettings as jest.Mock).mockReturnValueOnce({ baseUrl: "", discoveryMode: "all" });
    const store = createMockStore();
    store.getRepos.mockReturnValue([]);
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const children = await provider.getChildren(undefined);
    expect(children.length).toBe(1);
    expect(children[0].label).toContain("baseUrl");
  });

  it("refresh() fires tree change event", () => {
    const store = createMockStore();
    const provider = new ActionsTreeProvider("runs", store as never, {} as never, new Set());
    const listener = jest.fn();
    provider.onDidChangeTreeData(listener);
    provider.refresh();
    expect(listener).toHaveBeenCalled();
  });
});
