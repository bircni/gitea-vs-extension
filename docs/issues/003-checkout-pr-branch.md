# Checkout PR branch

**Labels:** `enhancement`, `pull requests`, `high priority`

## Summary

From a Pull Request node in the Gitea view, add a **Checkout branch** (or **Checkout PR branch**) context action that checks out the PR's head branch locally—creating a local branch if needed (e.g. `pr/<author>/<number>` or the remote branch name), with safe behavior when a local branch with the same name already exists.

## Background

- GitHub/GitLab extensions allow checking out the PR/MR branch from the sidebar, often with a dedicated local branch name to avoid overwriting existing work.
- Requires git integration: fetch (if needed), create/checkout branch. Handle existing local branch (e.g. confirm overwrite or use a unique name).
- Reference: `docs/ANALYSIS-2026.md` (§3 high impact #3, §5 MVP order).

## Acceptance criteria

- [ ] **Context menu**: "Checkout branch" (or "Checkout PR branch") on a PR node in the Pull Requests view. Action receives the PR item (repo + PR head ref/branch and remote URL).
- [ ] **Behavior**: Ensure the PR head branch is available locally (fetch from the appropriate remote). Then create or checkout a local branch. If the branch name is ambiguous or already exists locally with different tracking, use a safe strategy: e.g. create `pr/<author>/<number>` or prompt the user (optional for MVP: always use unique name).
- [ ] **Workspace mapping**: Resolve workspace folder for the repo (same as current branch runs). If the repo is not open in the workspace, show a clear message (e.g. "Open the repository in your workspace to checkout").
- [ ] **Errors**: Handle git errors (e.g. fetch failed, merge conflicts) with clear messages. Do not leak tokens or full URLs in error output.
- [ ] **Documentation**: README or in-product help mentions the command and that it may create a new local branch.

## Implementation notes

- Add command in `src/controllers/commands.ts`; pass PR payload (repo, head branch, head repo clone URL) from the tree item context.
- Use `src/util/git.ts` (e.g. `execGit`) to run `git fetch <remote> <headBranch>`, then `git checkout -b <localBranch> <remote>/<headBranch>` or `git checkout <branch>` when appropriate. Determine remote from repo resolution (e.g. `gitea/remotes.ts`).
- PR model in `src/gitea/models.ts` / API: ensure we have head branch name and optionally head repo clone URL; Gitea API typically returns `head` with `ref` and `repo.clone_url`.
- Consider setting upstream so status and push work as expected after checkout.
