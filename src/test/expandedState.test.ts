import { expandedRepoKey, expandedRunKey, expandedWorkflowKey } from "../util/expandedState";
import type { RepoRef } from "../gitea/models";

describe("expandedState helpers", () => {
  const repo: RepoRef = { host: "example.com", owner: "octo", name: "demo" };

  test("builds expanded repo key", () => {
    expect(expandedRepoKey(repo)).toBe("repo:example.com/octo/demo");
  });

  test("builds expanded run key", () => {
    expect(expandedRunKey(repo, 12)).toBe("run:example.com/octo/demo/12");
  });

  test("builds expanded workflow key", () => {
    expect(expandedWorkflowKey("CI")).toBe("workflow:CI");
  });
});
