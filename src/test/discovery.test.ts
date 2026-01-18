import * as vscode from "vscode";
import { RepoDiscovery } from "../gitea/discovery";
import type { RepoRef } from "../gitea/models";
import { resolveRepoFromFolder } from "../util/repoResolution";

jest.mock("../util/repoResolution", () => ({
  resolveRepoFromFolder: jest.fn(),
}));

describe("RepoDiscovery", () => {
  const baseUrl = "http://gitea.example.com:3000";

  test("filters accessible repos by host", async () => {
    const api = {
      listAccessibleRepos: jest.fn(async () => [
        { host: "gitea.example.com:3000", owner: "octo", name: "one" },
        { host: "other.example.com", owner: "octo", name: "two" },
      ]),
    };
    const discovery = new RepoDiscovery(api as any);

    const repos = await discovery.discoverRepos("allAccessible", baseUrl);

    expect(repos).toHaveLength(1);
    expect(repos[0]?.name).toBe("one");
  });

  test("uses workspace repos when discovery mode is workspace", async () => {
    (vscode.workspace.workspaceFolders as any) = [{ uri: { fsPath: "/repo" } }];
    (resolveRepoFromFolder as jest.Mock).mockResolvedValueOnce({
      host: "gitea.example.com:3000",
      owner: "octo",
      name: "demo",
    } satisfies RepoRef);

    const api = { listAccessibleRepos: jest.fn() };
    const discovery = new RepoDiscovery(api as any);

    const repos = await discovery.discoverRepos("workspace", baseUrl);

    expect(resolveRepoFromFolder).toHaveBeenCalledWith("/repo", baseUrl);
    expect(repos).toHaveLength(1);
  });

  test("returns empty when baseUrl is invalid", async () => {
    const api = { listAccessibleRepos: jest.fn() };
    const discovery = new RepoDiscovery(api as any);

    const repos = await discovery.discoverRepos("workspace", "not-a-url");

    expect(repos).toEqual([]);
  });
});
