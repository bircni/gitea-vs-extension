# Data Model: Artifact Download

**Feature**: 003-artifact-download  
**Date**: 2026-03-14

Entities and rules relevant to artifact download and reveal. Existing types (e.g. `Artifact`, `RepoRef`) remain as-is; this document describes additions and path rules.

---

## Existing entities (unchanged)

- **RepoRef**: `{ host, owner, name, htmlUrl? }` — identifies the repository.
- **Artifact**: `{ id, name, sizeInBytes?, createdAt?, updatedAt?, downloadUrl? }` — from Gitea list artifacts; `downloadUrl` is used for the download request.
- **ArtifactNode**: Tree item holding `repo: RepoRef` and `artifact: Artifact`; will add `runId: number | string` for path computation.

---

## Additions and path rules

### 1. ArtifactNode (extended)

- **runId**: `number | string` — workflow run identifier. Required to build the deterministic save path and to support “Reveal” without stored state. Set when creating the node in `getArtifactChildren(repo, runId)`.

### 2. Download path (derived, not stored)

- **Base directory**: From setting `gitea-vs-extension.artifacts.downloadPath`.
  - If unset or empty: default `.tmp/gitea-artifacts/` relative to the first workspace folder (`vscode.workspace.workspaceFolders?.[0]?.uri.fsPath`). If no workspace folder, use a fallback (e.g. user’s home or temp) and document behavior.
  - If set: treated as absolute if path is absolute (e.g. starts with `/` or a drive letter on Windows); otherwise relative to the first workspace folder.
- **Subpath**: Deterministic to avoid collisions: `{owner}-{repo}/{runId}/{fileName}`.
  - `fileName`: For zip/archive responses use `{artifact.name}.zip` (or preserve extension from Content-Disposition if present). For single-file artifacts use artifact name (and extension if known). Sanitize for filesystem (e.g. remove path separators).
- **Full path**: `path.join(baseDir, owner-repo, String(runId), fileName)`.

### 3. Settings (new)

- **artifacts.downloadPath**: `string | undefined`. Default: `.tmp/gitea-artifacts/`. Described in package.json and README; resolved as above.

### 4. State for Reveal

- No new persistent state. “Reveal” works by computing the same path and checking existence with `vscode.workspace.fs` or `fs.existsSync`; if the file/folder exists, reveal it; otherwise show “Download the artifact first”.

### 5. Validation rules

- Before writing: ensure parent directory exists (create with `fs.mkdirSync(..., { recursive: true })` or equivalent).
- On write failure (e.g. permission, read-only): do not create a partial file; delete any partial write if possible; show a clear error message.
- Path sanitization: ensure `owner`, `repo`, `runId`, and artifact name do not introduce path traversal or invalid characters in the current OS.
