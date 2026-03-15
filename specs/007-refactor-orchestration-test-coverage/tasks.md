# Tasks: Refactor core orchestration and test coverage

**Input**: Design documents from `/specs/007-refactor-orchestration-test-coverage/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included per spec FR-006 and SC-003; each user story has test tasks before or alongside implementation.

**Organization**: Tasks grouped by user story. Implementation order follows spec priority (US1→US5). research.md recommends an alternative order (tree US3 → refresh US2 → commands US1) for reduced mocking; see Dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

- Source: `src/` at repository root (controllers/, views/, util/, config/)
- Tests: `src/test/**/*.test.ts`
- Config: `jest.config.ts`, `package.json` at root

---

## Phase 1: Setup (Shared infrastructure)

**Purpose**: Verify baseline and test harness for refactor

- [x] T001 Verify baseline: run `npm run validate` from repo root and ensure it passes; document current state
- [x] T002 Confirm test harness: ensure `src/test/__mocks__/vscode.ts` and Jest config in `jest.config.ts` are sufficient for helper unit tests per research.md

---

## Phase 2: Foundational (Blocking prerequisites)

**Purpose**: Shared prerequisites before any user story implementation

**⚠️ CRITICAL**: No user story work should begin until this phase is complete

- [x] T003 Record baseline coverage: run `npm run test:coverage`, note current exclusions in `jest.config.ts` (extension.ts, controllers/**, views/**, config/**) and any existing thresholds

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 – Commands split into focused units (Priority: P1) 🎯 MVP

**Goal**: Split `src/controllers/commands.ts` into focused units (registration map, artifact actions, log actions, secrets/variables actions, browser/clipboard actions) so each unit has a single responsibility and can be tested in isolation.

**Independent Test**: Run `npm run validate`; invoke each existing command (refresh, view logs, branch filter, open in browser, secrets/variables) and confirm same behavior; run new command-unit tests.

### Tests for User Story 1

- [x] T004 [P] [US1] Add unit tests for artifact command handler and argument normalization in `src/test/artifactCommands.test.ts` (or `src/test/commands/artifact.test.ts`)
- [x] T005 [P] [US1] Add unit tests for log actions handler and argument normalization in `src/test/logCommands.test.ts`
- [x] T006 [P] [US1] Add unit tests for secrets/variables command handlers and argument normalization in `src/test/secretsVariablesCommands.test.ts`
- [x] T007 [P] [US1] Add unit tests for browser/clipboard command handlers and argument normalization in `src/test/browserCommands.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Extract artifact actions into a focused module (e.g. `src/controllers/artifactCommands.ts` or `src/controllers/commands/artifact.ts`)
- [x] T009 [US1] Extract log actions into a focused module in `src/controllers/`
- [x] T010 [US1] Extract secrets/variables actions into a focused module in `src/controllers/`
- [x] T011 [US1] Extract browser/clipboard actions into a focused module in `src/controllers/`
- [x] T012 [US1] Create single command registration layer that wires all command IDs to handlers and ensure every `contributes.commands` entry in `package.json` has a handler in `src/controllers/commands.ts` (or new registration file)
- [x] T013 [US1] Refactor `src/controllers/commands.ts` to delegate to new units; ensure first-argument-as-context for tree-invoked commands per `contracts/commands.md`

**Checkpoint**: All commands behave as before; each unit has tests; `npm run validate` passes

---

## Phase 4: User Story 2 – Refresh logic extracted and testable (Priority: P2)

**Goal**: Extract pure or mostly pure logic from `src/controllers/refreshController.ts` into helpers (branch-context updates, repo refresh state transitions, run-detail load-state updates, refresh summary computation) and add unit tests for those helpers.

**Independent Test**: Unit tests pass for extracted helpers with mock inputs; extension polling and discovery unchanged; `npm run validate` passes.

### Tests for User Story 2

- [x] T014 [P] [US2] Add unit tests for branch-context update helper (inputs → new context) in `src/test/refreshHelpers.test.ts` or `src/test/refreshState.test.ts`
- [x] T015 [P] [US2] Add unit tests for repo refresh state transitions (e.g. loading/idle/error) in `src/test/refreshState.test.ts`
- [x] T016 [P] [US2] Add unit tests for refresh summary computation in `src/test/refreshSummary.test.ts`

