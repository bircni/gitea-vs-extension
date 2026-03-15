/**
 * Artifact command handlers: download, reveal in explorer, open or reveal.
 * Extracted from commands.ts for testability and single responsibility.
 */
import type { Artifact, RepoRef } from "../gitea/models";
import { ArtifactNode } from "../views/nodes";

export type ArtifactCommandsDeps = {
  downloadArtifactToFile: (
    repo: RepoRef,
    runId: number | string,
    artifact: Artifact,
    baseDir: string,
  ) => Promise<string>;
  getArtifactDownloadBaseDir: () => string;
  getSettings: () => { debugLogging?: boolean };
  computeArtifactSavePath: (
    baseDir: string,
    repo: RepoRef,
    runId: number | string,
    artifact: Artifact,
  ) => string;
  existsSync: (path: string) => boolean;
  showInformationMessage: (msg: string) => void;
  showErrorMessage: (msg: string) => void;
  executeCommand: (command: string, uri: unknown) => PromiseLike<unknown>;
  uriFile: (path: string) => unknown;
  logError?: (label: string, err: unknown) => void;
};

/** Normalize arg to ArtifactNode; return undefined if not an artifact node. */
export function normalizeArtifactArg(arg: unknown): ArtifactNode | undefined {
  return arg instanceof ArtifactNode ? arg : undefined;
}

export async function downloadArtifact(deps: ArtifactCommandsDeps, arg: unknown): Promise<void> {
  const node = normalizeArtifactArg(arg);
  if (!node) {
    deps.showInformationMessage("Select an artifact from the tree to download.");
    return;
  }
  const baseDir = deps.getArtifactDownloadBaseDir();
  try {
    const savePath = await deps.downloadArtifactToFile(
      node.repo,
      node.runId,
      node.artifact,
      baseDir,
    );
    deps.showInformationMessage(`Artifact saved to ${savePath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.showErrorMessage(`Download failed: ${message}`);
    if (deps.getSettings().debugLogging && deps.logError) {
      deps.logError("gitea-vs-extension.downloadArtifact", err);
    }
  }
}

export async function revealArtifactInExplorer(
  deps: ArtifactCommandsDeps,
  arg: unknown,
): Promise<void> {
  const node = normalizeArtifactArg(arg);
  if (!node) {
    deps.showInformationMessage("Select an artifact from the tree to reveal in file explorer.");
    return;
  }
  const baseDir = deps.getArtifactDownloadBaseDir();
  const savePath = deps.computeArtifactSavePath(baseDir, node.repo, node.runId, node.artifact);
  if (!deps.existsSync(savePath)) {
    deps.showInformationMessage("Download the artifact first.");
    return;
  }
  try {
    await deps.executeCommand("revealFileInOS", deps.uriFile(savePath));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.showErrorMessage(`Reveal failed: ${message}`);
  }
}

export async function openOrRevealArtifact(
  deps: ArtifactCommandsDeps,
  arg: unknown,
): Promise<void> {
  const node = normalizeArtifactArg(arg);
  if (!node) {
    return;
  }
  const baseDir = deps.getArtifactDownloadBaseDir();
  const savePath = deps.computeArtifactSavePath(baseDir, node.repo, node.runId, node.artifact);
  if (!deps.existsSync(savePath)) {
    deps.showInformationMessage("Download the artifact first.");
    return;
  }
  try {
    await deps.executeCommand("vscode.open", deps.uriFile(savePath));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.showErrorMessage(`Open failed: ${message}`);
  }
}
