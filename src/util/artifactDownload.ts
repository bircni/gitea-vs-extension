import path from "node:path";
import type { Artifact, RepoRef } from "../gitea/models";

const REPLACE_INVALID = /[/\\:*?"<>|]/g;

/**
 * Sanitizes a segment for use in a file path (removes path separators and other invalid chars).
 */
function sanitizeSegment(segment: string): string {
  return segment.replaceAll(REPLACE_INVALID, "-").trim() || "unknown";
}

/**
 * Computes the deterministic save path for an artifact.
 * Pattern: baseDir / {owner}-{repo} / {runId} / {fileName}
 * File name is artifact name sanitized; we use .zip for archive downloads (Gitea typically returns zip).
 */
export function computeArtifactSavePath(
  baseDir: string,
  repo: RepoRef,
  runId: number | string,
  artifact: Artifact,
): string {
  const dirSegment = `${sanitizeSegment(repo.owner)}-${sanitizeSegment(repo.name)}`;
  const runSegment = sanitizeSegment(String(runId));
  const nameSegment = sanitizeSegment(artifact.name);
  const fileName = nameSegment.endsWith(".zip") ? nameSegment : `${nameSegment}.zip`;
  return path.join(baseDir, dirSegment, runSegment, fileName);
}
