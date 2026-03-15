/**
 * Unit tests for artifact command handlers and argument normalization.
 */
import {
  downloadArtifact,
  normalizeArtifactArg,
  openOrRevealArtifact,
  revealArtifactInExplorer,
  type ArtifactCommandsDeps,
} from "../controllers/artifactCommands";
import { ArtifactNode } from "../views/nodes";
import type { Artifact, RepoRef } from "../gitea/models";

const mockRepo: RepoRef = { host: "gitea.example.com", owner: "o", name: "n" };
const mockArtifact: Artifact = {
  id: 1,
  name: "out",
  sizeInBytes: 100,
  downloadUrl: "https://example.com/artifact",
};

function makeArtifactNode(): ArtifactNode {
  return new ArtifactNode(mockRepo, 42, mockArtifact);
}

describe("normalizeArtifactArg", () => {
  it("returns ArtifactNode when arg is ArtifactNode", () => {
    const node = makeArtifactNode();
    expect(normalizeArtifactArg(node)).toBe(node);
  });

  it("returns undefined when arg is not ArtifactNode", () => {
    expect(normalizeArtifactArg(undefined)).toBeUndefined();
    expect(normalizeArtifactArg(null)).toBeUndefined();
    expect(
      normalizeArtifactArg({ repo: mockRepo, runId: 1, artifact: mockArtifact }),
    ).toBeUndefined();
    expect(normalizeArtifactArg("string")).toBeUndefined();
  });
});

describe("downloadArtifact", () => {
  it("shows message when arg is not ArtifactNode", async () => {
    const showInformationMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/path",
      existsSync: () => false,
      showInformationMessage,
      showErrorMessage: jest.fn(),
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
    };
    await downloadArtifact(deps, undefined);
    expect(showInformationMessage).toHaveBeenCalledWith(
      "Select an artifact from the tree to download.",
    );
    expect(deps.downloadArtifactToFile).not.toHaveBeenCalled();
  });

  it("calls downloadArtifactToFile with correct args when arg is ArtifactNode", async () => {
    const downloadArtifactToFile = jest.fn().mockResolvedValue("/tmp/o/n/42/out");
    const showInformationMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile,
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/path",
      existsSync: () => false,
      showInformationMessage,
      showErrorMessage: jest.fn(),
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
    };
    const node = makeArtifactNode();
    await downloadArtifact(deps, node);
    expect(downloadArtifactToFile).toHaveBeenCalledWith(mockRepo, 42, mockArtifact, "/tmp");
    expect(showInformationMessage).toHaveBeenCalledWith("Artifact saved to /tmp/o/n/42/out");
  });

  it("shows error and does not log when download fails and debugLogging is false", async () => {
    const showErrorMessage = jest.fn();
    const logError = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn().mockRejectedValue(new Error("Network error")),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({ debugLogging: false }),
      computeArtifactSavePath: () => "/tmp/path",
      existsSync: () => false,
      showInformationMessage: jest.fn(),
      showErrorMessage,
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
      logError,
    };
    await downloadArtifact(deps, makeArtifactNode());
    expect(showErrorMessage).toHaveBeenCalledWith("Download failed: Network error");
    expect(logError).not.toHaveBeenCalled();
  });

  it("shows error and calls logError when download fails and debugLogging is true", async () => {
    const showErrorMessage = jest.fn();
    const logError = jest.fn();
    const err = new Error("Network error");
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn().mockRejectedValue(err),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({ debugLogging: true }),
      computeArtifactSavePath: () => "/tmp/path",
      existsSync: () => false,
      showInformationMessage: jest.fn(),
      showErrorMessage,
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
      logError,
    };
    await downloadArtifact(deps, makeArtifactNode());
    expect(showErrorMessage).toHaveBeenCalledWith("Download failed: Network error");
    expect(logError).toHaveBeenCalledWith("gitea-vs-extension.downloadArtifact", err);
  });

  it("shows error with string when download throws non-Error", async () => {
    const showErrorMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn().mockRejectedValue("string error"),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/path",
      existsSync: () => false,
      showInformationMessage: jest.fn(),
      showErrorMessage,
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
    };
    await downloadArtifact(deps, makeArtifactNode());
    expect(showErrorMessage).toHaveBeenCalledWith("Download failed: string error");
  });
});

