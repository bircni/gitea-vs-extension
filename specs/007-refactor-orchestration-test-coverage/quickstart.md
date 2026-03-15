# Quickstart: Refactor core orchestration and test coverage

**Branch**: `007-refactor-orchestration-test-coverage`  
**Audience**: Developers working on the refactor or running tests locally

## Prerequisites

- Node.js per `.node-version` (see repo root)
- npm (project uses npm, not yarn)

## Commands

### Validate (full check before/after changes)

```bash
npm run validate
```

Runs check-unused, lint, format, test, and build. **Must pass** after every refactor increment (spec FR-007, SC-001).

### Test

```bash
npm test
```

Runs all tests in `src/test/**/*.test.ts` with Jest. Use for fast feedback during refactor.

### Test with coverage

```bash
npm run test:coverage
```

Produces coverage report in `.tmp/coverage/`. Coverage includes `src/controllers/**` and `src/views/**`; unit tests exist for CommandsController, RefreshController, ActionsTreeProvider, and SettingsTreeProvider. `extension.ts` and `config/**` remain excluded.

### Watch mode

```bash
npm run test:watch
```

Jest in watch mode; re-runs tests on file change.

### Build and package

```bash
npm run compile   # TypeScript only
npm run bundle    # esbuild bundle
npm run package   # Produce .vsix
npm run build     # compile + bundle + package
```

Use `npm run build` before manual installation of the extension.

### Run the extension (development)

1. Open the repo in VS Code (or a VS Code–compatible editor).
2. Press F5 or use “Run and Debug” to launch an Extension Development Host.
3. In the new window, open a workspace that has Gitea git remotes and configure the extension (base URL, token) if needed.
4. Use the Gitea views (Current Branch Runs, Workflows, etc.) and commands to verify no behavior regression after refactor steps.

## Refactor workflow (per increment)

1. Create or update the relevant module (e.g. tree helpers, refresh helpers, command units).
2. Add or update tests in `src/test/` for the new or extracted logic.
3. Run `npm test` (and optionally `npm run test:coverage`) to ensure new tests pass and coverage is acceptable.
4. Run `npm run validate` to ensure the full pipeline passes.
5. Commit and open a PR; **reference the [spec](../spec.md), [plan](../plan.md), and [tasks.md](../tasks.md)** (and user story or FR as applicable).

## Manual verification (before merge)

Exercise in the Extension Development Host: branch filter, view runs/jobs, open logs, manage secrets/variables, use settings, check status bar. Confirm outcomes match pre-refactor behavior (no regression).

## Key files (this feature)

- **Spec**: [spec.md](../spec.md)
- **Plan**: [plan.md](../plan.md)
- **Research**: [research.md](../research.md)
- **Data model**: [data-model.md](../data-model.md)
- **Contracts**: [contracts/commands.md](../contracts/commands.md), [contracts/tree-builder.md](../contracts/tree-builder.md)
- **Tasks**: [tasks.md](../tasks.md) — phased task list for the refactor
- **Hotspots**: `src/controllers/commands.ts`, `src/controllers/refreshController.ts`, `src/views/actionsTreeProvider.ts`, `src/extension.ts`, `src/util/bootstrap.ts`, `src/util/cache.ts`, `jest.config.ts`
