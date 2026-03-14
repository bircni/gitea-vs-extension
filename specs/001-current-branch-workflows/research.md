# Research: Current Branch Workflows

## Decisions

### 1. Branch Context Resolution

- **Decision**: Resolve the “current branch” per repository using the local Git state associated with that repository and workspace context.
- **Rationale**: The extension already integrates with local Git and repository discovery (`util/git.ts`, `util/repoResolution.ts`); using local state ensures that the workflows view reflects what the user is actually working on, not only what exists on the remote.
- **Alternatives considered**:
  - **Remote-only branch detection via Gitea API**: Would miss local-only branches and diverge from the user’s active work context.
  - **Global workspace branch**: Would fail for workspaces with multiple repositories; the spec explicitly scopes branch context per selected repository.

### 2. Branch-Aware Filtering Strategy

- **Decision**: Implement branch-aware filtering entirely on the client side over the already-fetched workflow runs for each repository.
- **Rationale**: This reuses existing polling, caching, and limits (`maxRunsPerRepo`, `maxJobsPerRun`) while avoiding new API endpoints, query modes, or token scopes.
- **Alternatives considered**:
  - **Additional API calls per branch**: Increases traffic and latency and risks violating the Performance & Responsiveness principle.
  - **Server-side filtering only**: Would require API/schema changes in Gitea and tighter coupling to server versions.

### 3. Edge-State Behaviour

- **Decision**: Handle “no current branch”, “detached HEAD”, and “no runs for current branch” via explicit empty states and/or fallbacks to “all branches” or explicit branch selection.
- **Rationale**: The spec’s User Story 3 requires predictable behaviour and clear messaging when branch context is ambiguous; this also aligns with the constitution’s reliability and safe failure principles.
- **Alternatives considered**:
  - **Silently falling back to all branches without explanation**: Violates clarity requirements and makes it hard for users to reason about what they are seeing.
  - **Blocking the workflows view entirely**: Reduces in-editor visibility and contradicts the goal of graceful degradation.

### 4. User-Controlled Overrides

- **Decision**: Model branch filter state as a view-level setting (for example, “current branch”, a specific branch, or “all branches”) that can be changed within the workflows view and reset back to “current branch only”.
- **Rationale**: Satisfies User Story 2 and keeps control discoverable where the user is working, without adding long-lived configuration flags.
- **Alternatives considered**:
  - **Persistent global setting to disable current-branch filtering**: Conflicts with the spec’s assumption that automatic filtering is always applied when possible and adds configuration complexity.
  - **Hidden commands only**: Makes overrides difficult to find and undermines usability.

### 5. Observability & Logging

- **Decision**: Log branch-resolution failures and unexpected states only when debug logging is enabled, using the existing structured logging utilities.
- **Rationale**: Supports the constitution’s observability requirements without leaking sensitive data in normal operation.
- **Alternatives considered**:
  - **Always-on verbose logging**: Risks cluttering logs and potentially exposing sensitive repository details.
  - **No logging of failures**: Makes debugging branch-resolution issues difficult.

