# Quickstart: Artifact Download (manual test scenarios)

**Feature**: 003-artifact-download  
**Date**: 2026-03-14

Manual flows to verify the feature after implementation. Run from a workspace with a Gitea-backed repo that has at least one workflow run with artifacts.

---

## Prerequisites

- Extension built and running (`npm run build`; run Extension Development Host or install .vsix).
- Gitea instance with Actions enabled and at least one run that produced artifacts.
- Token configured with scope that allows reading Actions artifacts.

---

## Scenario 1: Download artifact (US1)

1. Open **Current Branch Runs** or **Workflows** in the Gitea view.
2. Expand a run that has artifacts; expand “Artifacts” and see at least one artifact node.
3. Right-click an artifact → **Download**.
4. **Expected**: Message like “Artifact saved to …” with a path under `.tmp/gitea-artifacts/` (or your configured path). Path includes repo, run id, and artifact name. File exists at that path (zip or single file).
5. Repeat with another artifact or another run; paths must not overwrite (deterministic subpaths).

---

## Scenario 2: Reveal after download (US2)

1. After downloading an artifact (Scenario 1), **double-click** the same artifact node (or select it and press Enter).
2. **Expected**: The downloaded file opens in the editor (e.g. zip or single file).
3. Without having downloaded, double-click another artifact.
4. **Expected**: Message like “Download the artifact first.” No automatic download.

---

## Scenario 3: Custom download path (US3)

1. Open Settings; search for “gitea” or “artifacts”.
2. Set **Gitea VS Extension: Artifacts › Download Path** to a custom path (e.g. `my-artifacts` or an absolute path).
3. Download an artifact.
4. **Expected**: File is saved under the configured path with the same deterministic subpath. Success message shows the actual path used.

---

## Scenario 4: Error handling

1. Disconnect network or use an invalid token; try **Download** on an artifact.
2. **Expected**: Clear error message (no stack trace to user). No file or partial file at the expected path.
3. Set download path to a read-only or non-existent drive/path if possible; try **Download**.
4. **Expected**: Clear error message; no partial file presented as success.

---

## Scenario 5: Multi-root workspace

1. Open a workspace with multiple folders; ensure at least one has a Gitea remote.
2. Do not set a custom download path. Download an artifact from a run in that workspace.
3. **Expected**: Default base path is relative to the **first** workspace folder (e.g. `firstFolder/.tmp/gitea-artifacts/...`). Documented in README/settings.

---

## Checklist before release

- [ ] All five scenarios pass.
- [ ] README (or Settings UI) describes Download, Open in browser, double-click to open file, and the download path setting.
- [ ] Required token scope for artifact download is documented.
