# Implementation Plan: Refactor core orchestration and test coverage

**Branch**: `007-refactor-orchestration-test-coverage` | **Date**: 2026-03-15 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/007-refactor-orchestration-test-coverage/spec.md`

## Summary

Refactor the extension’s command, refresh, and tree orchestration layers into smaller, testable units while preserving all existing behavior. Extract pure or mostly pure logic from `controllers/commands.ts`, `controllers/refreshController.ts`, and `views/actionsTreeProvider.ts` into helpers; simplify `extension.ts` with bootstrap helpers; then include controllers and views in coverage and add targeted tests for command handlers, refresh state, tree output, review comments controller, and cache behavior. Delivery is incremental (multiple PRs allowed); each step keeps the repo passing.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js per `.node-version` (VS Code extension host)  
**Primary Dependencies**: VS Code Extension API, undici (HTTP), existing `gitea/*`, `config/*`, `views/*`, `controllers/*`, `util/*`  
**Storage**: In-memory only for orchestration (RepoStateStore in `util/cache.ts`); SecretStorage for token (unchanged)  
**Testing**: Jest (ts-jest), `src/test/**/*.test.ts`, mock VS Code in `src/test/__mocks__/vscode.ts`  
**Target Platform**: VS Code–compatible editors (extension host)  
**Project Type**: VS Code extension (single package)  
**Performance Goals**: No regression; existing polling and lazy-loading behavior preserved  
**Constraints**: No behavior change; `npm run validate` must pass after each increment  
**Scale/Scope**: Existing codebase; refactor touches `extension.ts`, `controllers/*`, `views/actionsTreeProvider.ts`, `util/cache.ts`, and Jest config

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| **I. In-Editor Workflow Visibility** | Pass | Refactor does not change views, commands, or labels; only structure and test coverage. |
| **II. Secure, Minimal Gitea Access** | Pass | No change to token storage, scopes, or network calls. |
| **III. Reliability, Observability & Safe Failure** | Pass | Extracted refresh/tree helpers must preserve existing error handling and logging; tests will verify. |
| **IV. Performance & Responsiveness** | Pass | No new polling or lazy-loading behavior; refactor must not regress performance. |
| **V. Specification-Driven, Testable Delivery** | Pass | This plan implements the spec (SpecKit flow); tasks will map to user stories and FRs. |
| **Additional Constraints** | Pass | TypeScript strict, existing config keys unchanged; no new user-facing strings without doc. |
| **Development Workflow / Quality Gates** | Pass | Plan references spec; PRs will reference spec/plan/tasks and include tests. |

No violations. Complexity Tracking table omitted.

**Post–Phase 1**: Re-checked after data-model and contracts; all gates still pass. No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/007-refactor-orchestration-test-coverage/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── checklists/
│   └── requirements.md
├── contracts/           # Phase 1
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── extension.ts              # Entry point; reduce via bootstrap helpers
├── config/
│   ├── settings.ts
│   └── secrets.ts
├── gitea/
│   ├── api.ts
│   ├── client.ts
│   ├── discovery.ts
│   ├── models.ts
│   ├── remotes.ts
│   └── swagger.ts
├── controllers/
│   ├── commands.ts           # Split into focused units (see research.md)
│   ├── refreshController.ts  # Extract helpers; keep thin orchestration
│   └── reviewCommentsController.ts
├── views/
│   ├── actionsTreeProvider.ts # Extract tree builders/helpers
│   ├── icons.ts
│   ├── nodes.ts
│   └── settingsTreeProvider.ts
├── util/
│   ├── cache.ts              # Increase test coverage
│   ├── branchContext.ts
│   ├── repoResolution.ts
│   ├── git.ts
│   ├── expandedState.ts
│   ├── limiter.ts
│   ├── logging.ts
│   ├── time.ts
│   └── artifactDownload.ts
└── test/
    ├── __mocks__/
    │   └── vscode.ts
    └── **/*.test.ts
```

**Structure Decision**: Single-project VS Code extension. Refactor adds no new top-level directories; new modules live under `controllers/` (e.g. command units), `views/` (tree helpers), or `util/` (refresh helpers), or alongside `extension.ts` (bootstrap helpers). Test files remain in `src/test/` with existing naming and mock setup.
