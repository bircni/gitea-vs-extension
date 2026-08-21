# Re-run workflow run

**Labels:** `enhancement`, `actions`, `high priority`

> **Cancel is not possible.** This issue originally asked for re-run **and cancel**. Gitea exposes
> no API endpoint for cancelling an Actions run: neither `templates/swagger/v1_json.tmpl` nor
> `routers/api/v1/api.go` at tag `v1.27.2` contains one (the only `Cancel*` handler in the API is
> `CancelScheduledAutoMerge`, for pull requests). Cancelling therefore remains web-UI only, and the
> cancel acceptance criteria have been removed. Deleting a run is intentionally not offered either,
> even though `DELETE .../actions/runs/{run}` exists.

## Summary

Add context menu actions on workflow run and job nodes to **re-run** work, using the Gitea repo-level
Actions API.

## Background

Verified available at Gitea 1.27.2 (all require `reqToken()` + `reqRepoWriter(unit.TypeActions)`,
i.e. a token with Actions **write** access):

| Action | Endpoint | Success |
| --- | --- | --- |
| Re-run whole run | `POST /repos/{owner}/{repo}/actions/runs/{run}/rerun` | 201 |
| Re-run failed jobs | `POST /repos/{owner}/{repo}/actions/runs/{run}/rerun-failed-jobs` | 201 |
| Re-run single job | `POST /repos/{owner}/{repo}/actions/runs/{run}/jobs/{job_id}/rerun` | 201 |

Reference: `docs/ANALYSIS-2026.md` (§3 high impact #1, §5 MVP order).

## Acceptance criteria

- [x] **Re-run**: Context menu "Re-run Workflow Run" on a run node (Current Branch Runs / Workflows).
- [x] **Re-run failed jobs**: Context menu "Re-run Failed Jobs" on a run node.
- [x] **Re-run job**: Context menu "Re-run Job" on a job node.
- [x] **Availability**: Re-run entries only appear where the API would accept them — a finished run
      for re-run, a run whose conclusion is `failure` for re-run failed jobs, a finished job for
      re-run job. Driven by capability tokens on the tree items' `contextValue`.
- [x] **Errors**: 401/403 explains the Actions write scope, 404 explains a missing run or an older
      Gitea, 409 explains a run in the wrong state. No token or URL is included in the message.
- [x] **Refresh**: On success the run list for that repo is refreshed so the new attempt appears.
- [x] **Documentation**: README documents the actions, the Actions write scope, and the absence of
      cancel and delete.

## Implementation notes

- `rerunRun` / `rerunFailedJobs` / `rerunJob` in `src/gitea/api.ts`, sharing one private
  `runControl` helper that resolves the endpoint, fills placeholders and translates `HttpError`.
- `EndpointMap` in `src/gitea/swagger.ts` gained `rerunRun`, `rerunFailedJobs` and `rerunJob`, with
  the `/rerun` regex anchored so it never matches `/rerun-failed-jobs`.
- Handlers in `src/controllers/runControlCommands.ts`, registered from
  `src/controllers/commands.ts`.
- `buildRunContextValue` / `buildJobContextValue` in `src/views/nodes.ts` emit the capability
  tokens; the `view/item/context` clauses in `package.json` had to move from `viewItem == giteaRun`
  to `viewItem =~ /giteaRun/` for this to work.
