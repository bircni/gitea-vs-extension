# Create PR from current branch

**Labels:** `enhancement`, `pull requests`, `high priority`

## Summary

Add a **Create Pull Request** action that opens the Gitea "new PR" page for the current repository and current branch (e.g. compare base → head). Available from a command, and optionally from the status bar or tree view, to improve parity with GitHub/GitLab "create PR/MR from editor".

## Background

- GitHub and GitLab extensions allow creating a PR/MR from the editor (command or status bar).
- Gitea supports creating a PR via URL with query params for base/head (e.g. compare branch).
- Reference: `docs/ANALYSIS-2026.md` (§3 high impact #2, §5 MVP order).

## Acceptance criteria

- [ ] **Command**: A command "Gitea: Create Pull Request" (or similar) that opens the Gitea new-PR/compare URL for the current workspace folder's repo and current branch. Example URL shape: `{baseUrl}/repo/owner/name/compare/base...currentBranch` or the "new pull request" page with branch pre-selected if supported by Gitea.
- [ ] **Context**: Command resolves current repo from the active workspace folder (or ask user to pick folder in multi-root) and current branch via existing `getCurrentBranchInFolder` / branch context. If no repo or branch can be determined, show a clear message (e.g. "Open a workspace folder that is a git repo with a Gitea remote").
- [ ] **Discovery**: Use existing discovery and base URL config (`gitea-vs-extension.baseUrl`). Only show/enable when we have a valid repo and base URL.
- [ ] **Entry points**: Register in `package.json` and expose at least via Command Palette. Optionally: status bar item (e.g. "Create PR") or context menu on repo node in the Gitea view.
- [ ] **Documentation**: README or Settings description mentions the command and required token scopes (e.g. read repo + read branch; creating PR may require write/push scope if Gitea checks).

## Implementation notes

- Add command in `src/controllers/commands.ts`; resolve repo via `resolveRepoFromFolder(workspaceFolder, baseUrl)` and branch via `getCurrentBranchInFolder(folder)` from `src/util/git.ts`.
- Build Gitea compare/new-PR URL (confirm exact path from Gitea docs for 1.25.x) and open with `vscode.env.openExternal`.
- No new tree view required; optional status bar uses `vscode.window.createStatusBarItem`.
