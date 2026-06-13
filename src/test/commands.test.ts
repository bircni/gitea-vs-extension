/**
 * Unit tests for CommandsController registration and command delegation.
 */
import * as vscode from "vscode";
import { CommandsController } from "../controllers/commands";
import type { RepoRef } from "../gitea/models";
import type { Mock } from "vitest";

const mockRepo: RepoRef = { host: "gitea.example", owner: "o", name: "n" };

function createMockContext(): vscode.ExtensionContext {
  return {
    secrets: {} as vscode.SecretStorage,
    globalState: {} as vscode.Memento,
    globalStorageUri: { fsPath: "/tmp" } as vscode.Uri,
    extensionUri: {} as vscode.Uri,
    extensionPath: "",
    environmentVariableCollection: {} as vscode.GlobalEnvironmentVariableCollection,
    asAbsolutePath: (p: string) => p,
    storageUri: undefined,
    storagePath: undefined,
    globalStoragePath: "",
    logPath: "",
    extensionMode: 1,
    subscriptions: [] as vscode.Disposable[],
    workspaceState: {} as vscode.Memento,
  } as vscode.ExtensionContext;
}

describe("CommandsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("register() returns an array of disposables", () => {
    const refreshAll = vi.fn();
    const store = {
      getRepos: () => [] as RepoRef[],
      getEntry: () => {},
      getBranchContext: () => {},
      getBranchFilter: () => {},
    };
    const treeProvider = { refresh: vi.fn() };
    const settingsProvider = { getCurrentRepo: () => {}, setTokenStatus: vi.fn() };
    const controller = new CommandsController(
      createMockContext(),
      {} as never,
      { refreshAll } as never,
      store as never,
      treeProvider as never,
      settingsProvider as never,
    );
    const disposables = controller.register();
    expect(Array.isArray(disposables)).toBe(true);
    expect(disposables.length).toBeGreaterThan(0);
    for (const d of disposables) {
      expect(d).toHaveProperty("dispose");
    }
  });

  it("refresh command calls refreshController.refreshAll()", async () => {
    const refreshAll = vi.fn();
    const store = {
      getRepos: () => [] as RepoRef[],
      getEntry: () => {},
      getBranchContext: () => {},
      getBranchFilter: () => {},
    };
    const treeProvider = { refresh: vi.fn() };
    const settingsProvider = { getCurrentRepo: () => {}, setTokenStatus: vi.fn() };
    const controller = new CommandsController(
      createMockContext(),
      {} as never,
      { refreshAll } as never,
      store as never,
      treeProvider as never,
      settingsProvider as never,
    );
    controller.register();
    const call = (vscode.commands.registerCommand as Mock).mock.calls.find(
      (c: [string]) => c[0] === "gitea-vs-extension.refresh",
    );
    expect(call).toBeDefined();
    const handler = call[1];
    await handler();
    expect(refreshAll).toHaveBeenCalled();
  });

  it("registers all expected command ids", () => {
    const refreshAll = vi.fn();
    const store = {
      getRepos: () => [] as RepoRef[],
      getEntry: () => {},
      getBranchContext: () => {},
      getBranchFilter: () => {},
    };
    const treeProvider = { refresh: vi.fn() };
    const settingsProvider = { getCurrentRepo: () => {}, setTokenStatus: vi.fn() };
    const controller = new CommandsController(
      createMockContext(),
      {} as never,
      { refreshAll } as never,
      store as never,
      treeProvider as never,
      settingsProvider as never,
    );
    controller.register();
    const registeredIds = (vscode.commands.registerCommand as Mock).mock.calls.map(
      (c: [string]) => c[0],
    );
    expect(registeredIds).toContain("gitea-vs-extension.refresh");
    expect(registeredIds).toContain("gitea-vs-extension.viewJobLogs");
    expect(registeredIds).toContain("gitea-vs-extension.openInBrowser");
    expect(registeredIds).toContain("gitea-vs-extension.setToken");
    expect(registeredIds).toContain("gitea-vs-extension.refreshSecrets");
    expect(registeredIds).toContain("gitea-vs-extension.downloadArtifact");
  });
});
