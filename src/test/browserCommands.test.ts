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
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    openExternal: jest.fn().mockResolvedValue(undefined),
    clipboardWriteText: jest.fn().mockResolvedValue(undefined),
    executeCommand: jest.fn().mockResolvedValue(undefined),
  };

  it("shows warning when resolveOpenUrl returns undefined", async () => {
    const showWarningMessage = jest.fn();
    await openInBrowser({ ...baseDeps, getBaseUrl: () => "", showWarningMessage }, undefined);
    expect(showWarningMessage).toHaveBeenCalledWith("No URL available for this item.");
    expect(baseDeps.openExternal).not.toHaveBeenCalled();
  });

  it("calls openExternal with url when arg is RepoNode with htmlUrl", async () => {
    const openExternal = jest.fn().mockResolvedValue(undefined);
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
    showWarningMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    openExternal: jest.fn().mockResolvedValue(undefined),
    clipboardWriteText: jest.fn().mockResolvedValue(undefined),
    executeCommand: jest.fn().mockResolvedValue(undefined),
  };

  it("shows warning when url is not available", async () => {
    const showWarningMessage = jest.fn();
    await copyUrl({ ...baseDeps, getBaseUrl: () => "", showWarningMessage }, null);
    expect(showWarningMessage).toHaveBeenCalledWith("No URL available for this item.");
    expect(baseDeps.clipboardWriteText).not.toHaveBeenCalled();
  });

  it("writes url to clipboard and shows info when arg is RepoNode", async () => {
    const clipboardWriteText = jest.fn().mockResolvedValue(undefined);
    const showInformationMessage = jest.fn();
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
    const executeCommand = jest.fn().mockResolvedValue(undefined);
    await openBaseUrlSettings({
      getBaseUrl: () => "",
      showWarningMessage: jest.fn(),
      showInformationMessage: jest.fn(),
      openExternal: jest.fn(),
      clipboardWriteText: jest.fn(),
      executeCommand,
    });
    expect(executeCommand).toHaveBeenCalledWith(
      "workbench.action.openSettings",
      "@gitea-vs-extension",
    );
  });
});
