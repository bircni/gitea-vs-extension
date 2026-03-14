# Implementation Plan: Artifact Download

**Branch**: `003-artifact-download` | **Date**: 2026-03-14 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-artifact-download/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add **Download** and **Reveal in file explorer** context actions for workflow run artifact nodes in the Current Branch Runs and Workflows tree views. Artifacts are already listed per run; this feature downloads the artifact to a configurable local directory (default `.tmp/gitea-artifacts/` relative to the first workspace folder) via the Gitea artifact download URL, with deterministic subpaths to avoid collisions. Reveal opens the folder/file in the OS file manager only when the artifact has already been downloaded; otherwise the user is prompted to download first. Archives are saved as-is (no extraction). Implementation follows existing patterns: Gitea API client, commands, settings, and tree nodes.

## Technical Context

**Language/Version**: TypeScript (strict), Node.js per `.node-version` (VS Code extension host)  
**Primary Dependencies**: VS Code Extension API, undici (HTTP), existing `gitea/*`, `config/*`, `views/*`, `controllers/*`, `util/*`  
**Storage**: File system for downloaded artifacts; VS Code SecretStorage for token (unchanged); no new persistent state beyond settings  
**Testing**: Jest (existing); tests in `src/test/`; mock client/VS Code as in existing tests  
**Target Platform**: VS Code–compatible editors (extension host)  
**Project Type**: VS Code extension  
**Performance Goals**: Download completes for typical artifact sizes without blocking UI; use existing limiter if needed for concurrent downloads  
**Constraints**: Token scopes for artifact download documented; safe error messages; no partial file on failure  
**Scale/Scope**: Single artifact download per user action; deterministic paths for multiple artifacts/runs/repos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|--------|
| **I. In-Editor Workflow Visibility** | ✓ Pass | Download and Reveal are tree context actions; no context switching. |
| **II. Secure, Minimal Gitea Access** | ✓ Pass | Use existing token; document required scope for artifact download. |
| **III. Reliability, Observability & Safe Failure** | ✓ Pass | Clear error messages on failure; no partial file presented as success; structured logging when debug enabled. |
| **IV. Performance & Responsiveness** | ✓ Pass | Download on user action only; optional streaming for large files (research). |
| **V. Specification-Driven, Testable Delivery** | ✓ Pass | Spec and plan in place; tasks will map to user stories. |
| **Config stability, docs** | ✓ Pass | New setting under `gitea-vs-extension.artifacts.*`; README/Settings describe feature and scopes. |

## Project Structure

### Documentation (this feature)

```text
specs/003-artifact-download/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 (decisions, Gitea download URL)
├── data-model.md        # Phase 1 (entities: artifact download path, settings)
├── quickstart.md        # Phase 1 (manual test scenarios)
├── contracts/           # Phase 1 (commands, contribution points)
└── tasks.md             # Phase 2 (/speckit.tasks – not created by /speckit.plan)
```

### Source Code (repository root)

Existing layout; changes only in these areas:

```text
src/
├── config/
│   └── settings.ts           # Add artifacts.downloadPath, resolve first workspace folder
├── gitea/
│   ├── api.ts                # Add downloadArtifact (or stream to file)
│   └── client.ts             # Optional: getBinary/stream that follows redirects
├── controllers/
│   └── commands.ts           # Register downloadArtifact, revealArtifactInExplorer; pass arg from tree
├── views/
│   └── nodes.ts              # ArtifactNode: add runId for deterministic path
├── util/
│   └── cache.ts              # Optional: track last download path per artifact for Reveal
extension.ts                  # No structural change
package.json                  # New commands, menus, setting gitea-vs-extension.artifacts.downloadPath
```

**Structure Decision**: No new top-level modules. Feature is implemented by extending existing `config`, `gitea`, `controllers`, and `views`. Tests extend `src/test/` (e.g. api.test.ts, commands or a new artifact test file).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Table left empty.
