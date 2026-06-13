import { execGit, getCurrentBranchInFolder } from "../util/git";

type QueuedResult = { stdout?: string; stderr?: string; err?: Error };

const resultQueue: QueuedResult[] = [];

vi.mock("child_process", () => {
  const { promisify } = require("node:util");
  const execFileMock = vi.fn();
  const promisifyWithCustom = promisify as { custom?: symbol };
  const customSymbol = promisifyWithCustom.custom;
  if (customSymbol) {
    type CustomImpl = (
      _file: string,
      _args: string[],
      _opts: { cwd: string },
    ) => Promise<{ stdout: string; stderr: string }>;
    (execFileMock as unknown as Record<symbol, CustomImpl>)[customSymbol] = function (
      _file: string,
      _args: string[],
      _opts: { cwd: string },
    ): Promise<{ stdout: string; stderr: string }> {
      return new Promise((resolve, reject) => {
        setImmediate(() => {
          const next = resultQueue.shift();
          if (!next) {
            resolve({ stdout: "", stderr: "" });
            return;
          }
          if (next.err) {
            reject(next.err);
            return;
          }
          resolve({
            stdout: next.stdout ?? "",
            stderr: next.stderr ?? "",
          });
        });
      });
    };
  }
  return { execFile: execFileMock };
});

function enqueue(stdout: string, stderr = ""): void {
  resultQueue.push({ stdout, stderr });
}

function enqueueError(err: Error): void {
  resultQueue.push({ err });
}

describe("execGit", () => {
  beforeEach(() => {
    resultQueue.length = 0;
  });

  test("executes git with args and cwd and returns stdout", async () => {
    enqueue("ok\n");

    const result = await execGit(["status", "--porcelain"], "/repo");

    expect(result).toBe("ok\n");
  });

  test("returns stdout including newline when present", async () => {
    enqueue("true\n");

    const result = await execGit(["rev-parse", "--is-inside-work-tree"], "/repo");

    expect(result).toBe("true\n");
  });
});

describe("getCurrentBranchInFolder", () => {
  const cwd = "/some/repo";

  beforeEach(() => {
    resultQueue.length = 0;
  });

  test("returns noRepo when rev-parse --is-inside-work-tree returns non-true", async () => {
    enqueue("false\n");

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({
      branchName: null,
      status: "noRepo",
      reason: "Not a git repository",
    });
  });

  test("returns noRepo when rev-parse --is-inside-work-tree throws", async () => {
    enqueueError(new Error("not a git repository"));

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({
      branchName: null,
      status: "noRepo",
      reason: "Not a git repository",
    });
  });

  test("returns resolved branch when symbolic-ref returns refs/heads/<name>", async () => {
    enqueue("true\n");
    enqueue("refs/heads/main\n");

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({ branchName: "main", status: "resolved" });
  });

  test("returns resolved branch for branch name with path segment", async () => {
    enqueue("true\n");
    enqueue("refs/heads/feature/foo\n");

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({ branchName: "feature/foo", status: "resolved" });
  });

  test("returns unresolved when symbolic-ref returns ref not under refs/heads/", async () => {
    enqueue("true\n");
    enqueue("refs/tags/v1.0\n");

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({
      branchName: null,
      status: "unresolved",
      reason: "Could not resolve branch name",
    });
  });

  test("returns unresolved when symbolic-ref throws and rev-parse HEAD throws", async () => {
    enqueue("true\n");
    enqueueError(new Error("symbolic-ref failed"));
    enqueueError(new Error("rev-parse HEAD failed"));

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({
      branchName: null,
      status: "unresolved",
      reason: "Could not resolve HEAD",
    });
  });

  test("returns detached when symbolic-ref throws but rev-parse HEAD succeeds", async () => {
    enqueue("true\n");
    enqueueError(new Error("symbolic-ref failed"));
    enqueue("abc123\n");

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({
      branchName: null,
      status: "detached",
      reason: "Detached HEAD",
    });
  });

  test("treats empty branch name after refs/heads/ as null branchName", async () => {
    enqueue("true\n");
    enqueue("refs/heads/\n");

    const result = await getCurrentBranchInFolder(cwd);

    expect(result).toEqual({ branchName: null, status: "resolved" });
  });
});
