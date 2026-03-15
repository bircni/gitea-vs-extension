/**
 * Unit tests for secrets/variables command handlers and argument normalization.
 */
import {
  refreshSecrets,
  refreshVariables,
  type SecretsVariablesCommandsDeps,
} from "../controllers/secretsVariablesCommands";
import type { RepoRef } from "../gitea/models";

const mockRepo: RepoRef = { host: "gitea.example.com", owner: "o", name: "n" };

const baseDeps: SecretsVariablesCommandsDeps = {
  getCurrentRepo: jest.fn().mockReturnValue(undefined),
  setSecretsLoading: jest.fn(),
  setSecrets: jest.fn(),
  setSecretsError: jest.fn(),
  setVariablesLoading: jest.fn(),
  setVariables: jest.fn(),
  setVariablesError: jest.fn(),
  listSecrets: jest.fn().mockResolvedValue([]),
  listVariables: jest.fn().mockResolvedValue([]),
  createOrUpdateSecret: jest.fn().mockResolvedValue(undefined),
  deleteSecret: jest.fn().mockResolvedValue(undefined),
  createVariable: jest.fn().mockResolvedValue(undefined),
  updateVariable: jest.fn().mockResolvedValue(undefined),
  deleteVariable: jest.fn().mockResolvedValue(undefined),
  showInputBox: jest.fn().mockResolvedValue(undefined),
  showWarningMessage: jest.fn().mockResolvedValue(undefined),
  refreshSecrets: jest.fn().mockResolvedValue(undefined),
  refreshVariables: jest.fn().mockResolvedValue(undefined),
};

describe("refreshSecrets", () => {
  it("does nothing when repo cannot be resolved", async () => {
    await refreshSecrets(baseDeps, undefined);
    expect(baseDeps.listSecrets).not.toHaveBeenCalled();
  });

  it("calls listSecrets and setSecrets when repo is provided via getCurrentRepo", async () => {
    const setSecrets = jest.fn();
    const listSecrets = jest.fn().mockResolvedValue([{ name: "x" }]);
    await refreshSecrets(
      {
        ...baseDeps,
        getCurrentRepo: () => mockRepo,
        setSecrets,
        listSecrets,
      },
      undefined,
    );
    expect(listSecrets).toHaveBeenCalledWith(mockRepo);
    expect(setSecrets).toHaveBeenCalledWith([{ name: "x" }]);
  });
});

describe("refreshVariables", () => {
  it("does nothing when repo cannot be resolved", async () => {
    await refreshVariables(baseDeps, undefined);
    expect(baseDeps.listVariables).not.toHaveBeenCalled();
  });

  it("calls listVariables and setVariables when repo is provided", async () => {
    const setVariables = jest.fn();
    const listVariables = jest.fn().mockResolvedValue([{ name: "y" }]);
    await refreshVariables(
      {
        ...baseDeps,
        getCurrentRepo: () => mockRepo,
        setVariables,
        listVariables,
      },
      undefined,
    );
    expect(listVariables).toHaveBeenCalledWith(mockRepo);
    expect(setVariables).toHaveBeenCalledWith([{ name: "y" }]);
  });
});
