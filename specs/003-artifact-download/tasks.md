# Tasks: Artifact Download

**Input**: Design documents from `specs/003-artifact-download/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: One optional test task in Polish phase (spec does not require TDD).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Confirm feature context before implementation.

- [x] T001 Verify feature branch and design docs present in specs/003-artifact-download/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure required before any user story. No user story work until this phase is complete.

- [x] T002 [P] Add artifacts.downloadPath to ExtensionSettings and getArtifactDownloadBaseDir() in src/config/settings.ts
- [x] T003 [P] Add computeArtifactSavePath and path sanitization in src/util/artifactDownload.ts
- [x] T004 Add downloadArtifactToFile(repo, runId, artifact, baseDir) with safe write and error handling in src/gitea/api.ts
- [x] T005 [P] Add runId to ArtifactNode in src/views/nodes.ts and pass runId in getArtifactChildren in src/views/actionsTreeProvider.ts

**Checkpoint**: Path resolution, API download, and ArtifactNode.runId ready for commands.

---

## Phase 3: User Story 1 - Download workflow artifact (Priority: P1) — MVP

**Goal**: User can right-click an artifact node, choose Download, and get the file saved to a deterministic path with success feedback.

**Independent Test**: Right-click artifact → Download → message with path; file exists at that path.

### Implementation for User Story 1

- [x] T006 [US1] Register gitea-vs-extension.downloadArtifact command handler in src/controllers/commands.ts

**Checkpoint**: Download handler ready; add commands/menus in Phase 4 after Reveal handler exists.

---

## Phase 4: User Story 2 - Reveal in file explorer (Priority: P2)

**Goal**: User can open the downloaded artifact location in the OS file manager; if not downloaded, see “Download the artifact first”.

**Independent Test**: After download, Reveal opens folder/file; without download, Reveal shows message.

### Implementation for User Story 2

- [x] T007 [US2] Register gitea-vs-extension.revealArtifactInExplorer command handler in src/controllers/commands.ts
- [x] T008 [US2] Add downloadArtifact and revealArtifactInExplorer commands and artifact context menu items in package.json

**Checkpoint**: Download and Reveal both work from tree context menu.

---

## Phase 5: User Story 3 - Configure where artifacts are saved (Priority: P3)

**Goal**: User can set a base path for downloads; next download uses that path.

**Independent Test**: Change setting → download → file under configured path.

### Implementation for User Story 3

- [x] T009 [US3] Add artifacts.downloadPath to contributes.configuration in package.json with type, default, and description including token scope note (can be done in same package.json edit as T008 if desired)

**Checkpoint**: Setting visible in UI and used by download.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and optional tests.

- [x] T010 [P] Document artifact download, reveal, and download path setting and required token scope in README.md
- [ ] T011 Run quickstart.md manual validation per specs/003-artifact-download/quickstart.md and fix any issues
- [x] T012 [P] Add unit tests for artifact download path and download API in src/test/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies.
- **Phase 2**: Depends on Phase 1; blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 2; T008 (menus) after T006 and T007 (handlers).
- **Phase 5 (US3)**: Depends on Phase 2 (setting read in settings.ts); configuration schema in package.json.
- **Phase 6**: Depends on Phases 3–5.

### Task Dependencies

- **T004** depends on **T003** (path helper).
- **T006, T007** depend on T002, T003, T004, T005 (settings, path, API, node).
- **T008** (package.json commands/menus) after T006 and T007 so both handlers exist.

### Parallel Opportunities

- T002, T003, T005 can run in parallel within Phase 2.
- T010 and T012 can run in parallel in Phase 6.

---

## Parallel Example: Phase 2

```text
Parallel: T002 (settings.ts), T003 (util/artifactDownload.ts), T005 (nodes.ts + actionsTreeProvider.ts)
Then: T004 (api.ts, uses T003)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2.
2. Phase 3 (T006).
3. Validate: Download from tree, message with path, file on disk.
4. Optionally add Phase 4 (Reveal) and Phase 5 (setting in UI), then Phase 6.

### Incremental Delivery

1. Phase 1 + 2 → foundation.
2. Phase 3 → Download (MVP).
3. Phase 4 → Reveal.
4. Phase 5 → Configuration schema.
5. Phase 6 → Docs and tests.

### Notes

- [P] = different files, no dependencies.
- [Story] links task to user story for traceability.
- Each user story is independently testable per quickstart.md.
