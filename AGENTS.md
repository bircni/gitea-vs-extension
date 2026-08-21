# AI Agent Guide for Gitea VS Extension

This document provides essential context and guidelines for AI agents working on this VS Code extension project. Follow these instructions to ensure your contributions align with project standards.

## Quick Start Checklist

Before making changes:

1. Read this file completely
2. Understand the project structure (see below)
3. Run `npm run validate` to ensure current state is clean
4. Identify the correct files to modify under `src/`
5. Add or update tests in `src/test/` as needed
6. Run `npm run validate` again before committing

## Project Context

**What This Project Does:**

- VS Code extension that shows **Gitea Actions** workflow runs, jobs, and logs inside the editor
- Native tree views: **Current Branch**, **Workflows**, and **Settings**. A pull request matching
  the current branch appears above that branch's runs; Workflows groups by the API-provided
  workflow name, with a flat Recent runs fallback when Gitea omits it.
- Branch filter per repo; job logs can be opened locally (optionally saved to `.tmp/gitea-logs/`)
- Manages secrets and variables via Gitea API; uses workspace git remotes or API for repo discovery

**Tech Stack:**

- TypeScript (strict), Node.js (see `.node-version`)
- VS Code Extension API
- [undici](https://github.com/nodejs/undici) for HTTP
- Vitest for tests
- esbuild for bundling, vsce for packaging
- oxlint (type-aware) for linting, oxfmt for formatting

## Project Structure

### Source Code (`src/`)

**Entry and config:**

- `extension.ts` – Extension entry point, activation, wiring of store, views, controllers
- `config/settings.ts` – VS Code configuration (baseUrl, refresh intervals, discovery, etc.)
- `config/secrets.ts` – Token storage via VS Code SecretStorage

**Gitea integration:**

- `gitea/api.ts` – Gitea API client (runs, jobs, logs, secrets, variables, PRs)
- `gitea/client.ts` – HTTP client (undici), error handling
- `gitea/swagger.ts` – OpenAPI/Swagger discovery
- `gitea/discovery.ts` – Repo discovery (workspace vs all accessible)
- `gitea/remotes.ts` – Parse git remote URLs, match host
- `gitea/models.ts` – Shared types (RepoRef, WorkflowRun, Job, etc.)

**Controllers:**

- `controllers/commands.ts` – Command registration and handlers (refresh, view logs, branch filter, open in browser, secrets/variables)
- `controllers/refreshController.ts` – Polling, run/job loading, branch context
- `controllers/reviewCommentsController.ts` – Inline review comments (optional)

**Views:**

- `views/actionsTreeProvider.ts` – Tree data for Current Branch and Workflows (branch filtering,
  API workflow grouping, and current-branch pull-request context)
- `views/nodes.ts` – Tree item classes (RepoNode, RunNode, JobNode, etc.)
- `views/settingsTreeProvider.ts` – Settings tree (token, secrets, variables)
- `views/icons.ts` – Status/conclusion icons

**Utilities:**

- `util/cache.ts` – Repo state store (runs, jobs, branch context, filter state, workspace folder mapping)
- `util/git.ts` – `execGit`, `getCurrentBranchInFolder` for branch resolution
- `util/branchContext.ts` – Branch context resolution and types
- `util/repoResolution.ts` – Resolve RepoRef from workspace folder and base URL
- `util/expandedState.ts` – Which run/job nodes are expanded
- `util/limiter.ts` – Concurrency limiting
- `util/logging.ts` – Debug logging
- `util/time.ts` – Time helpers

**Tests:**

- Tests live in `src/test/` with naming `*.test.ts` (e.g. `api.test.ts`, `git.test.ts`)
- Mock VS Code in `src/test/__mocks__/vscode.ts` when needed

### Other Directories

- `dist/` – Build output (DO NOT EDIT; generated)
- `scripts/` – Release script (`release.js`), etc.
- `media/` – Icons and assets
- `specs/` – Feature specs and plans (e.g. current-branch-workflows)

## Available Commands

**Build & development:**

```bash
npm run compile   # TypeScript only
npm run bundle    # esbuild bundle
npm run package   # Produce .vsix
npm run build     # compile + bundle + package
npm run clean     # Remove dist/
```

**Testing:**

```bash
npm test              # Run all tests (unit + hermetic mock integration)
npm run test:integration   # Only `gitea-api-mock.integration.test.ts`
npm run test:live     # Optional real Gitea smoke (needs GITEA_BASE_URL; skips if unset unless REQUIRE_LIVE_GITEA=1)
npm run test:e2e      # VS Code extension host vs mock (needs compile + bundle first; see src/test/e2e/README.md)
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run test:report   # Tests then report path
```

**Quality:**

```bash
npm run lint     # oxlint (type-aware)
npm run format   # oxfmt check
npm run validate # check-unused + lint + format + test + build
```

**Security:**

```bash
npm run audit    # npm audit (--audit-level high)
```

**Release:**

```bash
npm run release  # Version, changelog (cliff), tag (see scripts/release.js)
```

## Critical Rules for AI Agents

### 1. File Modification Boundaries

**Do:**

- Modify source under `src/` (excluding `dist/` which is generated)
- Add or update tests in `src/test/*.test.ts`
- Update `package.json` for dependencies, scripts, or contribution points (commands, views, config)
- Update README or docs when adding user-facing features or config

**Do not:**

- Edit files in `dist/`
- Change `.vscodeignore` or build config without good reason
- Edit `CHANGELOG.md` by hand (generated by release process)

### 2. Commands and Context

- When registering a command that can be run from a **tree item context menu**, pass the first argument through to the handler so the correct repo/item is used (e.g. `(arg) => this.handleX(arg)`). Otherwise, in multi-repo workspaces the handler may act on the wrong repo (e.g. settings “current” repo).

### 3. Testing

- Add or update tests in `src/test/` for new or changed behavior
- Run `npm test` (and ideally `npm run validate`) before committing
- Mock `child_process`, `undici`, or VS Code APIs as in existing tests (e.g. `git.test.ts`, `api.test.ts`)

### 4. Code Style

- TypeScript strict mode; avoid `any`
- Use existing patterns: RepoRef, store.getEntry(), getSettings(), etc.
- Naming: PascalCase for classes, camelCase for functions and variables, kebab-case for test file names

### 5. Git and Commits

- Prefer [Conventional Commits](https://www.conventionalcommits.org/): `feat(scope): description`, `fix(scope): description`, `chore: description`, etc.
- Scope can be a subarea: e.g. `feat(views): …`, `fix(commands): …`, `chore(deps): …`

### 6. Validation Before Committing

Run:

```bash
npm run validate
```

This runs check-unused, lint, format, test, and build. Fix any failures before committing.

## Common Tasks and Patterns

### Adding a new command

1. Register in `controllers/commands.ts` with `vscode.commands.registerCommand(...)`.
2. If the command is shown in a tree item context menu, pass the first argument into the handler so the correct repo/item is used.
3. Add the command and optional menu contribution in `package.json` under `contributes.commands` and `contributes.menus`.

### Adding a new Gitea API call

1. Add the method in `gitea/api.ts` (use existing request/response patterns).
2. Call it from the appropriate controller or view; use the store in `util/cache.ts` if the result is part of repo state.

### Changing tree view behavior

1. Data and structure: `views/actionsTreeProvider.ts` (and `views/nodes.ts` for node types).
2. Commands that affect the tree (e.g. branch filter) live in `controllers/commands.ts` and often call `store` + `treeProvider.refresh()` (and optional `refreshViews` callback).

### Changing branch or filter logic

- Branch resolution: `util/git.ts` (`getCurrentBranchInFolder`), `util/branchContext.ts`.
- Filter state and “current branch” vs “all branches” vs specific branch: `util/cache.ts` (e.g. `setBranchFilter`, `getFilteredRuns` in the tree provider).

## Definition of Done

Before considering a task complete:

- [ ] Code compiles (`npm run compile` or `npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Tests added/updated for new or changed behavior
- [ ] Lint passes (`npm run lint`)
- [ ] Format check passes (`npm run format`); run `npm run format:write` if needed
- [ ] `npm run validate` passes
- [ ] Commit message follows Conventional Commits
- [ ] Changes are focused and minimal

## Quick Reference

**Commands:**

```bash
npm run validate   # Full check before commit
npm test           # Tests
npm run build      # Build extension
npm run lint       # Lint
npm run audit      # Security audit
```

**Locations:**

- Source: `src/` (gitea/, config/, controllers/, views/, util/)
- Tests: `src/test/*.test.ts`
- Build output: `dist/` (do not edit)

**Commit format:**

```
<type>(<scope>): <description>

e.g. feat(views): add branch filter to repo context menu
     fix(commands): pass context into switchBranchFilter handler
     chore(deps): override yauzl for audit
```

When in doubt, follow existing patterns in the codebase.
