# Structural and codebase improvements

**Labels:** `documentation`, `testing`, `maintenance`, `medium priority`

## Summary

Track and implement **structural and codebase improvements** from the 2026 analysis: API versioning and compatibility, project structure and docs, testing and robustness, performance/UX (cancellation, errors), and configuration/discovery. These are cross-cutting improvements rather than a single user-facing feature.

## Background

- Reference: [ANALYSIS-2026.md](../ANALYSIS-2026.md) **§4 Structural and Codebase Improvements**.
- Items can be implemented incrementally; this issue serves as an umbrella or checklist.

## Acceptance criteria (by subsection)

### 4.1 API and versioning

- [ ] **Gitea version in UX**: Show “Compatible with Gitea 1.25.x” (or current) in README; optionally show server version in Settings after Test Connection.
- [ ] **API compatibility**: Document which endpoints require which Gitea version; handle 404/405 gracefully for rerun/cancel/delete run on older instances.
- [ ] **Rerun/cancel**: Add repo-level endpoints to `EndpointMap` and `gitea/swagger.ts` (or fallbacks) once exact paths for 1.25.5 are confirmed (can be done as part of the rerun/cancel feature issue).

### 4.2 Project structure

- [ ] **Feature specs**: Continue using `specs/` and SpecKit flow (spec → plan → tasks) for larger features.
- [ ] **Docs**: Centralize “what we support” and “what Gitea version” in `docs/` (e.g. ANALYSIS-2026.md + FEATURES.md or a clear README section).
- [ ] **Marketplace**: Consider adding Marketplace categories in `package.json` (e.g. “SCM Providers”, “Testing”) for discoverability.

### 4.3 Testing and robustness

- [ ] **API surface**: Add more tests for normalizers and API client (e.g. list runs/jobs with various Gitea response shapes).
- [ ] **Rerun/cancel/delete**: Add integration or contract-style tests for new Actions endpoints (when implemented).
- [ ] **Review comments**: Add tests for `reviewCommentsController` (e.g. matching PR by branch/SHA, threading).

### 4.4 Performance and UX

- [ ] **Lazy loading**: Keep strict limits (`maxRunsPerRepo`, `maxJobsPerRun`) and document them in README or config.
- [ ] **Cancellation**: Ensure log fetches and long-running API calls are cancellable where the VS Code API allows (e.g. `CancellationToken`).
- [ ] **Errors**: Use consistent, safe error messages (no token/URL leak); add a troubleshooting link or section in README.

### 4.5 Configuration and discovery

- [ ] **Discovery**: Keep `workspace` vs `allAccessible`; consider “pinned repos” (explicit list) for large orgs as a follow-up.
- [ ] **Multi-instance**: Document single-instance assumption (one baseUrl per workspace); if multiple hosts are needed later, design and document.

## Implementation notes

- Work can be split into smaller PRs (e.g. “Document Gitea version”, “Add normalizer tests”, “Add CancellationToken to log fetch”).
- No single spec/plan is required; use this issue as a backlog and close sub-items or open child issues as needed.