### Implementation for User Story 2

- [x] T017 [US2] Extract branch-context update logic into a pure helper (e.g. `src/util/refreshHelpers.ts` or under `src/controllers/`)
- [x] T018 [US2] Extract repo refresh state transition logic into a helper in `src/util/` or `src/controllers/`
- [x] T019 [US2] Extract run-detail load-state update logic into a helper
- [x] T020 [US2] Extract refresh summary computation into a helper
- [x] T021 [US2] Refactor `src/controllers/refreshController.ts` to call extracted helpers; preserve existing behavior and error handling

**Checkpoint**: Refresh controller is thin orchestration; helpers are unit-tested; `npm run validate` passes

---

## Phase 5: User Story 3 – Tree logic extracted and testable (Priority: P3)

**Goal**: Extract decision-heavy logic from `src/views/actionsTreeProvider.ts` into helper functions or builders (root-state messages, repo child state selection, branch-filtered run selection, workflow grouping/ordering) and add unit tests with mock store data.

**Independent Test**: Unit tests pass for tree helpers with mock store and filter context; Current Branch Runs and Workflows views display and filter as before; `npm run validate` passes.

### Tests for User Story 3

- [x] T022 [P] [US3] Add unit tests for root-state message helper (loading, empty, error) in `src/test/actionsTreeHelpers.test.ts`
- [x] T023 [P] [US3] Add unit tests for repo child state selection and branch-filtered run selection in `src/test/actionsTreeHelpers.test.ts`
- [x] T024 [P] [US3] Add unit tests for workflow grouping and ordering in `src/test/actionsTreeHelpers.test.ts`

### Implementation for User Story 3

- [x] T025 [US3] Extract root-state message logic (what to show at root: loading, no repos, error) into a helper in `src/views/` or `src/util/` per `contracts/tree-builder.md`
- [x] T026 [US3] Extract repo child state selection and branch-filtered run selection into a helper
- [x] T027 [US3] Extract workflow grouping and ordering into a helper
- [x] T028 [US3] Refactor `src/views/actionsTreeProvider.ts` to use extracted helpers; preserve behavior and wrap helper output in existing node types from `src/views/nodes.ts`

**Checkpoint**: Tree provider is thin; helpers are unit-tested; `npm run validate` passes

---

## Phase 6: User Story 4 – Activation wiring simplified (Priority: P4)

**Goal**: Reduce orchestration in `src/extension.ts` by extracting bootstrap helpers (tree registration, expand/collapse persistence, selection-to-repo synchronization, refresh/status bar wiring) and add smoke tests where feasible.

**Independent Test**: Extension activates; all views, commands, and status bar behave as before; smoke tests for bootstrap helpers pass; `npm run validate` passes.

### Tests for User Story 4

- [x] T029 [US4] Add smoke or unit tests for bootstrap helpers (tree registration, persistence, refresh/status bar wiring) in `src/test/extension.test.ts` or `src/test/bootstrap.test.ts`

### Implementation for User Story 4

- [x] T030 [US4] Extract tree registration into a bootstrap helper (e.g. called from `src/extension.ts` or in `src/util/bootstrap.ts`)
- [x] T031 [US4] Extract expand/collapse persistence wiring into a bootstrap helper
- [x] T032 [US4] Extract selection-to-repo synchronization into a bootstrap helper
- [x] T033 [US4] Extract refresh/status bar wiring into a bootstrap helper
- [x] T034 [US4] Refactor `src/extension.ts` to call bootstrap helpers; preserve activation and disposable cleanup

**Checkpoint**: Activation is easier to follow; `npm run validate` passes

---

## Phase 7: User Story 5 – Coverage includes orchestration and new tests (Priority: P5)

**Goal**: Update `jest.config.ts` so controllers and views are included in coverage; add or expand tests for review comments controller and cache state; ensure thresholds are met.

**Independent Test**: `npm run test:coverage` includes controllers and views (or narrowed exclusions); tests exist for command handlers, refresh state, tree output, review comments controller behavior beyond diff-position map, and cache state; `npm run validate` passes.

### Implementation for User Story 5

