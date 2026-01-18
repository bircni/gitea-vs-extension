import * as vscode from "vscode";
import type { TreeNode } from "./nodes";
import {
  ConfigActionNode,
  ConfigRootNode,
  MessageNode,
  SecretNode,
  SecretsRootNode,
  TokenNode,
  VariableNode,
  VariablesRootNode,
} from "./nodes";
import type { RepoRef } from "../gitea/models";
import type { ActionVariable, Secret } from "../gitea/api";

export class SettingsTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private currentRepo: RepoRef | undefined;
  private secrets: Secret[] = [];
  private variables: ActionVariable[] = [];
  private secretsState: "idle" | "loading" | "error" = "idle";
  private variablesState: "idle" | "loading" | "error" = "idle";
  private secretsError?: string;
  private variablesError?: string;
  private hasToken = false;

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element as vscode.TreeItem;
  }

  getChildren(element?: TreeNode): vscode.ProviderResult<TreeNode[]> {
    if (!element) {
      if (!this.currentRepo) {
        return [new MessageNode("Open a Gitea repository to view settings")];
      }

      return [
        new SecretsRootNode(this.currentRepo),
        new VariablesRootNode(this.currentRepo),
        new ConfigRootNode(),
      ];
    }

    if (element instanceof SecretsRootNode) {
      if (this.secretsState === "loading") {
        return [new MessageNode("Loading secrets...")];
      }
      if (this.secretsState === "error") {
        return [new MessageNode(this.secretsError ?? "Failed to load secrets", "error")];
      }
      if (this.secrets.length === 0) {
        return [new MessageNode("No secrets defined")];
      }
      return this.secrets.map(
        (secret) => new SecretNode(element.repo, secret.name, secret.description),
      );
    }

    if (element instanceof VariablesRootNode) {
      if (this.variablesState === "loading") {
        return [new MessageNode("Loading variables...")];
      }
      if (this.variablesState === "error") {
        return [new MessageNode(this.variablesError ?? "Failed to load variables", "error")];
      }
      if (this.variables.length === 0) {
        return [new MessageNode("No repository variables defined")];
      }
      return this.variables.map(
        (variable) =>
          new VariableNode(
            element.repo,
            variable.name,
            variable.description,
            variable.value ?? variable.data,
          ),
      );
    }

    if (element instanceof ConfigRootNode) {
      return [new TokenNode(this.hasToken), new ConfigActionNode()];
    }

    return [];
  }

  getCurrentRepo(): RepoRef | undefined {
    return this.currentRepo;
  }

  setRepository(repo: RepoRef | undefined): void {
    const repoChanged =
      this.currentRepo &&
      repo &&
      (this.currentRepo.host !== repo.host ||
        this.currentRepo.owner !== repo.owner ||
        this.currentRepo.name !== repo.name);

    this.currentRepo = repo;

    // Clear secrets and variables when repo changes or is set to undefined
    if (!repo || repoChanged) {
      this.secrets = [];
      this.variables = [];
      this.secretsState = "idle";
      this.variablesState = "idle";
    }

    this.refresh();
  }

  setTokenStatus(hasToken: boolean): void {
    this.hasToken = hasToken;
    this.refresh();
  }

  setSecrets(secrets: Secret[]): void {
    this.secrets = secrets;
    this.secretsState = "idle";
    this.secretsError = undefined;
    this.refresh();
  }

  setSecretsLoading(): void {
    this.secretsState = "loading";
    this.secretsError = undefined;
    this.refresh();
  }

  setSecretsError(error: string): void {
    this.secretsState = "error";
    this.secretsError = error;
    this.refresh();
  }

  setVariables(variables: ActionVariable[]): void {
    this.variables = variables;
    this.variablesState = "idle";
    this.variablesError = undefined;
    this.refresh();
  }

  setVariablesLoading(): void {
    this.variablesState = "loading";
    this.variablesError = undefined;
    this.refresh();
  }

  setVariablesError(error: string): void {
    this.variablesState = "error";
    this.variablesError = error;
    this.refresh();
  }

  refresh(node?: TreeNode): void {
    this.onDidChangeTreeDataEmitter.fire(node);
  }
}
