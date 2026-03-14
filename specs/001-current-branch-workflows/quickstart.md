# Quickstart: Current Branch Workflows

This quickstart describes how to manually exercise the **Current Branch Workflows** feature end to end using a Gitea instance and the Gitea VS Extension.

## Prerequisites

- Gitea instance available and reachable from the editor.
- Gitea VS Extension installed and configured with:
  - `gitea-vs-extension.baseUrl` set to the Gitea instance URL.
  - A valid access token stored via the `gitea-vs-extension: Set Token` command.
- At least one repository with workflows configured and workflow runs on:
  - The `main` branch.
  - At least one feature branch (for example, `feature/x`).

## Scenario 1 – Default current-branch filtering (User Story 1, P1)

1. In your editor, check out `feature/x` in the repository.
2. Ensure there is at least one successful workflow run for `feature/x` in Gitea.
3. Open the **Gitea VS Extension** activity bar view.
4. In the **Workflows** / **Workflow Runs** view, select the target repository node if needed.
5. Observe the list of runs:
   - The initial list shows only runs for `feature/x`.
   - The UI clearly indicates that the filter is set to the current branch (for example, `current: feature/x`).

## Scenario 2 – Override and restore branch filtering (User Story 2, P2)

1. Starting from Scenario 1’s state (filtered to `feature/x`):
2. Use the workflows view’s filter control to:
   - Switch to a different branch (for example, `main`), or
   - Select an “all branches” option.
3. Confirm that:
   - The list of runs updates to match the chosen filter.
   - The filter indicator changes to reflect the new state (for example, `branch: main` or `all branches`).
4. Use the control to return to “current branch only”.
5. Confirm that:
   - The list of runs shows only runs for `feature/x` again.
   - The indicator reflects the current-branch filter state.

## Scenario 3 – No resolvable current branch (User Story 3, P3)

1. Open the editor without any workspace folders that map to a discovered Gitea repository **or** put the repository into a detached HEAD state.
2. Open the **Workflows** view for the extension.
3. Confirm that:
   - The view does **not** silently fail.
   - You either see a sensible default (for example, `all branches`) or a prompt explaining that automatic current-branch filtering is unavailable.
   - The prompt suggests selecting a branch or viewing all branches.

## Scenario 4 – Current branch with no runs (User Story 3, P3)

1. Create or check out a branch that has no workflow runs yet (for example, `feature/empty-branch`).
2. Ensure the repository is selected in the **Workflows** view.
3. Confirm that:
   - The view shows an empty-state message explaining that there are no runs for the current branch.
   - The message suggests switching to another branch or “all branches” to see existing runs.

## Scenario 5 – Multi-repository workspace sanity check

1. Open a workspace with two or more repositories connected to the same Gitea instance.
2. For each repository:
   - Check out different branches locally.
   - Select the repository node in the **Workflows** view.
3. Confirm that:
   - The “current branch” is resolved per repository, not globally.
   - The initial filter and visible runs match the branch you have checked out for that repository.

