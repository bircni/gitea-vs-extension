import * as vscode from "vscode";

export class Logger {
  private readonly channel: vscode.OutputChannel;
  private readonly debugEnabled: () => boolean;

  constructor(channelName: string, debugEnabled: () => boolean) {
    this.channel = vscode.window.createOutputChannel(channelName);
    this.debugEnabled = debugEnabled;
  }

  info(message: string, category?: string): void {
    this.channel.appendLine(`[info] ${withCategory(message, category)}`);
  }

  warn(message: string, category?: string): void {
    this.channel.appendLine(`[warn] ${withCategory(message, category)}`);
  }

  error(message: string, category?: string): void {
    this.channel.appendLine(`[error] ${withCategory(message, category)}`);
  }

  debug(message: string, category?: string): void {
    if (this.debugEnabled()) {
      this.channel.appendLine(`[debug] ${withCategory(message, category)}`);
    }
  }

  dispose(): void {
    this.channel.dispose();
  }
}

function withCategory(message: string, category?: string): string {
  if (!category) {
    return message;
  }
  return `[${category}] ${message}`;
}
