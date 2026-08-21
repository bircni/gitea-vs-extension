# Issues view

**Labels:** `enhancement`, `issues`, `high priority`

## Summary

Add an **Issues** tree view per repository: list open (and optionally closed) issues with basic filters (e.g. state, assignee, labels). Optional: "Open in browser" and later "Start working on issue" (create branch from issue). Gitea exposes a full Issues API (list, get, create, comment) suitable for this feature.

## Background

- GitHub and GitLab extensions provide an Issues view with list/browse and "Start working on issue" (create branch).
- Gitea API 1.25: [Issues API](https://docs.gitea.com/api/1.25/#tag/issue) supports list, get, create, comments, labels, milestones.
- Reference: `docs/ANALYSIS-2026.md` (§3 high impact #4, §5 MVP order).

## Acceptance criteria

- [ ] **New view**: A tree view "Issues" in the Gitea activity bar container, alongside Current Branch, Workflows, and Settings. Shows one section per repo (same discovery as other views): under each repo, list issues.
- [ ] **List issues**: For each repo, call Gitea API to list issues (e.g. `state=open` by default; optional `state=all` or closed). Display at least: issue number, title, author/assignee (if available), labels, updated time. Use existing repo discovery and token.
- [ ] **Filter**: Support at least open vs closed (e.g. view filter or setting `gitea-vs-extension.issues.state`: `open` | `closed` | `all`). Optional: filter by assignee or labels (can be follow-up).
- [ ] **Actions**: Context menu on an issue node: "Open in browser" (issue URL). Optional for MVP: "Start working on issue" (create branch, e.g. `issue/<number>-slug`) as a later task.
- [ ] **Performance**: Reuse existing patterns (lazy load if needed, limit number of issues per repo via setting, e.g. `gitea-vs-extension.maxIssuesPerRepo` default 50). Refresh with same refresh control as other views.
- [ ] **Documentation**: README lists the Issues view and any new settings; document required token scopes (read issues).

## Implementation notes

- Add `listIssues(repo, state?, page?, limit?)` (and optionally `getIssue`) in `src/gitea/api.ts`. Add Swagger/fallback for issues endpoints if needed.
- Add Issue type (and normalizer) in `src/gitea/models.ts` (e.g. id, number, title, state, author, assignee, labels, html_url, updated_at).
- New tree provider or extend existing: add "Issues" mode/section in `src/views/actionsTreeProvider.ts` (or a dedicated issues tree provider). Add `IssueNode` in `src/views/nodes.ts`.
- Register view and commands in `package.json`; add configuration in `config/settings.ts` for `issues.state` and `maxIssuesPerRepo`.
- Reuse store/cache pattern if issues are to be refreshed with the same cycle as runs/PRs, or a dedicated refresh for the Issues view.
