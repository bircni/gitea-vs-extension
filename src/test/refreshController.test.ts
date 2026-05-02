/**
 * Unit tests for RefreshController with mocked API, store, and discovery.
 */
import { getSettings } from "../config/settings";
import { RefreshController } from "../controllers/refreshController";
import type { RepoRef } from "../gitea/models";
import * as repoResolution from "../util/repoResolution";
import type { Mock } from "vitest";

vi.mock("../config/settings", () => ({
  getSettings: vi.fn(() => ({
    discoveryMode: "all" as const,
    baseUrl: "https://gitea.example",
    maxRunsPerRepo: 10,
    runningRefreshSeconds: 30,
    idleRefreshSeconds: 60,
    maxJobsPerRun: 100,
  })),
}));

vi.mock("../util/git", () => ({
  getCurrentBranchInFolder: vi.fn().mockResolvedValue({
    branchName: "main",
    status: "resolved" as const,
    reason: undefined,
  }),
}));

vi.mock("../util/repoResolution", () => ({
  resolveWorkspaceRepos: vi.fn().mockResolvedValue([]),
}));

const mockRepo: RepoRef = { host: "gitea.example", owner: "o", name: "n" };

function createMockStore() {
  const entries = new Map<string, { repo: RepoRef; runs: unknown[]; errors: string[] }>();
  return {
    getRepos: vi.fn(() => [] as RepoRef[]),
    setRepos: vi.fn((repos: RepoRef[]) => {
      for (const r of repos) {
        const key = `${r.host}/${r.owner}/${r.name}`;
        if (!entries.has(key)) {
          entries.set(key, { repo: r, runs: [], errors: [] });
        }
      }
    }),
    setReposLoading: vi.fn(),
    isReposLoading: vi.fn(() => false),
    getWorkspaceFolderPath: vi.fn(() => undefined as string | undefined),
    getEntry: vi.fn((repo: RepoRef) => {
      const key = `${repo.host}/${repo.owner}/${repo.name}`;
      const e = entries.get(key);
      if (!e) {
        return undefined;
      }
      return {
        repo: e.repo,
        runs: e.runs,
        errors: e.errors,
        loading: false,
        pullRequests: [],
        jobsByRun: new Map(),
        jobsStateByRun: new Map(),
        jobsErrorByRun: new Map(),
        artifactsByRun: new Map(),
        artifactsStateByRun: new Map(),
        artifactsErrorByRun: new Map(),
      };
    }),
    updateEntry: vi.fn(),
    getEntries: vi.fn(() =>
      Array.from(entries.values()).map((e) => ({ repo: e.repo, runs: e.runs })),
    ),
    getBranchContext: vi.fn(() => undefined),
    setBranchContext: vi.fn(),
    getBranchFilter: vi.fn(() => undefined),
    setBranchFilter: vi.fn(),
    setWorkspaceFolders: vi.fn(),
  };
}

function createMockApi() {
  return {
    listRuns: vi.fn().mockResolvedValue([]),
    listJobs: vi.fn().mockResolvedValue([]),
    listArtifacts: vi.fn().mockResolvedValue([]),
    listPullRequests: vi.fn().mockResolvedValue([]),
    getCombinedStatus: vi.fn().mockResolvedValue({ state: "success" }),
  };
}

function createMockDiscovery() {
  return {
    discoverRepos: vi.fn().mockResolvedValue([mockRepo]),
  };
}

