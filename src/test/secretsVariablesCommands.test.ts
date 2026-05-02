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
  getCurrentRepo: vi.fn().mockReturnValue(undefined),
  setSecretsLoading: vi.fn(),
  setSecrets: vi.fn(),
  setSecretsError: vi.fn(),
  setVariablesLoading: vi.fn(),
  setVariables: vi.fn(),
  setVariablesError: vi.fn(),
  listSecrets: vi.fn().mockResolvedValue([]),
  listVariables: vi.fn().mockResolvedValue([]),
  createOrUpdateSecret: vi.fn().mockResolvedValue(undefined),
  deleteSecret: vi.fn().mockResolvedValue(undefined),
  createVariable: vi.fn().mockResolvedValue(undefined),
  updateVariable: vi.fn().mockResolvedValue(undefined),
  deleteVariable: vi.fn().mockResolvedValue(undefined),
  showInputBox: vi.fn().mockResolvedValue(undefined),
  showWarningMessage: vi.fn().mockResolvedValue(undefined),
  refreshSecrets: vi.fn().mockResolvedValue(undefined),
  refreshVariables: vi.fn().mockResolvedValue(undefined),
};

describe("refreshSecrets", () => {
  it("does nothing when repo cannot be resolved", async () => {
    await refreshSecrets(baseDeps, undefined);
    expect(baseDeps.listSecrets).not.toHaveBeenCalled();
  });

  it("calls listSecrets and setSecrets when repo is provided via getCurrentRepo", async () => {
    const setSecrets = vi.fn();
    const listSecrets = vi.fn().mockResolvedValue([{ name: "x" }]);
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
    const setVariables = vi.fn();
    const listVariables = vi.fn().mockResolvedValue([{ name: "y" }]);
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
