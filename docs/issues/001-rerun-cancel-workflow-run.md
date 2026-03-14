# Re-run and cancel workflow run

**Labels:** `enhancement`, `actions`, `high priority`

## Summary

Add context menu actions on workflow run nodes to **Re-run** and **Cancel** a run, using the Gitea repo-level Actions API. This brings parity with GitHub/GitLab extensions and the Gitea web UI.

## Background

- Gitea 1.25.x web UI supports re-run and cancel; 1.25.1 fixed a rerun bug ([go-gitea/gitea#35780](https://github.com/go-gitea/gitea/issues/35780)).
- Repo-level API includes "Delete a workflow run" and likely rerun/cancel endpoints; exact paths to be confirmed in [Gitea API 1.25](https://docs.gitea.com/api/1.25/).
- Reference: `docs/ANALYSIS-2026.md` (§3 high impact #1, §5 MVP order).

## Acceptance criteria

- [ ] **Re-run**: Context menu "Re-run" on a run node (Current Branch Runs / Workflows). Calls Gitea API to re-run the workflow; on success, refresh the tree and show feedback (e.g. info message or status bar).
- [ ] **Cancel**: Context menu "Cancel" on a run node when status is `in_progress` or `queued`. Calls Gitea API to cancel the run; on success, refresh the tree and show feedback.
- [ ] **Availability**: "Cancel" is only shown/enabled when the run is cancelable (e.g. status is running/queued). "Re-run" is available for completed/failed/canceled runs (per Gitea API behavior).
- [ ] **Errors**: On API failure (4xx/5xx or unsupported Gitea version), show a clear, safe error message (no token/URL leak). Optionally document minimum Gitea version (e.g. 1.25.1) in README.
- [ ] **Refresh**: After re-run or cancel, trigger a refresh of the runs list for that repo so the UI reflects the new state.

## Implementation notes

- Add `rerunRun(repo, runId)` and `cancelRun(repo, runId)` (or equivalent) to `src/gitea/api.ts`.
- Extend `src/gitea/swagger.ts` / `EndpointMap` with rerun and cancel paths (and fallbacks if not in Swagger).
- Register commands in `src/controllers/commands.ts` and add menu contributions in `package.json` for run node context menu (`viewItem == giteaRun`).
- Use existing store and tree refresh pattern; consider passing run payload into the command handler so the correct repo/run is used in multi-repo workspaces.