describe("RefreshController", () => {
  it("dispose() clears timer", () => {
    const store = createMockStore();
    const controller = new RefreshController(
      createMockApi() as never,
      store as never,
      createMockDiscovery() as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      vi.fn(),
      vi.fn(),
    );
    controller.dispose();
    expect(store.setRepos).not.toHaveBeenCalled();
  });

  it("refreshAll() discovers repos and calls onSummary", async () => {
    const store = createMockStore();
    const onSummary = vi.fn();
    const api = createMockApi();
    const discovery = createMockDiscovery();
    discovery.discoverRepos.mockResolvedValue([mockRepo]);
    store.getEntries.mockReturnValue([{ repo: mockRepo, runs: [] }]);

    const controller = new RefreshController(
      api as never,
      store as never,
      discovery as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      vi.fn(),
      onSummary,
    );

    await controller.refreshAll();

    expect(discovery.discoverRepos).toHaveBeenCalled();
    expect(store.setRepos).toHaveBeenCalledWith([mockRepo]);
    expect(store.setReposLoading).toHaveBeenCalledWith(false);
    expect(onSummary).toHaveBeenCalledWith({ runningCount: 0, failedCount: 0 });
    controller.dispose();
  });

  it("refreshAll() calls onDidUpdate when no repos initially", async () => {
    const store = createMockStore();
    store.getRepos.mockReturnValue([]);
    store.getEntries.mockReturnValue([]);
    const onDidUpdate = vi.fn();
    const discovery = createMockDiscovery();
    discovery.discoverRepos.mockResolvedValue([]);

    const controller = new RefreshController(
      createMockApi() as never,
      store as never,
      discovery as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      onDidUpdate,
      vi.fn(),
    );

    await controller.refreshAll();

    expect(store.setReposLoading).toHaveBeenCalledWith(true);
    expect(onDidUpdate).toHaveBeenCalled();
    controller.dispose();
  });

  it("refreshAll() when discovery throws still sets repos and continues", async () => {
    const store = createMockStore();
    store.getRepos.mockReturnValue([]);
    const logger = { warn: vi.fn(), debug: vi.fn() };
    const discovery = createMockDiscovery();
    discovery.discoverRepos.mockRejectedValue(new Error("Discovery failed"));

    const controller = new RefreshController(
      createMockApi() as never,
      store as never,
      discovery as never,
      logger as never,
      vi.fn(),
      vi.fn(),
    );

    await controller.refreshAll();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Repository discovery failed"),
    );
    expect(store.setRepos).toHaveBeenCalledWith([]);
    controller.dispose();
  });

  it("refreshAll() when discoveryMode is workspace calls setWorkspaceFolders", async () => {
    (getSettings as Mock).mockReturnValueOnce({
      discoveryMode: "workspace" as const,
      baseUrl: "https://gitea.example",
      maxRunsPerRepo: 10,
      runningRefreshSeconds: 30,
      idleRefreshSeconds: 60,
      maxJobsPerRun: 100,
    });

    const store = createMockStore();
    const discovery = createMockDiscovery();
    discovery.discoverRepos.mockResolvedValue([mockRepo]);
    store.getEntries.mockReturnValue([{ repo: mockRepo, runs: [] }]);

    (repoResolution.resolveWorkspaceRepos as Mock).mockResolvedValueOnce([
      { repo: mockRepo, folder: { uri: { fsPath: "/ws/repo" } } },
    ]);

    const controller = new RefreshController(
      createMockApi() as never,
      store as never,
      discovery as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      vi.fn(),
      vi.fn(),
    );

    await controller.refreshAll();

    expect(store.setWorkspaceFolders).toHaveBeenCalledWith(expect.any(Map));
    const map = store.setWorkspaceFolders.mock.calls[0][0] as Map<string, string>;
    expect(map.get("gitea.example/o/n")).toBe("/ws/repo");
    controller.dispose();
  });

  it("refreshAll() when workspace resolution throws logs and continues", async () => {
    (getSettings as Mock).mockReturnValueOnce({
      discoveryMode: "workspace" as const,
      baseUrl: "https://gitea.example",
      maxRunsPerRepo: 10,
      runningRefreshSeconds: 30,
      idleRefreshSeconds: 60,
      maxJobsPerRun: 100,
    });

    const store = createMockStore();
    const discovery = createMockDiscovery();
    discovery.discoverRepos.mockResolvedValue([mockRepo]);
    store.getEntries.mockReturnValue([{ repo: mockRepo, runs: [] }]);
    (repoResolution.resolveWorkspaceRepos as Mock).mockRejectedValueOnce(
      new Error("resolution failed"),
    );
    const logger = { warn: vi.fn(), debug: vi.fn() };

    const controller = new RefreshController(
      createMockApi() as never,
      store as never,
      discovery as never,
      logger as never,
      vi.fn(),
      vi.fn(),
    );

    await controller.refreshAll();

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("Workspace repo resolution failed"),
    );
    controller.dispose();
  });

  it("concurrent refreshAll callers await the same run (single discovery)", async () => {
    const store = createMockStore();
    let resolveDiscover!: (repos: RepoRef[]) => void;
    const discoverPromise = new Promise<RepoRef[]>((resolve) => {
      resolveDiscover = resolve;
    });
    const discovery = {
      discoverRepos: vi.fn(() => discoverPromise),
    };
    const api = createMockApi();
    const controller = new RefreshController(
      api as never,
      store as never,
      discovery as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      vi.fn(),
      vi.fn(),
    );

    const first = controller.refreshAll();
    const second = controller.refreshAll();
    expect(discovery.discoverRepos).toHaveBeenCalledTimes(1);

    resolveDiscover([mockRepo]);
    await Promise.all([first, second]);

    expect(store.setRepos).toHaveBeenCalledWith([mockRepo]);
    controller.dispose();
  });
});

