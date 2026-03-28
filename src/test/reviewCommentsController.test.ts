import * as vscode from "vscode";
import {
  buildDiffPositionMap,
  fingerprintCommentPlan,
  planReviewCommentThreads,
} from "../controllers/reviewCommentsController";
import type { PullRequestReviewComment } from "../gitea/models";

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(() => true),
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

test("skips \\ No newline at end of file line", () => {
  const diff = [
    "diff --git a/f b/f",
    "--- a/f",
    "+++ b/f",
    "@@ -1,1 +1,2 @@",
    " a",
    "+b",
    "\\ No newline at end of file",
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
