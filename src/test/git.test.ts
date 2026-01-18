describe("execGit", () => {
  test("executes git command and returns stdout", async () => {
    jest.resetModules();
    jest.doMock("child_process", () => ({
      execFile: (cmd: string, args: string[], options: { cwd: string }, cb: any) => {
        expect(cmd).toBe("git");
        expect(args).toEqual(["status", "--porcelain"]);
        expect(options.cwd).toBe("/repo");
        cb(null, { stdout: "ok\n", stderr: "" });
      },
    }));

    let execGit: (args: string[], cwd: string) => Promise<string>;
    jest.isolateModules(() => {
      ({ execGit } = require("../util/git"));
    });

    const result = await execGit(["status", "--porcelain"], "/repo");

    expect(result).toBe("ok\n");
  });
});
