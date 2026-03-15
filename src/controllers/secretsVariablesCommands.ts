/**
 * Secrets and variables command handlers: list, create, update, delete.
 * Extracted from commands.ts for testability and single responsibility.
 */
import type { RepoRef } from "../gitea/models";
import { extractRepo } from "../util/commandArgs";
import { SecretNode, VariableNode } from "../views/nodes";

export type SecretsVariablesCommandsDeps = {
  getCurrentRepo: () => RepoRef | undefined;
  setSecretsLoading: () => void;
  setSecrets: (secrets: unknown[]) => void;
  setSecretsError: (message: string) => void;
  setVariablesLoading: () => void;
  setVariables: (variables: unknown[]) => void;
  setVariablesError: (message: string) => void;
  listSecrets: (repo: RepoRef) => Promise<unknown[]>;
  listVariables: (repo: RepoRef) => Promise<unknown[]>;
  createOrUpdateSecret: (
    repo: RepoRef,
    name: string,
    value: string,
    description?: string,
  ) => Promise<void>;
  deleteSecret: (repo: RepoRef, name: string) => Promise<void>;
  createVariable: (
    repo: RepoRef,
    name: string,
    value: string,
    description?: string,
  ) => Promise<void>;
  updateVariable: (
    repo: RepoRef,
    name: string,
    value: string,
    description?: string,
  ) => Promise<void>;
  deleteVariable: (repo: RepoRef, name: string) => Promise<void>;
  showInputBox: (options: {
    title: string;
    prompt: string;
    password?: boolean;
    value?: string;
  }) => PromiseLike<string | undefined>;
  showWarningMessage: (
    message: string,
    options?: { modal: boolean },
    ...items: string[]
  ) => PromiseLike<string | undefined>;
  refreshSecrets: (arg?: unknown) => Promise<void>;
  refreshVariables: (arg?: unknown) => Promise<void>;
};

function getRepo(deps: SecretsVariablesCommandsDeps, arg: unknown): RepoRef | undefined {
  return extractRepo(arg) ?? deps.getCurrentRepo();
}

export async function refreshSecrets(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  if (!repo) {
    return;
  }
  deps.setSecretsLoading();
  try {
    const secrets = await deps.listSecrets(repo);
    deps.setSecrets(secrets);
  } catch (error) {
    deps.setSecretsError(error instanceof Error ? error.message : "Failed to load secrets.");
  }
}

export async function refreshVariables(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  if (!repo) {
    return;
  }
  deps.setVariablesLoading();
  try {
    const variables = await deps.listVariables(repo);
    deps.setVariables(variables);
  } catch (error) {
    deps.setVariablesError(error instanceof Error ? error.message : "Failed to load variables.");
  }
}

export async function createSecret(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  if (!repo) {
    return;
  }
  const name = await deps.showInputBox({
    title: "Secret name",
    prompt: "Enter secret name",
  });
  if (!name) {
    return;
  }
  const value = await deps.showInputBox({
    title: "Secret value",
    prompt: "Enter secret value",
    password: true,
  });
  if (!value) {
    return;
  }
  const description = await deps.showInputBox({
    title: "Secret description",
    prompt: "Optional description",
  });
  await deps.createOrUpdateSecret(repo, name, value, description);
  await deps.refreshSecrets(repo);
}

export async function updateSecret(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  const secret = arg instanceof SecretNode ? arg : undefined;
  if (!repo || !secret) {
    return;
  }
  const value = await deps.showInputBox({
    title: `Update secret ${secret.name}`,
    prompt: "Enter new secret value",
    password: true,
  });
  if (!value) {
    return;
  }
  const description = await deps.showInputBox({
    title: "Secret description",
    prompt: "Optional description",
    value: secret.description,
  });
  await deps.createOrUpdateSecret(repo, secret.name, value, description);
  await deps.refreshSecrets(repo);
}

export async function deleteSecret(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  const secret = arg instanceof SecretNode ? arg : undefined;
  if (!repo || !secret) {
    return;
  }
  const confirmed = await deps.showWarningMessage(
    `Delete secret ${secret.name}?`,
    { modal: true },
    "Delete",
  );
  if (confirmed !== "Delete") {
    return;
  }
  await deps.deleteSecret(repo, secret.name);
  await deps.refreshSecrets(repo);
}

export async function createVariable(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  if (!repo) {
    return;
  }
  const name = await deps.showInputBox({
    title: "Variable name",
    prompt: "Enter variable name",
  });
  if (!name) {
    return;
  }
  const value = await deps.showInputBox({
    title: "Variable value",
    prompt: "Enter variable value",
  });
  if (!value) {
    return;
  }
  const description = await deps.showInputBox({
    title: "Variable description",
    prompt: "Optional description",
  });
  await deps.createVariable(repo, name, value, description);
  await deps.refreshVariables(repo);
}

export async function updateVariable(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  const variable = arg instanceof VariableNode ? arg : undefined;
  if (!repo || !variable) {
    return;
  }
  const value = await deps.showInputBox({
    title: `Update variable ${variable.name}`,
    prompt: "Enter new variable value",
    value: variable.value,
  });
  if (!value) {
    return;
  }
  const description = await deps.showInputBox({
    title: "Variable description",
    prompt: "Optional description",
    value: variable.description,
  });
  await deps.updateVariable(repo, variable.name, value, description);
  await deps.refreshVariables(repo);
}

export async function deleteVariable(
  deps: SecretsVariablesCommandsDeps,
  arg: unknown,
): Promise<void> {
  const repo = getRepo(deps, arg);
  const variable = arg instanceof VariableNode ? arg : undefined;
  if (!repo || !variable) {
    return;
  }
  const confirmed = await deps.showWarningMessage(
    `Delete variable ${variable.name}?`,
    { modal: true },
    "Delete",
  );
  if (confirmed !== "Delete") {
    return;
  }
  await deps.deleteVariable(repo, variable.name);
  await deps.refreshVariables(repo);
}
