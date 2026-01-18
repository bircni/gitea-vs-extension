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
});
