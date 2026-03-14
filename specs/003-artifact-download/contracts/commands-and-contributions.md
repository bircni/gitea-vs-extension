# Commands and Contribution Points: Artifact Download

**Feature**: 003-artifact-download  
**Date**: 2026-03-14

Contract for the new commands and contribution points. Existing extension commands and menus remain unchanged except where noted.

---

## Commands

| Command ID | Description | When / Where |
|------------|-------------|----------------|
| `gitea-vs-extension.downloadArtifact` | Downloads the artifact to the configured directory and shows the save path. | Context menu and inline button on an artifact node (Current Branch Runs / Workflows). Receives one argument: the tree item (e.g. `ArtifactNode`). |
| `gitea-vs-extension.openInBrowser` | Opens the artifact URL in the browser. | Shown on artifact nodes (inline and context). |
| `gitea-vs-extension.openOrRevealArtifact` | If the artifact file exists locally, opens it in the editor; otherwise shows "Download the artifact first." | **Double-click** (and Enter) on an artifact node. Tree item `command` set so this runs by default. Receives `ArtifactNode`. |
| `gitea-vs-extension.revealArtifactInExplorer` | Opens the folder (or file) in the OS file manager. If not yet downloaded, shows a message to download first. | Implemented but **not** on artifact menu; requires artifact context. Not reachable from the tree in current UX. |

**Argument contract**: Commands invoked from the tree MUST receive the first argument from the menu so that in multi-repo workspaces the correct repo/run/artifact is used. Handlers MUST accept `arg` (e.g. `ArtifactNode | undefined`) and validate that `arg instanceof ArtifactNode` before proceeding.

---

## Menus (contribution points)

- **View/item/context**: On artifact nodes (`viewItem == giteaArtifact`), show only **Download** and **Open in browser** (inline and context menu). Do **not** add "Reveal in File Explorer" or "Copy URL" to artifact nodes.
- **Double-click / default command**: Each artifact tree item has `command` set to `gitea-vs-extension.openOrRevealArtifact` so that double-click (or Enter) opens the file in the editor when present, or shows "Download the artifact first."

---

## Configuration

- **Key**: `gitea-vs-extension.artifacts.downloadPath`
- **Type**: `string`
- **Default**: `.tmp/gitea-artifacts/`
- **Description**: Base directory for downloaded artifacts. Relative to the first workspace folder, or absolute if path is absolute. Document in package.json and README; include required token scope for artifact download.

---

## Package.json contributions

- **contributes.commands**: Register Download, Open in browser (reused), openOrRevealArtifact (for double-click), and optionally revealArtifactInExplorer (not on artifact menu).
- **contributes.configuration**: Add `artifacts.downloadPath` under `gitea-vs-extension` with type, default, and description.
- **contributes.menus**: Add **Download** and **Open in browser** only for artifact context. Do not add Reveal in File Explorer to artifact menu.
