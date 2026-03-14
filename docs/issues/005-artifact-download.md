# Artifact download

**Labels:** `enhancement`, `actions`, `medium priority`

## Summary

Add a **Download** (and optionally **Reveal in file explorer**) context action on workflow run artifact nodes. Artifacts are already listed under a run; this feature downloads the artifact to a local directory (e.g. `.tmp/gitea-artifacts/` or a user-setting path) and optionally opens the folder in the file explorer.

## Background

- Gitea API provides "Get/Download artifact" (and "Downloads a specific artifact for a workflow run redirects to blob url").
- GitHub/GitLab extensions allow downloading artifacts from the UI. Completing the artifact story in this extension improves parity.
- Reference: `docs/ANALYSIS-2026.md` (§3 medium impact #8, §5 MVP order).

## Acceptance criteria

- [ ] **Context menu**: "Download" on an artifact node (Current Branch Runs / Workflows). Optionally "Reveal in file explorer" after download when the artifact is a single file or when the user has chosen a path.
- [ ] **Download behavior**: Call Gitea API to get the artifact (stream or redirect). Save to a deterministic path under a dedicated directory. Use a setting for base directory (e.g. `gitea-vs-extension.artifacts.downloadPath` default `.tmp/gitea-artifacts/` relative to workspace root or absolute). Subpath can include repo name, run id, and artifact name to avoid collisions.
- [ ] **Format**: If the API returns a zip, save as zip and optionally unzip into a folder (document behavior). If a single file, save as that file. Handle Gitea artifact API response (e.g. redirect to blob or archive endpoint).
- [ ] **Feedback**: On success, show an information message with the path (e.g. "Artifact saved to …"). On failure (e.g. 404, network error), show a clear, safe error message.
- [ ] **Documentation**: README or Settings describes the new setting and the Download/Reveal actions; document required token scopes for downloading artifacts.

## Implementation notes

- Add `getArtifactDownloadUrl(repo, runId, artifactId)` or `downloadArtifact(repo, runId, artifactId)` in `src/gitea/api.ts`. Gitea may return a redirect URL for the artifact file/zip; use undici to follow redirect and stream body to disk.
- Add command(s) in `src/controllers/commands.ts`: e.g. `gitea-vs-extension.downloadArtifact` and optionally `gitea-vs-extension.revealArtifactInExplorer`. Pass artifact payload (repo, run id, artifact id/name) from tree item.
- Add setting `gitea-vs-extension.artifacts.downloadPath` in `package.json` and read in `config/settings.ts`. Resolve relative path against workspace folder when applicable.
- Ensure artifact nodes expose the data needed (run id, artifact id/name) for the API call; see `src/views/nodes.ts` and `src/gitea/models.ts` (Artifact type).
- Use `vscode.workspace.fs` or Node `fs`/stream for writing file(s); for "Reveal", use `vscode.commands.executeCommand('revealFileInOS', uri)`.