- [x] T035 [US5] Update `jest.config.ts`: narrow or remove `collectCoverageFrom` exclusions for `src/controllers/**` and `src/views/**` (and optionally `src/extension.ts` / `src/config/**` where covered)
- [x] T036 [P] [US5] Add or expand tests for review comments controller behavior beyond `buildDiffPositionMap` in `src/test/reviewCommentsController.test.ts`
- [x] T037 [US5] Add or expand tests for cache state behavior in `src/test/cache.test.ts`
- [x] T038 [US5] Run `npm run test:coverage`; adjust coverage thresholds if needed so build passes; ensure all new tests are included

**Checkpoint**: Coverage includes orchestration code; SC-003 satisfied; `npm run validate` passes

---

## Phase 8: Polish & cross-cutting (No behavior regression – US6)

**Purpose**: Final validation and documentation; verify FR-007 and SC-004

- [x] T039 Run full `npm run validate` from repo root and fix any remaining issues
- [ ] T040 Manual verification: exercise branch filter, view runs/jobs, open logs, manage secrets/variables, use settings, check status bar; confirm outcomes match pre-refactor behavior
- [x] T041 [P] Update documentation: ensure `specs/007-refactor-orchestration-test-coverage/quickstart.md` and any README references are accurate; PR references spec/plan/tasks

---

## Dependencies & execution order

### Phase dependencies

- **Phase 1–2**: No dependencies; start immediately.
- **Phase 3 (US1)**: Depends on Phase 2 completion.
- **Phase 4 (US2)**: Depends on Phase 2; independent of US1 (can parallelize if desired).
- **Phase 5 (US3)**: Depends on Phase 2; independent of US1/US2.
- **Phase 6 (US4)**: Depends on Phase 2; may reference refactored controllers/views.
- **Phase 7 (US5)**: Depends on Phases 3–6 so new tests and coverage config apply to refactored code.
- **Phase 8**: Depends on Phase 7.

### Alternative order (research.md)

research.md recommends implementing **tree (US3) → refresh (US2) → commands (US1)** to minimize command-specific mocking. Teams can run phases in that order (Phase 5 before Phase 4 and Phase 3) while keeping task IDs and story labels unchanged.

### Within each user story

- Test tasks marked [P] can run in parallel; run tests before or alongside implementation so they pass after implementation.
- Implementation tasks within a story are ordered (extract helpers then refactor caller).

### Parallel opportunities

- T004–T007 (US1 tests) can run in parallel.
- T008–T011 (US1 extract modules) can run in parallel after tests are written.
- T014–T016 (US2 tests), T017–T020 (US2 helpers) where no dependency.
- T022–T024 (US3 tests), T025–T027 (US3 helpers) where no dependency.
- T036 (review comments tests) is [P] with other US5 work.
- Different user stories (e.g. US2 and US3) can be worked in parallel by different developers after Phase 2.

---

## Parallel example: User Story 1

```text
# Tests in parallel:
T004 artifactCommands.test.ts
T005 logCommands.test.ts
T006 secretsVariablesCommands.test.ts
T007 browserCommands.test.ts

# After registration layer exists, extract in parallel:
T008 artifact module
T009 log module
T010 secrets/variables module
T011 browser/clipboard module
```

---

## Implementation strategy

### MVP first (User Story 1)

1. Complete Phase 1–2.
2. Complete Phase 3 (US1): tests then extract command units and registration.
3. Run `npm run validate` and manual command checks.
4. Stop and validate; optionally open PR for commands split.

### Incremental delivery

1. Phase 1–2 → foundation.
2. Phase 3 (US1) → validate → PR (commands split).
3. Phase 4 (US2) → validate → PR (refresh helpers).
4. Phase 5 (US3) → validate → PR (tree helpers).
5. Phase 6 (US4) → validate → PR (bootstrap).
6. Phase 7 (US5) → validate → PR (coverage).
7. Phase 8 → final validation and doc.

### Parallel team strategy

After Phase 2: one developer on US1, another on US2, another on US3; then US4 and US5 sequentially or assigned as capacity allows.

---

## Notes

- [P] = different files, no dependencies on other tasks in same phase.
- [USn] maps task to user story for traceability to spec.md.
- Each user story is independently testable; run `npm run validate` after each phase.
- Commit after each task or logical group; PR per story is acceptable per spec.
- File paths use existing layout: `src/controllers/`, `src/views/`, `src/util/`, `src/test/`.
