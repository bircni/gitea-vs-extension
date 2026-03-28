# VS Code extension host tests (008)

E2E runs the packaged extension in a real VS Code instance via `@vscode/test-electron`.

## Flow

1. `runTest.ts` starts the hermetic mock Gitea (`src/test/mock-gitea/lifecycle.ts`), writes workspace settings under `fixture-workspace/.vscode/settings.json` with the mock `baseUrl` and `allAccessible` discovery, then launches the test host.
2. The extension host receives `EXTENSION_TEST_MODE=1` and `GITEA_EXTENSION_TEST_TOKEN` (same value as `MOCK_GITEA_TOKEN` in `src/test/mock-gitea/fixture.ts`). Those env vars are **only** for automation; do not set them during normal use.
3. **M1**: extension activates (`bircni.gitea-vs-extension`).
4. **M2**: `gitea-vs-extension.testConnection` runs against the mock (workspace `baseUrl` + test token).
5. **M3**: `gitea-vs-extension.__testRefreshDone` awaits a full refresh and returns repo count; asserts mock returned at least one repo.

Internal commands `__testRepoCount` and `__testRefreshDone` are registered only when `EXTENSION_TEST_MODE=1`.

## Run

```bash
npm run compile && npm run bundle
npm run test:e2e
```

The first run may download a VS Code build. On Linux CI, ensure a display or use the official `xvfb-run` pattern from the VS Code extension samples.
