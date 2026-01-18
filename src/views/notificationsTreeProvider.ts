import * as vscode from "vscode";
import type { NotificationStore } from "../util/notificationStore";
import type { TreeNode } from "./nodes";
import { ErrorNode, MessageNode, NotificationNode } from "./nodes";

export class NotificationsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly store: NotificationStore) {}

  refresh(node?: TreeNode): void {
    this._onDidChangeTreeData.fire(node);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<TreeNode[]> {
    if (this.store.isLoading()) {
      return [new MessageNode("Loading notifications...")];
    }
    const error = this.store.getError();
    if (error) {
      return [new ErrorNode(error)];
    }
    const notifications = this.store.getNotifications();
    if (!notifications.length) {
      return [new MessageNode("No notifications.")];
    }
    return notifications.map((thread) => new NotificationNode(thread));
  }
}
