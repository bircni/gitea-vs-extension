/**
 * Browser and clipboard command handlers: open in browser, copy URL, open base URL settings.
 * Extracted from commands.ts for testability and single responsibility.
 */
import { resolveOpenUrl } from "../util/commandArgs";

export type BrowserCommandsDeps = {
  getBaseUrl: () => string;
  showWarningMessage: (msg: string) => void;
  showInformationMessage: (msg: string) => void;
  openExternal: (url: string) => PromiseLike<unknown>;
  clipboardWriteText: (text: string) => PromiseLike<unknown>;
  executeCommand: (command: string, ...args: unknown[]) => PromiseLike<unknown>;
};

export async function openInBrowser(deps: BrowserCommandsDeps, arg: unknown): Promise<void> {
  const url = resolveOpenUrl(arg, deps.getBaseUrl());
  if (!url) {
    deps.showWarningMessage("No URL available for this item.");
    return;
  }
  await deps.openExternal(url);
}

export async function copyUrl(deps: BrowserCommandsDeps, arg: unknown): Promise<void> {
  const url = resolveOpenUrl(arg, deps.getBaseUrl());
  if (!url) {
    deps.showWarningMessage("No URL available for this item.");
    return;
  }
  await deps.clipboardWriteText(url);
  deps.showInformationMessage("URL copied to clipboard.");
}

export async function openBaseUrlSettings(deps: BrowserCommandsDeps): Promise<void> {
  await deps.executeCommand("workbench.action.openSettings", "@gitea-vs-extension");
}
