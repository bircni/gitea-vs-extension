# Feature Specification: Refactor core orchestration and test coverage

**Feature Branch**: `007-refactor-orchestration-test-coverage`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: User description: "Refactor core orchestration and test coverage" (from docs/issues/009-refactor-core-orchestration-and-test-coverage.md)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Commands split into focused units (Priority: P1)

As a maintainer, I need the single large commands module broken into smaller, coherent units (e.g. command registration, artifact actions, log actions, secrets/variables actions, browser/clipboard actions) so I can change one area without risking regressions in unrelated behavior and so each unit can be tested in isolation.

**Why this priority**: The commands module is a main hotspot mixing many responsibilities; splitting it first reduces coupling and enables targeted tests.

**Independent Test**: Can be fully tested by running the full validation suite and by verifying that each new command unit has at least one test covering handler and argument normalization.

**Acceptance Scenarios**:

1. **Given** the extension is installed, **When** a user invokes any existing command (refresh, view logs, branch filter, open in browser, secrets/variables), **Then** the same behavior and outcomes occur as before the split.
2. **Given** a command unit (e.g. artifact actions), **When** tests run for that unit, **Then** they pass and cover handler behavior and argument normalization without requiring full integration.

---

### User Story 2 - Refresh logic extracted and testable (Priority: P2)

As a maintainer, I need pure or mostly pure logic from the refresh controller moved into helpers (branch-context updates, repo refresh state transitions, run-detail load-state updates, refresh summary computation) so state transitions and summary logic can be verified by tests without running the full editor.

**Why this priority**: Refresh logic drives run/job loading and cache updates; extracting it makes behavior predictable and testable.

**Independent Test**: Can be fully tested by unit tests that feed inputs to the extracted helpers and assert on state transitions and summary output.

**Acceptance Scenarios**:

1. **Given** extracted helpers for branch-context updates and refresh state transitions, **When** tests supply known inputs, **Then** outputs match expected state and summary values.
2. **Given** the extension is running, **When** polling and discovery run as before, **Then** behavior and visible results are unchanged from before the extraction.

---

### User Story 3 - Tree logic extracted and testable (Priority: P3)

As a maintainer, I need decision-heavy logic from the actions tree provider moved into helper functions or builders (root-state messages, repo child state selection, branch-filtered run selection, workflow grouping and ordering) so tree structure and filtering can be tested without the full tree UI.

**Why this priority**: Tree provider has high branching and affects what users see; extracting logic improves coverage and maintainability.

**Independent Test**: Can be fully tested by unit tests that call the helpers with mock store data and assert on tree structure, messages, and ordering.

**Acceptance Scenarios**:

1. **Given** extracted tree-building helpers, **When** tests supply loading, empty, filtered, and error states, **Then** the resulting structure and labels match expectations.
2. **Given** the extension is running, **When** the user opens the Current Branch Runs or Workflows view, **Then** the tree displays and filters as before the extraction.

---

### User Story 4 - Activation wiring simplified (Priority: P4)

As a maintainer, I need orchestration in the extension entry point reduced by extracting bootstrap helpers (tree registration, expand/collapse persistence, selection-to-repo synchronization, refresh/status bar wiring) so activation is easier to reason about and can be smoke-tested.

**Why this priority**: Simplifying the entry point reduces cognitive load and allows activation-level tests.

**Independent Test**: Can be fully tested by running the extension and by smoke tests that exercise activation-level helpers where feasible.

**Acceptance Scenarios**:

1. **Given** the extension is activated, **When** bootstrap runs, **Then** all views, commands, and status bar behave as before.
2. **Given** extracted bootstrap helpers, **When** smoke tests run, **Then** they pass and cover registration and wiring without full UI.

---

### User Story 5 - Coverage includes orchestration and new tests added (Priority: P5)

As a maintainer, I need the test coverage configuration updated so that controllers and views are included in coverage once the new seams exist, and I need new or expanded tests for command handlers, refresh state transitions, tree-provider output, review comments controller behavior, and cache state.

**Why this priority**: Delivering measurable coverage of the refactored code ensures the refactor improves robustness.

**Independent Test**: Can be fully tested by running the coverage report and confirming that orchestration code is included and that new tests exist for the listed areas.

**Acceptance Scenarios**:

1. **Given** the refactor is complete, **When** coverage is collected, **Then** controllers and views are no longer excluded (or exclusions are narrowed) and thresholds are met.
2. **Given** the test suite, **When** run, **Then** it includes tests for command handlers and argument normalization, refresh state and error handling, tree-provider loading/empty/filtered/error states, review comments controller behavior beyond diff-position mapping, and cache state behavior.

