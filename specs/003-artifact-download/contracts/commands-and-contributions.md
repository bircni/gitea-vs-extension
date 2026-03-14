# Commands and Contribution Points: Artifact Download

**Feature**: 003-artifact-download  
**Date**: 2026-03-14

Contract for the new commands and contribution points. Existing extension commands and menus remain unchanged except where noted.

---

## Commands

| Command ID | Description | When / Where |
|------------|-------------|----------------|
| `gitea-vs-extension.downloadArtifact` | Downloads the artifact to the configured directory and shows the save path. | Invoked from context menu on an artifact node (Current Branch Runs / Workflows). Receives one argument: the tree item (e.g. `ArtifactNode`). |
| `gitea-vs-extension.revealArtifactInExplorer` | Opens the folder (or file) containing the downloaded artifact in the OS file manager. If not yet downloaded, shows a message to download first. | Same as above. Receives same argument. |

**Argument contract**: Both commands MUST receive the first argument from the menu so that in multi-repo workspaces the correct repo/run/artifact is used. Handler MUST accept `arg` (e.g. `ArtifactNode | undefined`) and validate that `arg instanceof ArtifactNode` before proceeding.

---

## Menus (contribution points)

- **View/item/context** (or equivalent for tree views): Add “Download” and “Reveal in File Explorer” when `when` is artifact context (e.g. `viewItem == giteaArtifact`). Exact `when` clause to match existing pattern (e.g. `view == giteaCurrentBranchRuns` or `view == giteaWorkflows` plus context value `giteaArtifact`).

---

## Configuration

- **Key**: `gitea-vs-extension.artifacts.downloadPath`
- **Type**: `string`
- **Default**: `.tmp/gitea-artifacts/`
- **Description**: Base directory for downloaded artifacts. Relative to the first workspace folder, or absolute if path is absolute. Document in package.json and README; include required token scope for artifact download.

---

## Package.json contributions

- **contributes.commands**: Add the two commands with title and category consistent with existing (e.g. “Download”, “Reveal in File Explorer”).
- **contributes.configuration**: Add `artifacts.downloadPath` under `gitea-vs-extension` with type, default, and description.
- **contributes.menus**: Add menu items for the artifact context so both commands appear on artifact nodes.
