# Gitea VS Extension — Repo Analysis & Feature Roadmap (2026)

**Context**: Gitea 1.25.5 (latest), VS Code–compatible editors, baseline year 2026.  
This document summarizes what the extension does, how it compares to GitHub/GitLab extensions, and suggests features and structural improvements.

---

## 1. What This Repo Does

**Gitea VS Extension** is a VS Code extension that brings **Gitea Actions and Pull Requests** into the editor so users can monitor workflows and PRs without leaving the IDE.

### Current feature set

| Area | Capabilities |
|------|----------------|
| **Actions** | Tree views: **Current Branch Runs**, **Workflows** (all runs by branch). Colored status icons, branch filter, adaptive polling (fast when active, slower when idle). |
| **Runs/Jobs** | Expand run → load jobs/steps on demand; view job logs (in-editor, optional save to `.tmp/gitea-logs/`); open latest failed job logs; artifacts listed per run. |
| **Pull Requests** | PR list per repo (author, labels, last updated); open in browser; copy URL. |
| **Review comments** | Inline PR review comments in the editor for the current branch (optional, via `reviewComments.enabled`). |
| **Secrets & variables** | Full CRUD for repo Actions secrets and variables in the Settings tree. |
| **Discovery** | Repos from workspace git remotes (`workspace`) or all accessible via API (`allAccessible`). |
| **Security** | Token in VS Code SecretStorage; configurable TLS skip (with safe default); no tokens on disk. |

### Tech stack

- **Language**: TypeScript (strict), Node (see `.node-version`).
- **Runtime**: VS Code extension host (Node 18+).
- **HTTP**: undici.
- **Build**: esbuild, vsce; tests: Vitest; quality: ESLint, Prettier.
- **Layout**: `src/` — `extension.ts`, `config/`, `gitea/`, `controllers/`, `views/`, `util/`; tests in `src/test/`.

---

## 2. Comparison With Other Platforms

### 2.1 GitHub Pull Requests and Issues (VS Code)

- **PR lifecycle**: Create PR, checkout PR branch, review in editor, merge/approve, customizable queries (“Waiting for my review”, “Created by me”, etc.).
- **Issues**: List/browse issues, “Start working on issue” (create branch), code actions from TODO comments.
- **DX**: Hover cards for @mentions and issues, completion for users/issues, terminal + CLI coexistence.
- **Tree views**: Configurable icon modes (author avatars, state icons, generic).

**Gap for us**: No create/checkout/merge PR in-editor; no Issues view; no PR queries/filters; no “start working on issue” flow.

### 2.2 GitLab for VS Code

- **MR review**: Open MR in VS Code, read changes and discussions, native comment UI (commenting API).
- **CI/CD**: Pipeline/job status in sidebar, synced with status bar for current branch.
- **MR creation**: Create MR from status bar.
- **Extras**: Snippet patches for multi-file suggestions; GitLab Duo / Code Suggestions (AI).

**Gap for us**: No pipeline/run status in status bar for “current branch” beyond what we show in tree; no create MR from editor; no pipeline-centric status bar summary.

### 2.3 Gitea API 1.25.x (relevant endpoints)

From Gitea 1.25 API and release notes:

