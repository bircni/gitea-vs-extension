import type { Artifact, RepoRef } from "../gitea/models";
import { computeArtifactSavePath } from "../util/artifactDownload";

const repo: RepoRef = { host: "example.com", owner: "my-owner", name: "my-repo" };

describe("computeArtifactSavePath", () => {
  test("builds deterministic path with owner, repo, runId, and artifact name", () => {
    const artifact: Artifact = { id: 1, name: "dist" };
    const path = computeArtifactSavePath("/base", repo, 42, artifact);
    expect(path).toContain("/base");
    expect(path).toContain("my-owner-my-repo");
    expect(path).toContain("42");
    expect(path).toMatch(/dist\.zip$/);
  });

  test("sanitizes path segments (no path separators or invalid chars)", () => {
    const artifact: Artifact = { id: 1, name: "out/../file" };
    const out = computeArtifactSavePath("/base", repo, 1, artifact);
    expect(out).not.toMatch(/\/\.\.\//);
    expect(out).not.toContain("out/");
    expect(out).toMatch(/\.zip$/);
  });

  test("uses .zip extension when artifact name has no extension", () => {
    const artifact: Artifact = { id: 2, name: "report" };
    const out = computeArtifactSavePath("/artifacts", repo, 3, artifact);
    expect(out).toMatch(/[/\\]artifacts[/\\]my-owner-my-repo[/\\]3[/\\]report\.zip$/);
  });

  test("keeps .zip in artifact name when already present", () => {
    const artifact: Artifact = { id: 2, name: "bundle.zip" };
    const out = computeArtifactSavePath("/artifacts", repo, 3, artifact);
    expect(out).toMatch(/[/\\]artifacts[/\\]my-owner-my-repo[/\\]3[/\\]bundle\.zip$/);
  });
});
