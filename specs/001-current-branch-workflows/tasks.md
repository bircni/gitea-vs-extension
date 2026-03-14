# Tasks: Current Branch Workflows

**Input**: Design documents from `/specs/001-current-branch-workflows/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: This feature will be validated primarily via manual flows from `quickstart.md`, plus Jest unit tests where they add clear value (branch resolution, view filtering, and edge-state handling).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- All descriptions below include exact file paths where applicable.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure the project is ready to evolve the workflows UI and supporting utilities without structural changes.

- [x] T001 Verify existing extension build and tests pass using `npm test && npm run lint` at repo root
- [x] T002 [P] Review current workflows-related views in `src/views/actionsTreeProvider.ts` and `src/views/nodes.ts` to identify insertion points for branch-aware behaviour
- [x] T003 [P] Review Git and repository utilities in `src/util/git.ts` and `src/util/repoResolution.ts` to understand how local branches and repository mapping are currently resolved

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Define `BranchContext`, `BranchFilterState`, and `WorkflowViewState` TypeScript interfaces in `src/util/cache.ts` or a new dedicated module if more appropriate, keeping them aligned with `data-model.md`
- [x] T005 [P] Implement a helper in `src/util/git.ts` to resolve the current branch name for a given workspace folder/repository, returning a structured status (`resolved`, `unresolved`, `detached`, `noRepo`) as described in `data-model.md`
- [x] T006 [P] Extend repository state in `src/util/cache.ts` (or related state store) to track per-repository branch context and branch filter state without breaking existing consumers
- [x] T007 Wire branch context resolution into the existing refresh or discovery flow in `src/controllers/refreshController.ts` so that branch context is updated whenever repository data is refreshed
- [x] T008 Add debug-level logging for branch resolution and filter state transitions in `src/util/logging.ts`, ensuring logs are only emitted when `gitea-vs-extension.logging.debug` is enabled

**Checkpoint**: Foundation ready – per-repository branch context and filter state exist and can be inspected in memory and logs, but are not yet used to alter the UI.

---

## Phase 3: User Story 1 - See workflows for my current branch by default (Priority: P1) 🎯 MVP

**Goal**: When a current branch can be determined for a selected repository, the workflows view automatically shows only runs for that branch by default, with no extra configuration.

**Independent Test**: Open the workflows view while on a known branch with recent runs; verify that only workflows for that branch are shown by default and that no extra configuration is required.

### Implementation for User Story 1

- [x] T009 [P] [US1] Add branch-aware filtering logic in `src/views/actionsTreeProvider.ts` to compute `filteredRuns` from `entry.runs` based on the current repository’s `BranchFilterState` and `BranchContext`
- [x] T010 [P] [US1] Update `RepoNode` and/or `WorkflowGroupNode` rendering in `src/views/nodes.ts` so that the current branch filter state (for example, `current: feature/x`) is available for descriptions or tooltips
- [x] T011 [US1] Ensure `getRepoChildren` in `src/views/actionsTreeProvider.ts` uses the filtered runs list when constructing `RunNode` instances, so that the initial view only shows runs for the current branch when `BranchContext.status === "resolved"`
- [x] T012 [US1] Implement a clear empty-state message in `src/views/actionsTreeProvider.ts` when the current branch is resolved but has no runs, explaining that there are no runs for this branch and suggesting viewing other branches
- [x] T013 [US1] Add or update Jest tests in `src/test` (for example, a new `src/test/actionsTreeProvider.currentBranch.test.ts`) to verify that, given a resolved branch context and populated runs list, only runs matching the branch are exposed to the view

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently via the quickstart’s Scenario 1.

---

## Phase 4: User Story 2 - Override and control branch filtering (Priority: P2)

**Goal**: Users can change the branch filter away from the current branch (to a specific branch or “all branches”), see the view update accordingly, and easily return to “current branch only”.

**Independent Test**: Start from a view filtered to the current branch, change the branch filter to another branch or to “all branches”, then switch it back so that the view again matches the current branch context.

### Implementation for User Story 2

- [x] T014 [P] [US2] Introduce a branch filter control in the workflows view UI (for example, via a command and context menu or toolbar contribution handled in `src/controllers/commands.ts`) that can set the filter mode and optional branch name for a repository
- [x] T015 [P] [US2] Persist and expose per-repository `BranchFilterState` updates in `src/util/cache.ts` so that changes made via the filter control are reflected in the tree provider
- [x] T016 [US2] Update `ActionsTreeProvider` in `src/views/actionsTreeProvider.ts` to react to filter changes (for example, via events or store notifications) and refresh the affected repository node
- [x] T017 [US2] Ensure the workflows view clearly indicates the active filter state (for example, `all branches` or `branch: main`) in `src/views/nodes.ts`, distinct from the “current branch” indicator
- [x] T018 [US2] Add or update Jest tests in `src/test` to cover transitions between `currentBranch`, `allBranches`, and `specificBranch` modes, verifying that the correct runs are returned for each mode

**Checkpoint**: At this point, User Stories 1 and 2 should both work independently, and users can move between current-branch-only and overridden filters.

---

## Phase 5: User Story 3 - Sensible behaviour for edge situations (Priority: P3)

**Goal**: When there is no clear current branch or when the current branch has no runs, the workflows view behaves predictably, explains the situation, and still allows users to inspect other branches or all branches.

**Independent Test**: Open the workflows view when no branch can be determined; confirm that the feature explains the situation and still allows choosing a branch or “all branches”.

### Implementation for User Story 3

- [x] T019 [P] [US3] Extend branch resolution helper in `src/util/git.ts` and its consumers to explicitly represent `unresolved`, `detached`, and `noRepo` states with human-readable reasons, as described in `data-model.md`
- [x] T020 [US3] Update `ActionsTreeProvider` in `src/views/actionsTreeProvider.ts` to detect non-`resolved` branch contexts and show clear messages or prompts (for example, “Automatic current-branch filtering is unavailable; showing all branches”) instead of silently falling back
- [x] T021 [US3] Ensure the empty-state handling for “current branch has no runs” in `src/views/actionsTreeProvider.ts` offers an obvious action or guidance to switch to another branch or “all branches”
- [x] T022 [P] [US3] Add Jest tests in `src/test` to cover unresolved and detached branch states, verifying that the tree returns the expected message nodes and does not throw or hide all data

**Checkpoint**: All three user stories should now be independently functional and behave predictably across edge situations, matching `quickstart.md` Scenarios 3–5.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and ensure the feature is production-ready.

- [x] T023 [P] Review and update user-facing messages in `src/views/actionsTreeProvider.ts` and `src/views/nodes.ts` for clarity, consistency, and alignment with the constitution's guidance on error messaging
- [x] T024 [P] Add or refine unit tests in existing `src/test/*.test.ts` files (or new ones) to increase coverage for branch-aware behaviour without duplicating scenarios already covered
- [x] T025 Update `README.md` to briefly describe the current-branch workflows behaviour, including how automatic filtering works and how users can override it, referencing relevant configuration if needed
- [ ] T026 Validate all quickstart scenarios in `specs/001-current-branch-workflows/quickstart.md` manually and adjust code or docs as needed based on findings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies – can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion – BLOCKS all user stories.
- **User Stories (Phases 3–5)**: All depend on Foundational phase completion.
  - User Story 1 (P1) should be implemented first as the MVP.
  - User Stories 2 (P2) and 3 (P3) can proceed after or in parallel with appropriate coordination.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) – no dependencies on other stories.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) – may interact with User Story 1 state but should remain independently testable via its own acceptance criteria.
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) – builds on the same branch context infrastructure and should be testable independently using its own edge scenarios.

### Within Each User Story

- Foundation tasks (T004–T008) MUST be complete before story-specific work.
- For each story:
  - Parallelizable tasks are marked with **[P]** and should avoid touching the same files concurrently.
  - Core logic (tree provider behaviour and state updates) should be implemented before extensive polish or documentation.
  - Story completion is determined by its acceptance scenarios and independent test description in `spec.md`.

### Parallel Opportunities

- Setup review tasks (T002, T003) can run in parallel with each other after T001.
- Foundational tasks T005 and T006 can be implemented in parallel, as can T008 once interfaces are defined in T004.
- Within User Story 1, T009 and T010 can proceed in parallel once foundational state is available.
- User Stories 2 and 3 can be developed in parallel by different contributors after Phase 2, provided they coordinate changes to shared files such as `src/views/actionsTreeProvider.ts`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003).
2. Complete Phase 2: Foundational (T004–T008).
3. Complete Phase 3: User Story 1 (T009–T013).
4. **STOP and VALIDATE**: Exercise quickstart Scenario 1 and confirm that the workflows view behaves as specified for the current branch.
5. If satisfactory, ship this as the initial MVP for the feature.

### Incremental Delivery

1. Deliver MVP (User Story 1) as above.
2. Implement User Story 2 (Phase 4), validate with quickstart Scenario 2, and optionally ship as an incremental improvement.
3. Implement User Story 3 (Phase 5), validate with quickstart Scenarios 3–5, and integrate into the main workflows experience.
4. Apply Phase 6 polish tasks to improve messaging, documentation, and test coverage.

