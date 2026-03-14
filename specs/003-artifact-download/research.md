# Research: Artifact Download

**Feature**: 003-artifact-download  
**Date**: 2026-03-14

Decisions and rationale for implementation. All Technical Context unknowns are resolved.

---

## 1. Gitea artifact download URL and method

**Decision**: Use the `downloadUrl` field already present on the Artifact type (from list artifacts response). Perform a GET request with the existing Gitea client; do not add a separate swagger endpoint for download (the list response provides the URL, which may be a direct or redirect URL).

**Rationale**: Gitea list artifacts returns each artifact with a `download_url` (normalized to `downloadUrl` in our model). That URL may point to `/api/v1/repos/{owner}/{repo}/actions/artifacts/{id}/zip` or similar and may redirect to a blob. Using it avoids duplicating endpoint discovery and keeps the implementation simple.

**Alternatives considered**:
- Adding a dedicated `getArtifactDownloadPath` to swagger and building the path ourselves: more control but duplicates what the API already returns; also swagger may not expose the download path consistently across Gitea versions.
- Using a separate HTTP client for the download URL: unnecessary; same-origin requests can use the existing client with the same token.

---

## 2. Redirect and binary response handling

**Decision**: Use the existing client’s binary request method (e.g. `getBinary`) for the download URL. Rely on undici’s default behavior to follow redirects. Write the response body to disk only after a successful response; on error, do not write a partial file.

**Rationale**: undici `request()` follows redirects by default. The current client has `requestBinary` which buffers the body in memory. For typical artifact sizes this is acceptable; for very large artifacts a future improvement could be streaming to file.

**Alternatives considered**:
- Streaming directly to file from the first response: better for large files but adds code paths; deferred to a later iteration.
- Disabling redirect follow and handling 302 manually: unnecessary given undici defaults.

---

## 3. Deterministic save path and “Reveal”

**Decision**: Save path = `{baseDir}/{owner}-{repo}/{runId}/{artifactName}.zip` (or artifact name with extension when single file). Base dir from setting `gitea-vs-extension.artifacts.downloadPath`; default `.tmp/gitea-artifacts/` resolved relative to the first workspace folder. For “Reveal in file explorer”, compute the same path from repo, runId, and artifact (and optional workspace root); if the file/folder exists, call `vscode.commands.executeCommand('revealFileInOS', uri)`; if not, show “Download the artifact first”.

**Rationale**: Deterministic path allows Reveal without persisting state; same path is used for Download and Reveal. First-workspace-folder default matches clarified spec (Q3).

**Alternatives considered**:
- Storing “last downloaded path” per artifact in cache: adds state and edge cases (e.g. user deletes file); deriving path from repo/run/artifact is stateless and predictable.

---

## 4. Token scopes

**Decision**: Document that artifact download requires the same Gitea token as other Actions API calls; typical scope is “Actions” or equivalent that allows reading workflow runs and artifacts. Add a short note in README and in the setting description for `artifacts.downloadPath` (or in a “Required permissions” section) so users can fix 403s.

**Rationale**: Spec FR-008 requires documenting required token scopes; no new scope discovery mechanism, just documentation.

---

## 5. ArtifactNode and runId

**Decision**: Add `runId` to `ArtifactNode` so the command handler can compute the download path and call the API with (repo, runId, artifact). Pass `runId` from `getArtifactChildren(repo, runId)` when constructing `ArtifactNode`.

**Rationale**: Path includes runId; Reveal and Download both need it. The tree already has runId in scope where artifacts are built; adding it to the node is a small, clear change.
