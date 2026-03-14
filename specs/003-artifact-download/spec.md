# Feature Specification: Artifact Download

**Feature Branch**: `003-artifact-download`  
**Created**: 2026-03-14  
**Status**: Draft  
**Input**: [GitHub Issue #11 — Artifact download](https://github.com/bircni/gitea-vs-extension/issues/11)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Download workflow artifact from tree (Priority: P1)

As a user viewing Gitea Actions runs in the editor, I want to download a workflow run artifact from the tree (Current Branch Runs or Workflows) so that I can use the built files or reports locally without leaving the IDE.

**Why this priority**: Core value of the feature; without download there is no artifact-download capability.

**Independent Test**: User can right-click an artifact node in the tree, choose "Download", and find the artifact saved under a configured directory with clear success feedback. Delivers value as a standalone action.

**Acceptance Scenarios**:

1. **Given** a workflow run with at least one artifact is visible in the tree, **When** the user selects "Download" from the context menu on that artifact node, **Then** the artifact is saved to a deterministic location and the user sees a message indicating where it was saved.
2. **Given** the user has set a custom base directory for downloads, **When** the user downloads an artifact, **Then** the file(s) are saved under that directory (with a deterministic subpath to avoid overwriting).
3. **Given** the download fails (e.g. network error or artifact no longer available), **When** the user attempts download, **Then** the user sees a clear, safe error message and no partial or corrupt file is left in an ambiguous state.

---

### User Story 2 - Reveal downloaded artifact in file explorer (Priority: P2)

As a user who has just downloaded an artifact (or who knows where artifacts are saved), I want to open that folder in my system file explorer so that I can quickly browse or use the files.

**Why this priority**: Improves discoverability and workflow after download; optional convenience.

**Independent Test**: After downloading an artifact (or from context on an artifact), user can trigger "Reveal in file explorer" and the correct folder or file is opened in the OS file manager.

**Acceptance Scenarios**:

1. **Given** an artifact has been downloaded to a known path, **When** the user chooses "Reveal in file explorer" from the artifact context menu (or a post-download option), **Then** the system file explorer opens showing the folder containing the downloaded file(s) or the file itself when it is a single file.
2. **Given** the user has not yet downloaded the artifact, **When** the user chooses "Reveal in file explorer", **Then** the system shows a clear message that the artifact must be downloaded first (e.g. "Download the artifact first").

---

### User Story 3 - Configure where artifacts are saved (Priority: P3)

As a user, I want to choose where downloaded artifacts are stored (e.g. a folder relative to my workspace or an absolute path) so that they fit my project layout and tooling.

**Why this priority**: Allows personal or team conventions; not required for basic download to work.

**Independent Test**: User can set a configuration value for the download base path; the next download uses that path. Can be tested by changing the setting and verifying the next download location.

**Acceptance Scenarios**:

1. **Given** the user has set a base path (relative or absolute), **When** an artifact is downloaded, **Then** files are saved under that path with a deterministic subpath (e.g. by repository, run, and artifact name) to avoid collisions.
2. **Given** no custom path is set, **When** an artifact is downloaded, **Then** a sensible default base path is used relative to the first workspace folder (e.g. `.tmp/gitea-artifacts/`), and this default is documented.

---

### Edge Cases

- What happens when the artifact is a single file versus an archive (e.g. zip)? The system saves the content as received: archives (e.g. zip) are saved as a single file; single-file artifacts are saved as that file. No automatic extraction.
- What happens when the download destination is read-only or the user has no permission to write? The user sees a clear error message and no partial file is presented as success.
- What happens when two artifacts from different runs have the same name? The save path is deterministic and includes enough context (e.g. run id, repo) so that names do not collide.
- What happens when the server returns a redirect or a blob URL for the artifact? The system follows the redirect and saves the resulting content correctly; failures are reported clearly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to trigger a "Download" action from the context menu on an artifact node in the Current Branch Runs and Workflows tree views.
- **FR-002**: The system MUST save the downloaded artifact to a deterministic path under a configurable base directory, using subpaths that prevent overwriting (e.g. repository, run identifier, artifact name).
- **FR-003**: The system MUST support a configuration setting for the base directory where artifacts are saved (default: a dedicated folder relative to the first workspace folder, e.g. `.tmp/gitea-artifacts/`; absolute path allowed).
- **FR-004**: On successful download, the system MUST inform the user where the artifact was saved (e.g. message with path).
- **FR-005**: On download failure (e.g. 404, network error, permission error), the system MUST show a clear, safe error message and MUST NOT leave the user with a partial or corrupt file presented as success.
- **FR-006**: The system MUST handle both archive (e.g. zip) and single-file artifact responses: save as received (zip as zip, single file as file); no automatic extraction.
- **FR-007**: Users MUST be able to open the folder (or file) containing the downloaded artifact in the system file explorer ("Reveal in file explorer") from context on the artifact node. When the artifact has not been downloaded yet, the system MUST show a clear message (e.g. "Download the artifact first") and MUST NOT perform an automatic download.
- **FR-008**: Documentation (e.g. README or Settings description) MUST describe the download and reveal actions and the base path setting, and MUST state any required token or permission scope for downloading artifacts.

### Key Entities

- **Artifact**: A named artifact produced by a workflow run; identified by repository, run, and artifact name or id; may be a single file or an archive.
- **Download destination**: A base directory (configurable; relative to workspace or absolute) plus a deterministic subpath so that multiple artifacts do not overwrite each other.

## Assumptions

- The Gitea instance exposes an endpoint to download a specific artifact for a workflow run (e.g. redirect or blob); the extension will use that endpoint.
- Default base path is a dedicated folder (e.g. `.tmp/gitea-artifacts/`) relative to the first workspace folder when multiple folders exist; absolute path is allowed via setting.
- "Reveal in file explorer" only works after the artifact has been downloaded; if not yet downloaded, the user is told to download first (no automatic download on reveal).
- Archives are saved as-is (e.g. zip file); no automatic extraction.
- Token or API scope required for artifact download is documented so users can fix permission errors.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can download a workflow artifact from the tree in a single action (context menu → Download) and see where it was saved.
- **SC-002**: Download failures (network, 404, permissions) result in a clear message and no misleading success state.
- **SC-003**: Users can configure where artifacts are stored and see that setting reflected on the next download.
- **SC-004**: Users can open the downloaded artifact location in the system file explorer without manually navigating (when "Reveal" is supported).
- **SC-005**: Documentation clearly describes the feature, the base path setting, and required permissions for artifact download.