describe("revealArtifactInExplorer", () => {
  it("shows message when arg is not ArtifactNode", async () => {
    const showInformationMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/path",
      existsSync: () => false,
      showInformationMessage,
      showErrorMessage: jest.fn(),
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
    };
    await revealArtifactInExplorer(deps, undefined);
    expect(showInformationMessage).toHaveBeenCalledWith(
      "Select an artifact from the tree to reveal in file explorer.",
    );
  });

  it("shows message when artifact file does not exist", async () => {
    const showInformationMessage = jest.fn();
    const computeArtifactSavePath = jest.fn().mockReturnValue("/tmp/o/n/42/out");
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath,
      existsSync: () => false,
      showInformationMessage,
      showErrorMessage: jest.fn(),
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
    };
    await revealArtifactInExplorer(deps, makeArtifactNode());
    expect(showInformationMessage).toHaveBeenCalledWith("Download the artifact first.");
    expect(deps.executeCommand).not.toHaveBeenCalled();
  });

  it("calls revealFileInOS when artifact file exists", async () => {
    const executeCommand = jest.fn().mockResolvedValue(undefined);
    const uriFile = jest.fn((p: string) => ({ fsPath: p }));
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: (_base, _repo, _runId, _art) => "/tmp/o/n/42/out",
      existsSync: () => true,
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      executeCommand,
      uriFile,
    };
    await revealArtifactInExplorer(deps, makeArtifactNode());
    expect(uriFile).toHaveBeenCalledWith("/tmp/o/n/42/out");
    expect(executeCommand).toHaveBeenCalledWith("revealFileInOS", { fsPath: "/tmp/o/n/42/out" });
  });

  it("shows error when revealFileInOS throws", async () => {
    const showErrorMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/o/n/42/out",
      existsSync: () => true,
      showInformationMessage: jest.fn(),
      showErrorMessage,
      executeCommand: jest.fn().mockRejectedValue(new Error("Reveal failed")),
      uriFile: (p) => ({ fsPath: p }),
    };
    await revealArtifactInExplorer(deps, makeArtifactNode());
    expect(showErrorMessage).toHaveBeenCalledWith("Reveal failed: Reveal failed");
  });
});

describe("openOrRevealArtifact", () => {
  it("returns without message when arg is not ArtifactNode", async () => {
    const showInformationMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/path",
      existsSync: () => false,
      showInformationMessage,
      showErrorMessage: jest.fn(),
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
    };
    await openOrRevealArtifact(deps, undefined);
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it("shows message when artifact file does not exist", async () => {
    const showInformationMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/o/n/42/out",
      existsSync: () => false,
      showInformationMessage,
      showErrorMessage: jest.fn(),
      executeCommand: jest.fn(),
      uriFile: (p) => ({ fsPath: p }),
    };
    await openOrRevealArtifact(deps, makeArtifactNode());
    expect(showInformationMessage).toHaveBeenCalledWith("Download the artifact first.");
  });

  it("calls vscode.open when artifact file exists", async () => {
    const executeCommand = jest.fn().mockResolvedValue(undefined);
    const uriFile = jest.fn((p: string) => ({ fsPath: p }));
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/o/n/42/out",
      existsSync: () => true,
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      executeCommand,
      uriFile,
    };
    await openOrRevealArtifact(deps, makeArtifactNode());
    expect(executeCommand).toHaveBeenCalledWith("vscode.open", { fsPath: "/tmp/o/n/42/out" });
  });

  it("shows error when vscode.open throws", async () => {
    const showErrorMessage = jest.fn();
    const deps: ArtifactCommandsDeps = {
      downloadArtifactToFile: jest.fn(),
      getArtifactDownloadBaseDir: () => "/tmp",
      getSettings: () => ({}),
      computeArtifactSavePath: () => "/tmp/o/n/42/out",
      existsSync: () => true,
      showInformationMessage: jest.fn(),
      showErrorMessage,
      executeCommand: jest.fn().mockRejectedValue(new Error("Open failed")),
      uriFile: (p) => ({ fsPath: p }),
    };
    await openOrRevealArtifact(deps, makeArtifactNode());
    expect(showErrorMessage).toHaveBeenCalledWith("Open failed: Open failed");
  });
});
