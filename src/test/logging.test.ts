import * as vscode from "vscode";
import { Logger } from "../util/logging";

describe("Logger", () => {
  beforeEach(() => {
    (vscode.window.createOutputChannel as jest.Mock).mockClear();
  });

  test("writes messages to output channel", () => {
    const logger = new Logger("gitea", () => true);
    const channel = (vscode.window.createOutputChannel as jest.Mock).mock.results[0].value;

    logger.info("hello");
    logger.warn("warn");
    logger.error("oops");
    logger.debug("dbg");

    expect(channel.appendLine).toHaveBeenCalledWith("[info] hello");
    expect(channel.appendLine).toHaveBeenCalledWith("[warn] warn");
    expect(channel.appendLine).toHaveBeenCalledWith("[error] oops");
    expect(channel.appendLine).toHaveBeenCalledWith("[debug] dbg");

    logger.dispose();
    expect(channel.dispose).toHaveBeenCalled();
  });

  test("skips debug when disabled", () => {
    const logger = new Logger("gitea", () => false);
    const channel = (vscode.window.createOutputChannel as jest.Mock).mock.results[0].value;

    logger.debug("dbg");
    expect(channel.appendLine).not.toHaveBeenCalledWith("[debug] dbg");
  });

  test("writes categorized log lines", () => {
    const logger = new Logger("gitea", () => true);
    const channel = (vscode.window.createOutputChannel as jest.Mock).mock.results[0].value;

    logger.info("hello", "core");
    logger.debug("diag", "diagnostics");

    expect(channel.appendLine).toHaveBeenCalledWith("[info] [core] hello");
    expect(channel.appendLine).toHaveBeenCalledWith("[debug] [diagnostics] diag");
  });
});
