import * as vscode from "vscode";
import { resolveRepoFromFolder, resolveWorkspaceRepos } from "../util/repoResolution";
import { execGit } from "../util/git";

jest.mock("../util/git", () => ({
  execGit: jest.fn(),
}));

describe("repoResolution", () => {
  const baseUrl = "http://gitea.example.com:3000";

  beforeEach(() => {
    (execGit as jest.Mock).mockReset();
    (vscode.workspace.workspaceFolders as any) = [];
  });

  test("resolves repo from matching remote", async () => {
    (execGit as jest.Mock)
      .mockResolvedValueOnce("true\n")
      .mockResolvedValueOnce("origin\thttps://gitea.example.com:3000/octo/demo.git (fetch)\n");

    const repo = await resolveRepoFromFolder("/repo", baseUrl);

    expect(repo).toEqual({ host: "gitea.example.com:3000", owner: "octo", name: "demo" });
  });

  test("returns undefined when not a git repo", async () => {
    (execGit as jest.Mock).mockResolvedValueOnce("false\n");

    const repo = await resolveRepoFromFolder("/repo", baseUrl);

    expect(repo).toBeUndefined();
  });

  test("returns undefined when no matching remote", async () => {
    (execGit as jest.Mock)
      .mockResolvedValueOnce("true\n")
      .mockResolvedValueOnce("origin\tgit@github.com:octo/demo.git (fetch)\n");

    const repo = await resolveRepoFromFolder("/repo", baseUrl);

    expect(repo).toBeUndefined();
  });

  test("resolves workspace repos and de-duplicates", async () => {
    (vscode.workspace.workspaceFolders as any) = [
      { uri: { fsPath: "/repo1" } },
      { uri: { fsPath: "/repo2" } },
    ];

    (execGit as jest.Mock).mockImplementation((args: string[], cwd: string) => {
      if (args[0] === "rev-parse") {
        return Promise.resolve("true\n");
      }
      if (cwd === "/repo1") {
        return Promise.resolve("origin\thttps://gitea.example.com:3000/octo/demo.git (fetch)\n");
      }
      return Promise.resolve("origin\thttps://gitea.example.com:3000/octo/demo.git (fetch)\n");
    });

    const repos = await resolveWorkspaceRepos(baseUrl);

    expect(repos).toHaveLength(1);
    expect(repos[0]?.repo.owner).toBe("octo");
  });
});
