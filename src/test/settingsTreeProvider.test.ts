/**
 * Unit tests for SettingsTreeProvider.
 */
import { SettingsTreeProvider } from "../views/settingsTreeProvider";
import { ConfigRootNode, MessageNode, SecretsRootNode, VariablesRootNode } from "../views/nodes";
import type { RepoRef } from "../gitea/models";

const mockRepo: RepoRef = { host: "gitea.example", owner: "o", name: "n" };

describe("SettingsTreeProvider", () => {
  it("getChildren(undefined) returns message when no repo selected", () => {
    const provider = new SettingsTreeProvider();
    const children = provider.getChildren();
    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBe(1);
    expect(children[0]).toBeInstanceOf(MessageNode);
    expect((children[0] as MessageNode).label).toContain("Open a Gitea repository");
  });

  it("getChildren(undefined) returns roots after setRepository", () => {
    const provider = new SettingsTreeProvider();
    provider.setRepository(mockRepo);
    const children = provider.getChildren();
    expect(children.length).toBe(3);
    expect(children[0]).toBeInstanceOf(SecretsRootNode);
    expect(children[1]).toBeInstanceOf(VariablesRootNode);
    expect(children[2]).toBeInstanceOf(ConfigRootNode);
  });

  it("getChildren(SecretsRootNode) returns loading message when loading", () => {
    const provider = new SettingsTreeProvider();
    provider.setRepository(mockRepo);
    provider.setSecretsLoading();
    const roots = provider.getChildren();
    const secretsRoot = roots[0];
    const children = provider.getChildren(secretsRoot);
    expect(children.length).toBe(1);
    expect(children[0]).toBeInstanceOf(MessageNode);
    expect((children[0] as MessageNode).label).toContain("Loading");
  });

  it("getChildren(SecretsRootNode) returns secret nodes when secrets set", () => {
    const provider = new SettingsTreeProvider();
    provider.setRepository(mockRepo);
    provider.setSecrets([
      { name: "SECRET_A", description: "A secret" },
      { name: "SECRET_B", description: undefined },
    ]);
    const roots = provider.getChildren();
    const secretsRoot = roots[0];
    const children = provider.getChildren(secretsRoot);
    expect(children.length).toBe(2);
    expect(children[0].label).toBe("SECRET_A");
    expect(children[1].label).toBe("SECRET_B");
  });

  it("getTreeItem returns element as TreeItem", () => {
    const provider = new SettingsTreeProvider();
    const roots = provider.getChildren();
    expect(provider.getTreeItem(roots[0])).toBe(roots[0]);
  });
});
