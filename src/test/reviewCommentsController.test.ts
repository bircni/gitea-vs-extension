import { buildDiffPositionMap } from "../controllers/reviewCommentsController";

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
