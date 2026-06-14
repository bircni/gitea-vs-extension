import * as vscode from "vscode";
import path from "node:path";
import {
  buildDiffPositionMap,
  compareReviewCommentById,
  findDiffPositionForLine,
  fingerprintCommentPlan,
  planReviewCommentThreads,
  selectedReviewLine,
  workspaceRelativePath,
} from "../controllers/reviewCommentsController";
import type { PullRequestReviewComment } from "../gitea/models";
import type * as fsModule from "node:fs";

vi.mock("fs", async () => ({
  ...(await vi.importActual<typeof fsModule>("fs")),
  existsSync: vi.fn(() => true),
}));

test("maps hunk positions without counting hunk headers", () => {
  const diff = [
    "diff --git a/src/file.ts b/src/file.ts",
    "--- a/src/file.ts",
    "+++ b/src/file.ts",
    "@@ -10,2 +10,2 @@",
    " lineA",
    "-lineB",
    "+lineC",
  ].join("\n");

  const map = buildDiffPositionMap(diff);
  const fileMap = map.get("src/file.ts");

  expect(fileMap?.get(1)).toBe(10);
  expect(fileMap?.get(3)).toBe(11);
});

test("findDiffPositionForLine returns the diff position for a new-file line", () => {
  const diff = [
    "diff --git a/README.md b/README.md",
    "--- a/README.md",
    "+++ b/README.md",
    "@@ -1,4 +1,4 @@",
    " # Fixture repo",
    " ",
    "-main line",
    "+updated feature line",
  ].join("\n");

  expect(findDiffPositionForLine(diff, "README.md", 3)).toBe(4);
});

test("keeps positions continuous across hunks without header offset", () => {
  const diff = [
    "diff --git a/src/file.ts b/src/file.ts",
    "--- a/src/file.ts",
    "+++ b/src/file.ts",
    "@@ -1,2 +1,2 @@",
    " line1",
    "-line2",
    "+line2x",
    "@@ -10,1 +10,1 @@",
    " line10",
  ].join("\n");

  const map = buildDiffPositionMap(diff);
  const fileMap = map.get("src/file.ts");

  expect(fileMap?.get(1)).toBe(1);
  expect(fileMap?.get(3)).toBe(2);
  expect(fileMap?.get(4)).toBe(10);
});

test("skips /dev/null in +++ line", () => {
  const diff = [
    "diff --git a/deleted b/deleted",
    "deleted file mode 100644",
    "--- a/deleted",
    "+++ /dev/null",
  ].join("\n");

  const map = buildDiffPositionMap(diff);
  expect(map.size).toBe(0);
});

test(String.raw`skips \ No newline at end of file line`, () => {
  const diff = [
    "diff --git a/f b/f",
    "--- a/f",
    "+++ b/f",
    "@@ -1,1 +1,2 @@",
    " a",
    "+b",
    String.raw`\ No newline at end of file`,
  ].join("\n");

  const map = buildDiffPositionMap(diff);
  const fileMap = map.get("f");
  expect(fileMap?.get(1)).toBe(1);
  expect(fileMap?.get(2)).toBe(2);
  expect(fileMap?.has(3)).toBe(false);
});

test("deleted-only lines do not add to file map", () => {
  const diff = [
    "diff --git a/f b/f",
    "--- a/f",
    "+++ b/f",
    "@@ -1,3 +1,1 @@",
    "-a",
    "-b",
    " c",
  ].join("\n");

  const map = buildDiffPositionMap(diff);
  const fileMap = map.get("f");
  expect(fileMap?.get(3)).toBe(1);
  expect(fileMap?.size).toBe(1);
});

test("selectedReviewLine uses the active editor line as a one-based line number", () => {
  const selection = { active: { line: 4 } } as vscode.Selection;

  expect(selectedReviewLine(selection)).toBe(5);
});

test("workspaceRelativePath returns slash-separated repository paths", () => {
  const folderPath = path.join("workspace", "repo");
  const folder = {
    uri: vscode.Uri.file(folderPath),
    name: "repo",
    index: 0,
  } as vscode.WorkspaceFolder;
  const uri = vscode.Uri.file(path.join(folderPath, "src", "file.ts"));

  expect(workspaceRelativePath(folder, uri)).toBe("src/file.ts");
});

test("workspaceRelativePath rejects files outside the workspace folder", () => {
  const rootPath = path.join("workspace", "repo");
  const folder = {
    uri: vscode.Uri.file(rootPath),
    name: "repo",
    index: 0,
  } as vscode.WorkspaceFolder;
  const uri = vscode.Uri.file(path.join("workspace", "other", "file.ts"));

  expect(workspaceRelativePath(folder, uri)).toBeUndefined();
});

describe("review comment render fingerprint", () => {
  const folder = {
    uri: vscode.Uri.file("/workspace"),
    name: "w",
    index: 0,
  } as vscode.WorkspaceFolder;

  test("fingerprint is stable for identical comments", () => {
    const c: PullRequestReviewComment = {
      id: 1,
      body: "hi",
      path: "src/a.ts",
      line: 2,
      author: "alice",
      updatedAt: "2020-01-01",
    };
    const plan1 = planReviewCommentThreads(folder, [c]);
    const plan2 = planReviewCommentThreads(folder, [{ ...c }]);
    expect(fingerprintCommentPlan("/workspace", 5, plan1)).toBe(
      fingerprintCommentPlan("/workspace", 5, plan2),
    );
  });

  test("sorts same-line thread comments by numeric id, not lexicographically", () => {
    const comments: PullRequestReviewComment[] = [
      { id: 10, body: "second", path: "f.ts", line: 1, author: "a" },
      { id: 2, body: "first", path: "f.ts", line: 1, author: "b" },
    ];
    const plan = planReviewCommentThreads(folder, comments);
    const thread = [...plan.values()][0];
    expect(thread.comments.map((c) => c.id)).toEqual([2, 10]);
  });

  test("compareReviewCommentById uses lexicographic order when id is not canonical decimal", () => {
    const a = { id: "010", path: "f", line: 1, author: "x" } as PullRequestReviewComment;
    const b = { id: "002", path: "f", line: 1, author: "x" } as PullRequestReviewComment;
    expect(compareReviewCommentById(a, b)).toBeGreaterThan(0);
  });

  test("fingerprint changes when avatar URL changes", () => {
    const base = {
      id: 1,
      body: "hi",
      path: "f.ts",
      line: 1,
      author: "a",
      updatedAt: "2020-01-01",
    };
    const fp1 = fingerprintCommentPlan(
      "/workspace",
      1,
      planReviewCommentThreads(folder, [{ ...base, avatarUrl: "https://a.example/a.png" }]),
    );
    const fp2 = fingerprintCommentPlan(
      "/workspace",
      1,
      planReviewCommentThreads(folder, [{ ...base, avatarUrl: "https://a.example/b.png" }]),
    );
    expect(fp1).not.toBe(fp2);
  });

  test("fingerprint changes when comment body changes", () => {
    const base = { id: 1, path: "f.ts", line: 1, author: "a" };
    const fp1 = fingerprintCommentPlan(
      "/workspace",
      1,
      planReviewCommentThreads(folder, [{ ...base, body: "one" }]),
    );
    const fp2 = fingerprintCommentPlan(
      "/workspace",
      1,
      planReviewCommentThreads(folder, [{ ...base, body: "two" }]),
    );
    expect(fp1).not.toBe(fp2);
  });
});
