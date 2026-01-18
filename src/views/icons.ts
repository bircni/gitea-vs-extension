import * as vscode from "vscode";
import type { ApiConclusion, ApiStatus } from "../gitea/models";

export function iconForStatus(status: ApiStatus, conclusion?: ApiConclusion): vscode.ThemeIcon {
  if (status === "running") {
    return new vscode.ThemeIcon("sync~spin", new vscode.ThemeColor("charts.blue"));
  }
  if (status === "queued") {
    return new vscode.ThemeIcon("clock", new vscode.ThemeColor("charts.yellow"));
  }

  switch (conclusion) {
    case "success":
      return new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"));
    case "failure":
      return new vscode.ThemeIcon("error", new vscode.ThemeColor("charts.red"));
    case "cancelled":
      return new vscode.ThemeIcon("circle-slash", new vscode.ThemeColor("charts.gray"));
    case "skipped":
      return new vscode.ThemeIcon("debug-step-over", new vscode.ThemeColor("charts.yellow"));
    default:
      return new vscode.ThemeIcon("question", new vscode.ThemeColor("disabledForeground"));
  }
}
