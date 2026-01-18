import * as vscode from "vscode";

export class Logger {
  private readonly channel: vscode.OutputChannel;
  private readonly debugEnabled: () => boolean;

  constructor(channelName: string, debugEnabled: () => boolean) {
    this.channel = vscode.window.createOutputChannel(channelName);
    this.debugEnabled = debugEnabled;
  }

  info(message: string): void {
    this.channel.appendLine(`[info] ${message}`);
  }

  warn(message: string): void {
    this.channel.appendLine(`[warn] ${message}`);
  }

  error(message: string): void {
    this.channel.appendLine(`[error] ${message}`);
  }

  debug(message: string): void {
    if (this.debugEnabled()) {
      this.channel.appendLine(`[debug] ${message}`);
    }
  }

  dispose(): void {
    this.channel.dispose();
  }
}
