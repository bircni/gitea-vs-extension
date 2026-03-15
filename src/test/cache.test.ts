import type { BranchContext, BranchFilterState } from "../util/branchContext";
import type { RepoRef, WorkflowRun } from "../gitea/models";
import { RepoStateStore } from "../util/cache";

const repoA: RepoRef = { host: "example.com", owner: "octo", name: "alpha" };
const repoB: RepoRef = { host: "example.com", owner: "octo", name: "beta" };

describe("RepoStateStore", () => {
  test("initializes entries for repos", () => {
    const store = new RepoStateStore();
    store.setRepos([repoA]);

    const entry = store.getEntry(repoA);
    expect(entry).toBeDefined();
    expect(entry?.repo).toEqual(repoA);
    expect(entry?.runs).toEqual([]);
    expect(entry?.pullRequests).toEqual([]);
  });

  test("preserves existing entries when repos are reset", () => {
    const store = new RepoStateStore();
    store.setRepos([repoA]);

    const run: WorkflowRun = {
      id: 1,
      name: "Run",
      status: "completed",
      conclusion: "success",
    };
    store.updateEntry(repoA, (entry) => {
      entry.runs = [run];
    });

    store.setRepos([repoA, repoB]);

    const entryA = store.getEntry(repoA);
    const entryB = store.getEntry(repoB);
    expect(entryA?.runs).toEqual([run]);
    expect(entryB?.runs).toEqual([]);
  });

  test("updateEntry ignores unknown repos", () => {
    const store = new RepoStateStore();
    store.setRepos([repoA]);

    store.updateEntry(repoB, (entry) => {
      entry.runs = [{ id: 2, name: "Other", status: "completed", conclusion: "success" }];
    });

    expect(store.getEntry(repoB)).toBeUndefined();
  });

  test("setWorkspaceFolders and getWorkspaceFolderPath", () => {
    const store = new RepoStateStore();
    store.setRepos([repoA, repoB]);
    const map = new Map<string, string>();
    map.set("example.com/octo/alpha", "/path/a");
    map.set("example.com/octo/beta", "/path/b");
    store.setWorkspaceFolders(map);

    expect(store.getWorkspaceFolderPath(repoA)).toBe("/path/a");
    expect(store.getWorkspaceFolderPath(repoB)).toBe("/path/b");
    expect(store.getWorkspaceFolderPath({ host: "x", owner: "y", name: "z" })).toBeUndefined();
  });

  test("setBranchContext and getBranchContext", () => {
    const store = new RepoStateStore();
    store.setRepos([repoA]);
    const ctx: BranchContext = {
      repo: repoA,
      branchName: "main",
      status: "resolved",
    };
    store.setBranchContext(ctx);

    expect(store.getBranchContext(repoA)).toEqual(ctx);
    expect(store.getBranchContext(repoB)).toBeUndefined();
  });

  test("setBranchFilter and getBranchFilter", () => {
    const store = new RepoStateStore();
    store.setRepos([repoA]);
    const filter: BranchFilterState = { repo: repoA, mode: "allBranches" };
    store.setBranchFilter(filter);

    expect(store.getBranchFilter(repoA)).toEqual(filter);
    expect(store.getBranchFilter(repoB)).toBeUndefined();
  });

  test("setReposLoading and isReposLoading", () => {
    const store = new RepoStateStore();
    expect(store.isReposLoading()).toBe(false);
    store.setReposLoading(true);
    expect(store.isReposLoading()).toBe(true);
    store.setReposLoading(false);
    expect(store.isReposLoading()).toBe(false);
  });

  test("getEntries returns all entries", () => {
    const store = new RepoStateStore();
    store.setRepos([repoA, repoB]);
    const entries = store.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.repo)).toEqual(expect.arrayContaining([repoA, repoB]));
  });
});