- **Actions**: List runs/jobs, job logs, list/create/delete artifacts, delete workflow run, **workflow_dispatch** (POST).
- **Issues**: Full issue API (list, get, create, comment, labels, milestones, etc.).
- **PRs**: List/get/merge PRs, reviews, review comments (we use the latter for inline comments).
- **Rerun/cancel**: Web UI has rerun/cancel; 1.25.1 fixed rerun bug (#35780). Repo-level API includes “Delete a workflow run” and “Create a workflow dispatch event”; exact rerun/cancel REST paths should be confirmed in [Gitea API 1.25](https://docs.gitea.com/api/1.25/).

---

## 3. Suggested New Features

Prioritized by impact and alignment with GitHub/GitLab expectations and Gitea 1.25.x.

### High impact (parity / differentiation)

1. **Re-run and cancel workflow run**  
   - Context actions on run node: “Re-run” and “Cancel” (when running).  
   - Use Gitea repo-level API (delete run, and rerun if available; confirm endpoints for 1.25.5).

2. **Create PR from current branch**  
   - Command / status bar: “Create Pull Request” opening Gitea “new PR” for current repo/branch.  
   - Improves parity with GitHub/GitLab “create PR/MR from editor”.

3. **Checkout PR branch**  
   - From PR node: “Checkout branch” (and optionally create local branch like `pr/<author>/<number>`).  
   - Requires git integration (branch create/checkout) and handling of existing local branches.

4. **Issues view**  
   - New tree: “Issues” per repo (open/closed filter, assignee, labels).  
   - Gitea has full issue API; list/get/create/comment are straightforward.  
   - Optional: “Start working on issue” (create branch from issue, similar to GitHub).

### Medium impact (polish and clarity)

5. **PR filters/queries**  
   - Settings or view filter: “Authored by me”, “Review requested”, “All open”, etc., using Gitea search/query where available.

6. **Workflow dispatch (trigger workflow)**  
   - For workflows with `workflow_dispatch`, show “Run workflow” and optionally inputs.  
   - Uses POST workflow_dispatch (present in Gitea 1.25).

7. **Status bar: run status for current branch**  
   - Short summary: e.g. “Gitea: 2 running, 1 failed” or “All passed”, click to focus extension view.  
   - Aligns with GitLab’s “CI status in status bar”.

8. **Artifact download**  
   - Context menu on artifact node: “Download” and optionally “Reveal in file explorer”.  
   - Use Gitea artifact download endpoint; store under `.tmp/gitea-artifacts/` or user setting.

### Lower priority / exploration

9. **Merge PR (with confirmation)**  
   - “Merge” on PR node (merge style from repo settings or prompt).  
   - Needs merge API and conflict handling.

10. **Inline PR comment creation**  
    - Add new review comments from the editor (we already show existing ones).  
    - Requires Gitea “create review comment” API and UX for placement.

11. **Notifications**  
    - Consume Gitea notifications API for PR/issue mentions and show in a small tree or badge.  
    - Optional and can be limited to “unread count” to avoid scope creep.

12. **Configurable tree view icons**  
    - Like GitHub: choose author avatars vs state icons vs generic.  
    - Improves accessibility and visual consistency.

---

## 4. Structural and Codebase Improvements

### 4.1 API and versioning

- **Gitea version in UX**: Show “Compatible with Gitea 1.25.x” in README and optionally in Settings (e.g. after Test Connection show server version).  
- **API compatibility**: Swagger discovery + fallback endpoints are good; document which endpoints require which Gitea version and handle 404/405 for rerun/cancel/delete run on older instances.  
- **Rerun/cancel**: Add repo-level endpoints to `EndpointMap` and `gitea/swagger.ts` (or fallbacks) once exact paths for 1.25.5 are confirmed.

### 4.2 Project structure

- **Feature specs**: Keep using `specs/` (e.g. `001-current-branch-workflows`) and SpecKit flow for larger features (spec → plan → tasks).  
- **Docs**: Centralize “what we support” and “what Gitea version” in `docs/` (e.g. this file + a short FEATURES.md or section in README).  
- **Categories**: Consider adding Marketplace categories (e.g. “SCM Providers”, “Testing”) in `package.json` for discoverability.

### 4.3 Testing and robustness

- **API surface**: More tests for normalizers and API client (e.g. list runs/jobs with various Gitea response shapes).  
- **Rerun/cancel/delete**: Integration or contract-style tests against a fixed API schema (or mock server) for new Actions endpoints.  
- **Review comments**: Tests for `reviewCommentsController` (e.g. matching PR by branch/SHA, threading).

### 4.4 Performance and UX

- **Lazy loading**: Already in place for jobs/artifacts; keep strict limits (`maxRunsPerRepo`, `maxJobsPerRun`) and document them.  
- **Cancellation**: Ensure log fetches and long-running API calls are cancellable where the editor API allows (e.g. `CancellationToken`).  
- **Errors**: Consistent, safe error messages (no token/URL leak); link to troubleshooting in README.

### 4.5 Configuration and discovery

- **Discovery**: Keep `workspace` vs `allAccessible`; consider “pinned repos” (explicit list) for large orgs.  
- **Multi-instance**: If multiple Gitea hosts are needed later, design around one baseUrl per workspace (or document single-instance assumption).

---

## 5. Suggested MVP Order (for implementation)

1. **Re-run / Cancel run** — Small API addition, high user value.  
2. **Status bar run summary** — Single place to see “current branch” status.  
3. **Create PR** — One command + open browser (or webview) to new PR page.  
4. **Checkout PR branch** — Improves PR-centric workflow.  
5. **Issues view** — New tree; list + open in browser first; “Start working on issue” later.  
6. **Artifact download** — Completes the artifact story we already expose in the tree.

---

## 6. References

- [Gitea API 1.25](https://docs.gitea.com/api/1.25/)  
- [Gitea 1.25.0 release notes](https://blog.gitea.com/release-of-1.25.0)  
- [GitHub Pull Requests and Issues extension](https://github.com/microsoft/vscode-pull-request-github)  
- [GitLab for VS Code](https://docs.gitlab.com/editor_extensions/visual_studio_code)  
- [Gitea Actions re-run fix 1.25.1](https://github.com/go-gitea/gitea/issues/35780)  
- Project: `AGENTS.md`, `README.md`, `.specify/memory/constitution.md`
