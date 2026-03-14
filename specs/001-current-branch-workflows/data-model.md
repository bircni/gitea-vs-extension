# Data Model: Current Branch Workflows

## Entities

### Repository

- **Description**: A Gitea repository discovered by the extension and shown in the workflows-related views.
- **Fields**:
  - `owner: string` – Repository owner.
  - `name: string` – Repository name.
  - `id: string | number` – Identifier used by the extension and Gitea API (see `RepoRef` in `gitea/models.ts`).

### BranchContext

- **Description**: Represents the branch considered “current” for a given repository and user context.
- **Fields**:
  - `repo: Repository` – Repository to which this context applies.
  - `branchName: string | null` – Name of the current branch, or `null` if not resolvable.
  - `status: "resolved" | "unresolved" | "detached" | "noRepo"` – Status of branch resolution.
  - `reason?: string` – Optional human-readable explanation for non-`resolved` states (for example, “detached HEAD” or “no workspace folder for repo”).

### WorkflowRun (existing)

- **Description**: A single workflow run fetched from Gitea, as already modelled in `gitea/models.ts`.
- **Key Fields (relevant to this feature)**:
  - `id: number` – Run identifier.
  - `status: string` – Current status (queued, running, completed, etc.).
  - `conclusion?: string` – Final conclusion for completed runs.
  - `branch?: string` – Branch associated with the run (used for filtering).
  - `htmlUrl?: string` – URL to open in the browser.

### BranchFilterState

- **Description**: Captures the current branch filter applied in the workflows view for a repository.
- **Fields**:
  - `repo: Repository` – Repository whose runs are being filtered.
  - `mode: "currentBranch" | "allBranches" | "specificBranch"` – Filter mode.
  - `branchName?: string` – When `mode === "specificBranch"`, the branch name to filter on.

### WorkflowViewState

- **Description**: Aggregates the data needed to render workflows for a repository with branch awareness.
- **Fields**:
  - `repo: Repository` – Target repository.
  - `branchContext: BranchContext` – Resolved branch context.
  - `filter: BranchFilterState` – Current filter applied to runs.
  - `runs: WorkflowRun[]` – All runs currently loaded for the repository.
  - `filteredRuns: WorkflowRun[]` – Runs after applying the filter.

## Relationships

- A **Repository** has zero or one **BranchContext** at any given time in the user session.
- A **Repository** has zero or one **BranchFilterState** in the workflows view; the filter may be derived from `BranchContext` (for “currentBranch”) or overridden by the user.
- A **Repository** has many **WorkflowRun** records associated with it; **WorkflowViewState** encapsulates the subset loaded and currently visible.

## Mapping to User Stories

- **User Story 1 (P1)** – *See workflows for my current branch by default*  
  - Uses `BranchContext` to determine `branchName` and initial `BranchFilterState` with `mode: "currentBranch"`.  
  - `WorkflowViewState.filteredRuns` is computed by selecting runs whose `branch === branchContext.branchName`.

- **User Story 2 (P2)** – *Override and control branch filtering*  
  - Updates `BranchFilterState` to `"allBranches"` or `"specificBranch"` based on user actions in the workflows view.  
  - `WorkflowViewState.filteredRuns` re-computes accordingly while `BranchContext` remains available for returning to `"currentBranch"`.

- **User Story 3 (P3)** – *Sensible behaviour for edge situations*  
  - Uses `BranchContext.status` and `reason` to drive empty states and fallbacks when `branchName` is not available or has no runs.  
  - `BranchFilterState` may default to `"allBranches"` or prompt for a manual selection when `status !== "resolved"`.

