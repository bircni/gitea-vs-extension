# Contract: Tree builder (actions tree)

**Branch**: `007-refactor-orchestration-test-coverage`  
**Consumers**: `views/actionsTreeProvider.ts`, tests for tree structure

## Scope

The actions tree (Current Branch Runs, Workflows) shows repos, runs, and jobs with branching and filtering logic. This contract describes the interface between the tree provider and the extracted builder/helper layer: inputs (store + filter context) and outputs (structure suitable for `TreeItem` or existing node types).

## Input contract

The tree builder receives:
- **Store (or relevant entry)**: Per-repo state: runs, jobs, branch context, filter state. May be the full store or a single entry for “get children of this repo.”
- **Filter context**: Which branch filter is active (current branch, all branches, or specific branch name).
- **Root vs repo**: Whether we are building the root level (list of repos or a single “no repos” / “loading” message) or the children of a specific repo (runs, then jobs under each run).
- **Expanded state** (optional): If the provider needs to know which nodes are expanded for lazy loading, it can be passed in.

All inputs MUST be plain data (no VS Code types required); the builder MUST NOT depend on `vscode` for its core logic so that it can be unit-tested with mock data.

## Output contract

- **Root level**: Either a list of repo nodes (each identifiable and capable of being wrapped as `TreeItem`), or a single “message” node (e.g. loading, no repos, error). Order of repos is defined (e.g. workspace order or stable sort).
- **Repo level**: Either a list of run nodes (or message node if loading/empty/error), ordered and grouped as today (e.g. by branch, then by run). Each run may have children (jobs) when expanded; the builder may return run nodes with child data or a placeholder that the provider resolves on expand.
- **Labels and icons**: Each node has a label and optionally an icon/description consistent with `views/icons.ts` and existing behavior (status, conclusion, branch name, etc.).

The provider wraps builder output in `TreeItem` (or `RepoNode`, `RunNode`, `JobNode` from `views/nodes.ts`) and returns them from `getChildren()`.

## States to support

- **Loading**: Root or repo shows a loading message/label.
- **Empty**: No repos, or no runs for this repo/filter.
- **Filtered**: Only runs matching the branch filter; ordering and grouping preserved.
- **Error**: Clear message or icon without sensitive data.

## Verification

- **Test-time**: Unit tests pass mock store entries and filter context, and assert on the shape and labels of the returned structure (e.g. number of nodes, first node label, presence of message node).
- **Runtime**: Manual verification that the tree matches current behavior for loading, empty, filtered, and error cases.
