# Data Model: Refactor core orchestration and test coverage

**Branch**: `007-refactor-orchestration-test-coverage`  
**Phase**: 1 (Design)

This feature is a structural refactor, not a new domain data model. The “entities” below are **design units** (modules, helpers, and state shapes) that the refactor introduces or clarifies. Validation rules and state transitions are derived from the spec and existing behavior.

---

## 1. Command unit

**Description**: A coherent set of command handlers with a single responsibility, exposed to the extension registration layer.

**Attributes**:
- **Scope**: One of artifact actions, log actions, secrets/variables actions, browser/clipboard actions, or the registration map.
- **Handlers**: Functions that take (context, …args) and perform one category of work; they may call VS Code APIs, Gitea API, or file I/O.
- **Registration**: Command IDs and handler references; the registration map is the single place that binds IDs to handlers.

**Relationships**:
- Command units are invoked by the VS Code command system; the registration layer in the commands area wires `vscode.commands.registerCommand` to the correct unit.
- Each unit may depend on `util/cache`, `config/settings`, `gitea/api`, or other shared modules.

**Validation**:
- Every contributed command ID in `package.json` must have exactly one handler registered.
- Handlers that operate on a tree item or repo context must receive that context as the first argument (per AGENTS.md).

**State**: Stateless; units are registered at activation and invoked on user or tree actions.

---

## 2. Refresh helper

**Description**: A pure or mostly pure function (or small module) that computes branch context, refresh state transitions, or refresh summaries from given inputs.

**Attributes**:
- **Inputs**: Store entry (or subset), branch info, API responses (runs/jobs), previous state.
- **Outputs**: New branch context, new refresh state (e.g. loading/idle/error), run-detail load state, or a summary string/label for status bar or tree.

**Relationships**:
- Used by `refreshController.ts`; the controller performs discovery, API calls, and store updates, then calls helpers to compute derived state and summary.
- Helpers do not call Gitea API or VS Code APIs; they only transform data.

**Validation**:
- Helpers must be deterministic for the same inputs (no hidden global state).
- Error inputs (e.g. failed API response) must produce defined error state or summary, not throw unhandled.

**State transitions** (conceptual):
- Branch context: (repo, branch name, last known ref) → updated context after refresh.
- Refresh state: (current state, loading result) → next state (e.g. idle, loading, error).
- Summary: (runs, jobs, errors) → human-readable summary string.

---

## 3. Tree builder / helper

**Description**: A function or small module that, given store state and filter context, produces tree structure (nodes, labels, ordering) for the actions tree views.

**Attributes**:
- **Inputs**: Store (or per-repo entry), branch filter state, expanded state (if needed), workspace folder mapping.
- **Outputs**: Root-level message or list of repo nodes; for each repo, list of child nodes (runs/jobs grouped and ordered); labels and icons for each node.

**Relationships**:
- Used by `actionsTreeProvider.ts`; the provider implements `getChildren` and delegates to helpers for “what to show” so that tree logic is testable without the provider’s VS Code TreeDataProvider interface.
- Helpers return data that the provider wraps in `TreeItem` (or existing node classes in `views/nodes.ts`).

**Validation**:
- For loading state: root or repo shows loading message/label.
- For empty state: root or repo shows no-repos or no-runs message as today.
- For filtered state: only runs matching branch filter are included; ordering and grouping match current behavior.
- For error state: appropriate message or icon without leaking sensitive data.

**State**: Stateless pure functions; state lives in store and filter context passed in.

---

## 4. Bootstrap helper

**Description**: A function or small module that performs one part of extension activation (e.g. tree registration, expand/collapse persistence, selection-to-repo sync, refresh/status bar wiring).

**Attributes**:
- **Scope**: One of tree registration, expand/collapse persistence, selection-to-repo synchronization, refresh/status bar wiring.
- **Inputs**: Extension context, store, settings, or other services already constructed.
- **Side effects**: Registers trees, disposables, or wires event handlers; no return value that affects domain state.

**Relationships**:
- Called from `extension.ts` during activation; order may matter (e.g. store before trees, trees before refresh).
- Does not replace the need for a single activation entry point; it only decomposes the work into testable pieces.

**Validation**:
- Each helper must be idempotent for a single activation (calling it twice with same context must not double-register or leak listeners).
- Disposables must be added to the extension context’s subscriptions so deactivation cleans up.

**State**: No domain state; only registration and wiring.

---

## 5. Cache entry / repo state

**Description**: In-memory state per repository (runs, jobs, branch context, filter state, workspace folder mapping) used by refresh and tree logic.

**Attributes** (conceptual; actual shape in `util/cache.ts`):
- **Repo key**: Identifies the repository (e.g. RepoRef).
- **Runs**: List of workflow runs (with or without job details).
- **Branch context**: Current branch, last resolved ref.
- **Filter state**: Branch filter (current branch, all branches, or specific branch).
- **Workspace folder**: Mapping from repo to workspace folder when relevant.

**Relationships**:
- Updated by refresh controller (and helpers that compute new state); read by tree provider and command handlers.
- Cache behavior (getEntry, setEntry, getFilteredRuns, etc.) must remain covered by tests (spec FR-006, SC-003).

**Validation**:
- Entries must be keyed so that multi-repo workspaces have isolated state per repo.
- Filter state and runs must be consistent (e.g. filtered view shows subset of stored runs).

**State transitions**:
- Refresh adds/updates runs and jobs; helpers may compute which runs to show for current filter.
- Branch filter change updates filter state; next tree refresh uses new filter.
- No persistence across activation cycles except via VS Code APIs (e.g. expanded state in workspace state).

---

## Summary

| Entity            | Stateful? | Owner (after refactor)     | Test focus                    |
|-------------------|-----------|----------------------------|-------------------------------|
| Command unit      | No        | controllers/ (split)       | Handler + argument norm      |
| Refresh helper    | No        | util/ or controllers/      | Input → state/summary         |
| Tree builder      | No        | views/ or util/            | Store + filter → structure   |
| Bootstrap helper  | No        | extension.ts or util/      | Registration / wiring        |
| Cache entry       | Yes       | util/cache.ts              | State transitions, getters    |
