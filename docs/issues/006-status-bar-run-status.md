# Status bar: run status for current branch

**Labels:** `enhancement`, `actions`, `medium priority`

## Summary

Show a short **Gitea run status summary** in the VS Code status bar (e.g. "Gitea: 2 running, 1 failed" or "All passed"). Clicking the status bar item focuses the Gitea extension view. This aligns with GitLab's "CI status in status bar" and gives users a single place to see current-branch workflow status without opening the tree.

## Background

- GitLab for VS Code shows pipeline/job status in the sidebar and synced with status bar for current branch.
- This extension already has a status bar item (e.g. "Gitea: idle"); it is updated by `RefreshController` with running/failed counts (see `updateStatusBar` in `extension.ts`).
- Reference: `docs/ANALYSIS-2026.md` (§3 medium impact #7, §4.4 performance and UX).

## Acceptance criteria

- [ ] **Status bar text**: Display a concise summary of workflow run state for the current context (e.g. "Gitea: 2 running, 1 failed" or "Gitea: All passed" when no running/failed, or "Gitea: idle" when no data). Use existing `RefreshSummary` (runningCount, failedCount) or equivalent.
- [ ] **Click behavior**: Clicking the status bar item focuses the Gitea extension view (e.g. `workbench.view.extension.bircniGiteaVsExtension` or the runs view). Already wired via `statusBar.command` in current implementation; verify and document.
- [ ] **Scope**: Summary reflects repos/runs that are currently loaded (e.g. current branch runs for workspace repos). No requirement to show "current branch" explicitly in the label if the tree is already scoped; the status bar complements the tree.
- [ ] **Documentation**: README or in-product help mentions the status bar and what the counts mean.

## Implementation notes

- Review `extension.ts`: `statusBar` is already created and updated in `updateStatusBar(statusBar, summary)`. Confirm `RefreshSummary` includes `runningCount` and `failedCount` and that the label is clear (e.g. "Gitea: 2 running, 1 failed").
- Ensure `statusBar.command` points to the extension view so click focuses it.
- If the current implementation already meets the criteria, document it and close as done; otherwise add any missing wording or behavior.
