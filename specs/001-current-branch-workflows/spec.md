# Feature Specification: Current Branch Workflows

**Feature Branch**: `[001-current-branch-workflows]`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "automatically show workflows only for the current branch we are in"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See workflows for my current branch by default (Priority: P1)

As a developer working in a repository, I want the workflows view to automatically show runs for the branch
I currently have checked out, so that I immediately see runs relevant to my active work without manually
adjusting filters.

**Why this priority**: This is the primary value of the feature: reducing noise and making it faster to
see whether the workflows for the branch I am actively working on are passing or failing.

**Independent Test**: Open the workflows view while on a known branch with recent runs; verify that only
workflows for that branch are shown by default and that no extra configuration is required.

**Acceptance Scenarios**:

1. **Given** a repository where workflows have run on branches `main` and `feature/x`, **When** I open the
   workflows view while my local branch is `feature/x`, **Then** the list of runs initially shows only
   workflows for `feature/x`.
2. **Given** a repository where workflows have run on multiple branches, **When** I switch my local branch
   from `main` to `feature/x` and then open the workflows view, **Then** the initial list of runs reflects
   `feature/x` without requiring me to change a branch filter.

---

### User Story 2 - Override and control branch filtering (Priority: P2)

As a developer, I want to be able to change or clear the “current branch only” filter so that I can still
inspect workflows for other branches when needed, and then easily return to viewing only my current branch.

**Why this priority**: The feature must not lock users into a single-branch view; users often need to
compare runs across branches or review runs for branches they are not currently working on.

**Independent Test**: Start from a view filtered to the current branch, change the branch filter to another
branch or to “all branches”, then switch it back so that the view again matches the current branch context.

**Acceptance Scenarios**:

1. **Given** the workflows view is currently filtered to my active branch, **When** I choose a different
   branch or an “all branches” option, **Then** the list of runs updates to reflect that choice and clearly
   indicates the new filter.
2. **Given** I have changed the branch filter away from my active branch, **When** I choose an option to
   return to “current branch only”, **Then** the list of runs updates to show only runs for my active
   branch again and the filter state is clearly visible.

---

### User Story 3 - Sensible behaviour for edge situations (Priority: P3)

As a developer, I want the workflows view to behave predictably when there is no clear current branch (for
example, no repository open or a detached state) so that I still understand what workflows I am seeing and
how to adjust them.

**Why this priority**: In some situations there may not be a single obvious current branch; the feature
should still provide useful information and clear messaging instead of failing silently.

**Independent Test**: Open the workflows view when no branch can be determined; confirm that the feature
explains the situation and still allows choosing a branch or “all branches”.

**Acceptance Scenarios**:

1. **Given** the extension cannot determine a current branch for the selected repository, **When** I open
   the workflows view, **Then** I see either a sensible default (such as “all branches”) or a clear prompt
   to select a branch, along with an explanation that automatic current-branch filtering is unavailable.
2. **Given** the current branch has no workflow runs yet, **When** I open the workflows view, **Then** I see
   an empty state message explaining that there are no runs for this branch and offering a way to inspect
   runs for other branches.

---

### Edge Cases

- What happens when there are multiple repositories in the workspace and the extension cannot determine
  which one is “current” for the user’s context?  
  - Assumption: The user selects a repository or view node first; “current branch” is resolved per selected
    repository, not globally across all repositories.
- How does the system handle branches that exist locally but not (yet) on the remote, or vice versa?  
  - Assumption: Automatic filtering is based on the branch name; if the branch does not exist on the remote,
    the view shows a clear empty state for that branch.
- What happens if users prefer not to have automatic current-branch filtering enabled?  
  - Assumption: Automatic current-branch filtering is always applied when a current branch can be determined.
    Users can temporarily override the branch filter within the workflows view for inspection purposes, but
    there is no explicit persistent opt-in or opt-out setting for this behaviour.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST determine a “current branch” for the selected repository based on the
  user’s active work context (for example, the branch they have checked out) whenever that information is
  available.
- **FR-002**: When a current branch can be determined, the workflows view MUST, by default, display only
  workflow runs associated with that branch for the selected repository.
- **FR-003**: The system MUST provide a visible indication of which branch (or “all branches”) the workflows
  view is currently showing so that users can verify they are looking at the correct context.
- **FR-004**: Users MUST be able to change the branch filter from “current branch” to a specific branch or
  to “all branches”, and the workflows view MUST update accordingly.
- **FR-005**: Users MUST be able to return to a “current branch only” mode from any other filter state using
  a clear control in the workflows view.
- **FR-006**: When a current branch cannot be determined, the system MUST fall back to a sensible default
  (such as “all branches” or an explicit branch-selection prompt) and explain why automatic current-branch
  filtering is not active.
- **FR-007**: When the current branch has no workflow runs, the workflows view MUST show an informative
  empty state, including guidance that users can switch to other branches or “all branches” to see existing
  runs.
- **FR-008**: The feature MUST always apply automatic current-branch filtering when a current branch can be
  determined, while allowing users to temporarily override the branch filter within the workflows view
  without introducing a separate persistent opt-in or opt-out configuration setting.

### Key Entities *(include if feature involves data)*

- **Repository**: Represents a Gitea repository that the extension has discovered and is displaying. Key
  attributes include its identifier, name, and association with local workspace folders.
- **Branch Context**: Represents the branch that is considered “current” for a given repository and user
  session, typically derived from the user’s active work in their editor or from the repository selection in
  the extension.
- **Workflow Run**: Represents an individual run of a workflow in Gitea, including its associated branch,
  status, start/end times, and basic metadata used for listing and filtering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For users who regularly work with multiple branches, the time from opening the workflows view
  to confirming the status of runs for their active branch is reduced by at least 50% compared to a
  baseline without automatic current-branch filtering (as measured in usability sessions).
- **SC-002**: In a usability test, at least 90% of participants can correctly identify which branch’s
  workflows they are viewing without additional explanation, based solely on the workflows view and its
  indicators.
- **SC-003**: At least 80% of surveyed users report that the workflows list feels less cluttered or noisy
  when working on feature branches, compared to the previous behaviour.
- **SC-004**: Support or feedback tickets specifically related to “I cannot easily find workflows for my
  current branch” decrease after the feature is rolled out, based on qualitative feedback tracking.
