/**
 * Unit tests for browser/clipboard command handlers and argument normalization.
 */
import {
  copyUrl,
  openBaseUrlSettings,
  openInBrowser,
  type BrowserCommandsDeps,
} from "../controllers/browserCommands";
import { RepoNode } from "../views/nodes";
import type { RepoRef } from "../gitea/models";

describe("openInBrowser", () => {
  const baseDeps: BrowserCommandsDeps = {
    getBaseUrl: () => "https://gitea.example.com",
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    openExternal: vi.fn().mockResolvedValue(undefined),
    clipboardWriteText: vi.fn().mockResolvedValue(undefined),
    executeCommand: vi.fn().mockResolvedValue(undefined),
  };

  it("shows warning when resolveOpenUrl returns undefined", async () => {
    const showWarningMessage = vi.fn();
    await openInBrowser({ ...baseDeps, getBaseUrl: () => "", showWarningMessage }, undefined);
    expect(showWarningMessage).toHaveBeenCalledWith("No URL available for this item.");
    expect(baseDeps.openExternal).not.toHaveBeenCalled();
  });

  it("calls openExternal with url when arg is RepoNode with htmlUrl", async () => {
    const openExternal = vi.fn().mockResolvedValue(undefined);
    const repo: RepoRef = {
      host: "gitea.example.com",
      owner: "o",
      name: "n",
      htmlUrl: "https://gitea.example.com/o/n",
    };
    const node = new RepoNode(repo);
    await openInBrowser(
      { ...baseDeps, openExternal, getBaseUrl: () => "https://gitea.example.com" },
      node,
    );
    expect(openExternal).toHaveBeenCalledWith("https://gitea.example.com/o/n");
  });
});

describe("copyUrl", () => {
  const baseDeps: BrowserCommandsDeps = {
    getBaseUrl: () => "https://gitea.example.com",
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    openExternal: vi.fn().mockResolvedValue(undefined),
    clipboardWriteText: vi.fn().mockResolvedValue(undefined),
    executeCommand: vi.fn().mockResolvedValue(undefined),
  };

  it("shows warning when url is not available", async () => {
    const showWarningMessage = vi.fn();
    await copyUrl({ ...baseDeps, getBaseUrl: () => "", showWarningMessage }, null);
    expect(showWarningMessage).toHaveBeenCalledWith("No URL available for this item.");
    expect(baseDeps.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("writes url to clipboard and shows info when arg is RepoNode", async () => {
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn();
    const repo: RepoRef = {
      host: "gitea.example.com",
      owner: "o",
      name: "n",
      htmlUrl: "https://gitea.example.com/o/n",
    };
    const node = new RepoNode(repo);
    await copyUrl(
      {
        ...baseDeps,
        clipboardWriteText,
        showInformationMessage,
        getBaseUrl: () => "https://gitea.example.com",
      },
      node,
    );
    expect(clipboardWriteText).toHaveBeenCalledWith("https://gitea.example.com/o/n");
    expect(showInformationMessage).toHaveBeenCalledWith("URL copied to clipboard.");
  });
});

describe("openBaseUrlSettings", () => {
  it("calls executeCommand with workbench.action.openSettings and filter", async () => {
    const executeCommand = vi.fn().mockResolvedValue(undefined);
    await openBaseUrlSettings({
      getBaseUrl: () => "",
      showWarningMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      openExternal: vi.fn(),
      clipboardWriteText: vi.fn(),
      executeCommand,
    });
    expect(executeCommand).toHaveBeenCalledWith(
      "workbench.action.openSettings",
      "@gitea-vs-extension",
    );
  });
});
