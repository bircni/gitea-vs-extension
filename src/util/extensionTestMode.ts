/**
 * When EXTENSION_TEST_MODE=1, GITEA_EXTENSION_TEST_TOKEN supplies a PAT for automated
 * VS Code extension host tests (never use in production).
 */
export function resolveExtensionTestPat(): string | undefined {
  if (process.env.EXTENSION_TEST_MODE !== "1") {
    return undefined;
  }
  const token = process.env.GITEA_EXTENSION_TEST_TOKEN;
  const trimmed = token === undefined ? undefined : token.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}