describe("RefreshController.refreshRepo", () => {
  it("refreshRepo loads runs and updates entry", async () => {
    const store = createMockStore();
    store.getRepos.mockReturnValue([mockRepo]);
    store.getEntries.mockReturnValue([{ repo: mockRepo, runs: [] }]);
    store.getEntry.mockReturnValue(undefined);
    store.getWorkspaceFolderPath.mockReturnValue(undefined);
    store.getBranchFilter.mockReturnValue(undefined);

    const api = createMockApi();
    const runs = [
      {
        id: 1,
        name: "Run 1",
        status: "completed" as const,
        conclusion: "success" as const,
      },
    ];
    api.listRuns.mockResolvedValue(runs);
    api.listPullRequests.mockResolvedValue([]);

    const discovery = createMockDiscovery();
    discovery.discoverRepos.mockResolvedValue([mockRepo]);

    const onDidUpdate = vi.fn();
    const controller = new RefreshController(
      api as never,
      store as never,
      discovery as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      onDidUpdate,
      vi.fn(),
    );

    await controller.refreshAll();

    expect(store.updateEntry).toHaveBeenCalled();
    expect(api.listRuns).toHaveBeenCalledWith(mockRepo, 10);
    controller.dispose();
  });
});

describe("RefreshController.loadRunDetails", () => {
  it("loadRunDetails fetches jobs and artifacts and updates store", async () => {
    const store = createMockStore();
    store.getEntry.mockImplementation((repo: RepoRef) => {
      const key = `${repo.host}/${repo.owner}/${repo.name}`;
      const entries = new Map([
        [
          key,
          {
            repo,
            runs: [],
            pullRequests: [],
            loading: false,
            errors: [],
            jobsByRun: new Map(),
            jobsStateByRun: new Map(),
            jobsErrorByRun: new Map(),
            artifactsByRun: new Map(),
            artifactsStateByRun: new Map(),
            artifactsErrorByRun: new Map(),
          },
        ],
      ]);
      return entries.get(key);
    });

    const api = createMockApi();
    api.listJobs.mockResolvedValue([{ id: 1, name: "job", status: "completed" }]);
    api.listArtifacts.mockResolvedValue([]);

    const onDidUpdate = vi.fn();
    const controller = new RefreshController(
      api as never,
      store as never,
      createMockDiscovery() as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      onDidUpdate,
      vi.fn(),
    );

    await controller.loadRunDetails(mockRepo, 42);

    expect(store.updateEntry).toHaveBeenCalled();
    expect(api.listJobs).toHaveBeenCalledWith(mockRepo, 42, 100);
    expect(api.listArtifacts).toHaveBeenCalledWith(mockRepo, 42);
    controller.dispose();
  });

  it("loadRunDetails on API error sets error state", async () => {
    const store = createMockStore();
    store.getEntry.mockReturnValue({
      repo: mockRepo,
      runs: [],
      pullRequests: [],
      loading: false,
      errors: [],
      jobsByRun: new Map(),
      jobsStateByRun: new Map(),
      jobsErrorByRun: new Map(),
      artifactsByRun: new Map(),
      artifactsStateByRun: new Map(),
      artifactsErrorByRun: new Map(),
    });

    const api = createMockApi();
    api.listJobs.mockRejectedValue(new Error("API error"));
    api.listArtifacts.mockResolvedValue([]);

    const controller = new RefreshController(
      api as never,
      store as never,
      createMockDiscovery() as never,
      { warn: vi.fn(), debug: vi.fn() } as never,
      vi.fn(),
      vi.fn(),
    );

    await controller.loadRunDetails(mockRepo, 42);

    expect(store.updateEntry).toHaveBeenCalled();
    controller.dispose();
  });
});