---

### User Story 6 - No behavior regression (Priority: P1)

As a user of the extension, I need all existing commands, branch filtering, run/job loading, settings interactions, and status bar behavior to continue to work exactly as before the refactor.

**Why this priority**: Refactoring must not change observable behavior; this is a cross-cutting requirement.

**Independent Test**: Can be fully tested by running the full validation suite and manual checks of main workflows.

**Acceptance Scenarios**:

1. **Given** the refactored codebase, **When** the full validation suite runs, **Then** it passes.
2. **Given** a workspace with Gitea remotes, **When** a user uses branch filter, views runs/jobs, opens logs, manages secrets/variables, and uses settings, **Then** outcomes match the pre-refactor behavior.

---

### Edge Cases

- When the API is unavailable or returns errors during refresh, the system continues to handle errors and update state (or show messages) in the same way as before; extracted refresh helpers do not introduce new failure modes.
- When the workspace has no repos or no matching branch, tree and refresh helpers produce the same empty or message states as before.
- When coverage exclusions are removed, existing tests still pass and new tests are in place so that coverage does not drop below acceptable levels during the transition.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST split the single commands module into focused units (e.g. command registration map, artifact actions, log actions, secrets/variables actions, browser/clipboard actions) so that each unit has a single, clear responsibility.
- **FR-002**: The product MUST extract from the refresh controller pure or mostly pure logic for branch-context updates, repo refresh state transitions, run-detail load-state updates, and refresh summary computation into testable helpers.
- **FR-003**: The product MUST extract from the actions tree provider decision-heavy logic for root-state messages, repo child state selection, branch-filtered run selection, and workflow grouping/ordering into helper functions or builders that can be tested without the full tree UI.
- **FR-004**: The product MUST reduce orchestration complexity in the extension entry point by extracting bootstrap helpers for tree registration, expand/collapse persistence, selection-to-repo synchronization, and refresh/status bar wiring.
- **FR-005**: The product MUST update the test coverage configuration so that controllers and views are included in coverage once the new seams are testable (and MUST remove or narrow current exclusions accordingly).
- **FR-006**: The product MUST add or expand tests for: command handlers and argument normalization; refresh state transitions and error handling; tree-provider output for loading, empty, filtered, and error states; review comments controller behavior beyond diff-position mapping; and cache state behavior.
- **FR-007**: The product MUST preserve existing behavior: all existing commands, branch filtering, run/job loading, settings interactions, and status bar behavior MUST continue to work as before the refactor.

### Key Entities

- **Command unit**: A coherent set of command handlers (e.g. artifact actions, log actions) with a single responsibility, exposed to the extension registration layer.
- **Refresh helper**: A pure or mostly pure function or small module that computes branch context, refresh state transitions, or refresh summaries from given inputs.
- **Tree builder / helper**: A function or small module that, given store state and filter context, produces tree structure (nodes, labels, ordering) for the actions tree views.
- **Bootstrap helper**: A function or small module that performs one part of extension activation (e.g. tree registration, persistence wiring) so the entry point delegates instead of inlining logic.
- **Cache entry / repo state**: In-memory state per repository (runs, jobs, branch context, filter state) used by refresh and tree logic; behavior of this state MUST remain covered by tests.

## Assumptions

- The existing validation suite and manual workflows are sufficient to define “no behavior regression”; no new formal contract or snapshot testing is required unless the team chooses to add it.
- Refactor can be delivered in multiple increments (e.g. one PR per area) as long as each increment leaves the repository in a passing state.
- Coverage thresholds may be adjusted after new tests land; the requirement is that orchestration code is included in coverage and that new tests exist for the listed areas, not that a specific percentage is mandated in this spec.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Full validation suite (check-unused, lint, format, test, build) passes after the refactor is complete.
- **SC-002**: Test coverage collection includes the refactored controllers and views (or the previously excluded paths are covered by the new seams and tests).
- **SC-003**: At least one test exists for each of: command handler/argument normalization, refresh state transitions or error handling, tree-provider output for at least two of loading/empty/filtered/error states, review comments controller behavior beyond diff-position mapping, and cache state behavior.
- **SC-004**: No regression in user-visible behavior: existing commands, branch filtering, run/job loading, settings, and status bar work as before when exercised manually or via existing tests.
