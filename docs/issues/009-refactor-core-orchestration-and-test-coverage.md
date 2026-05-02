# Refactor core orchestration and test coverage

**Labels:** `maintenance`, `testing`, `refactor`, `high priority`

## Summary

Refactor the extension's **command, refresh, and tree orchestration layers** to improve maintainability and add meaningful test coverage for the code that currently drives most behavior changes. The current coverage baseline is good for utilities and API normalization, but it excludes the highest-coupling UI/orchestration code.

## Background

- `npm run validate` currently passes.
- `npm run test:coverage` currently reports strong overall coverage, but `vitest.config.ts` excludes `src/extension.ts`, `src/controllers/**`, `src/views/**`, and `src/config/**` from coverage collection.
- The main maintainability hotspots by size and responsibility are:
  - `src/controllers/commands.ts`
  - `src/controllers/refreshController.ts`
  - `src/views/actionsTreeProvider.ts`
  - `src/extension.ts`
  - `src/controllers/reviewCommentsController.ts`
- `src/controllers/commands.ts` currently mixes command registration, VS Code prompts, file I/O, artifact actions, log viewing, browser actions, and secrets/variables CRUD in one class.
- `src/controllers/refreshController.ts` currently mixes polling, discovery, branch resolution, API calls, cache mutation, error handling, and summary generation.
- `src/views/actionsTreeProvider.ts` contains non-trivial tree decision logic and branch filtering behavior, but it has no direct tests.
- `src/test/reviewCommentsController.test.ts` currently only tests `buildDiffPositionMap`, not the controller behavior itself.
- `src/util/cache.ts` is under-covered relative to its importance in state management.
- Reference: `docs/ANALYSIS-2026.md` (§4.3 Testing and robustness, §4.4 Performance and UX) and `docs/issues/008-structural-codebase-improvements.md`.

## Acceptance criteria

- [ ] **Commands split into focused units**: Break `src/controllers/commands.ts` into smaller, coherent modules or services, for example:
  - command registration map
  - artifact actions
  - log actions
  - secrets/variables actions
  - browser/clipboard actions
- [ ] **Refresh logic extracted**: Move pure or mostly pure logic out of `src/controllers/refreshController.ts` into helpers that can be tested independently, including:
  - branch-context updates
  - repo refresh state transitions
  - run-detail load-state updates
  - refresh summary computation
- [ ] **Tree logic extracted and testable**: Move decision-heavy logic from `src/views/actionsTreeProvider.ts` into helper functions or builders that cover:
  - root-state messages
  - repo child state selection
  - branch-filtered run selection
  - workflow grouping and ordering
- [ ] **Activation wiring simplified**: Reduce orchestration complexity in `src/extension.ts` by extracting bootstrap helpers for:
  - tree registration
  - expand/collapse persistence
  - selection-to-repo synchronization
  - refresh/status bar wiring
- [ ] **Coverage includes orchestration code**: Update `vitest.config.ts` so controllers and views are included in coverage once the new seams are testable.
- [ ] **New tests added**: Add or expand tests for:
  - command handlers and argument normalization
  - refresh state transitions and error handling
  - tree-provider output for loading, empty, filtered, and error states
  - review comments controller behavior beyond diff-position mapping
  - `src/util/cache.ts` state behavior
- [ ] **No behavior regression**: Existing commands, branch filtering, run/job loading, settings interactions, and status bar behavior continue to work as before.

## Implementation notes

- Prefer extracting pure helpers first, then leaving thin VS Code-facing orchestration classes behind.
- Start with `src/views/actionsTreeProvider.ts`; it has high branching and relatively low editor API coupling.
- Refactor `src/controllers/refreshController.ts` next so state transitions and summary logic are easy to verify without full integration tests.
- Split `src/controllers/commands.ts` after those seams exist; this should reduce the amount of command-specific mocking required.
- Keep the refactor incremental. Multiple PRs are fine if each one leaves the repo in a passing state.
- Once controller/view tests exist, remove or narrow the current coverage exclusions in `vitest.config.ts`.

## Suggested PR breakdown

1. Extract and test tree-building helpers from `src/views/actionsTreeProvider.ts`.
2. Extract and test refresh/state-transition helpers from `src/controllers/refreshController.ts`.
3. Split `src/controllers/commands.ts` into focused command modules and add targeted tests.
4. Simplify `src/extension.ts` bootstrap wiring and add smoke tests for activation-level helpers.
5. Expand coverage configuration and tighten thresholds if appropriate after the new tests land.
