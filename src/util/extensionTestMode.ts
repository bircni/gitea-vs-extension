/**
 * When EXTENSION_TEST_MODE=1, GITEA_EXTENSION_TEST_TOKEN supplies a PAT for automated
 * VS Code extension host tests (never use in production).
 */
export function resolveExtensionTestPat(): string | undefined {
  if (process.env.EXTENSION_TEST_MODE !== "1") {
    return undefined;
  }
  const t = process.env.GITEA_EXTENSION_TEST_TOKEN?.trim();
  return t === undefined || t === "" ? undefined : t;
}
