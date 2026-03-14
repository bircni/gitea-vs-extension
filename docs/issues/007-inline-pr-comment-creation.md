# Inline PR comment creation

**Labels:** `enhancement`, `pull requests`, `review`, `lower priority`

## Summary

Allow users to **add new review comments** from the editor (e.g. on a selected line or range). The extension already shows existing PR review comments inline; this feature adds the ability to create comments via the Gitea "create review comment" API and a simple UX for placement (e.g. command or code lens).

## Background

- GitHub and GitLab extensions support adding review comments from the editor (e.g. "+" on a line, or "Add comment" in the margin).
- Gitea API: review comments (create) — see [Gitea API 1.25](https://docs.gitea.com/api/1.25/) for create pull request review comment endpoint.
- This extension already has `ReviewCommentsController` for fetching and displaying inline review comments; creating comments requires the corresponding POST API and UI flow.
- Reference: `docs/ANALYSIS-2026.md` (§3 lower priority #10).

## Acceptance criteria

- [ ] **Create comment API**: Call Gitea API to create a review comment (body, path, line or line range, commit_id or similar as required by the API). Implement in `src/gitea/api.ts` (e.g. `createReviewComment(repo, prNumber, payload)`).
- [ ] **UX for placement**: Provide a way to add a comment from the editor — e.g. context menu "Add review comment" on selected text or current line, or code lens "Add comment" above a line. Selection or cursor position determines path and line(s).
- [ ] **Form**: User can enter the comment body (e.g. input box or quick pick, or an inline input). On submit, call the API; on success, refresh review comments and show the new one inline.
- [ ] **Context**: Comment is associated with the current PR for the branch (same logic as when showing comments: match by branch/SHA). Require that the current branch has an open PR; otherwise show a message to open a PR first.
- [ ] **Errors**: Clear, safe error messages on API failure (e.g. 403, 404); no token/URL leak.
- [ ] **Documentation**: README or Settings mentions that users can add review comments from the editor; document required token scope (e.g. write access to pull requests).

## Implementation notes

- Add `createReviewComment(repo, prNumber, body, path, line, side?, commitId?)` (or equivalent per Gitea API) in `src/gitea/api.ts`. Check Swagger/EndpointMap for the exact path (e.g. `POST /repos/{owner}/{repo}/pulls/{index}/comments` or review comments sub-resource).
- Extend `ReviewCommentsController` or commands: register "Add review comment" command; get current file path (relative to repo root), selected range or line, and current PR for the branch; prompt for body; call API; trigger refresh of review comments.
- Reuse existing logic that resolves "current PR" for the branch (e.g. from store or API) so the comment is posted to the correct PR.
- Consider using `vscode.window.showInputBox` or a simple webview for multi-line comment body.
