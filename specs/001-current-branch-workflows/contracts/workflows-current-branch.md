# Contract: Current Branch Workflows View Behaviour

## Purpose

Define the observable behaviour of the workflows-related views when applying automatic “current branch” filtering, user-controlled overrides, and edge-state handling. This contract is expressed at the level of the VS Code UI and internal extension APIs, not the Gitea HTTP API.

## View Contract

### 1. Default Branch-Aware Filtering (User Story 1, P1)

- **Input**: User opens the workflows view for a repository where a current branch can be resolved.
- **Output**:
  - The view initially shows only workflow runs whose branch matches the resolved current branch.
  - The active branch filter (for example, `current: feature/x`) is clearly indicated in the view’s UI.
  - No additional configuration is required for this behaviour to apply.

### 2. User-Controlled Overrides (User Story 2, P2)

- **Input**: While the view is filtered to the current branch, the user selects a different branch or an “all branches” option.
- **Output**:
  - The view updates to show runs for the chosen branch or all branches.
  - The active filter state is clearly reflected in the UI (for example, `all branches` or `branch: main`).
  - The user can select an explicit control to return to “current branch only”, which restores filtering to the resolved branch and updates the indicator.

### 3. Edge-State Behaviour (User Story 3, P3)

- **Input**: The current branch cannot be determined (no repo, detached HEAD, ambiguous workspace mapping) or the current branch has no runs.
- **Output**:
  - The view does **not** fail silently; instead, it shows:
    - Either a sensible default (such as “all branches”) or an explicit prompt to choose a branch.
    - A short explanation of why automatic current-branch filtering is not active or why there are no runs.
  - The user can still select branches or “all branches” and see runs where available.

## Internal Extension Expectations

- Branch context is resolved per repository, not globally, and is derived from the user’s active work context (local Git and repository selection).
- Filtering is performed on the set of runs already fetched and cached for the repository; the feature does not introduce new polling loops or additional Gitea scopes.
- Errors or unexpected states in branch resolution or filtering:
  - Are surfaced as user-facing messages in the view when they affect what the user sees.
  - Are logged via the existing logging utilities only when debug logging is enabled.

