import * as vscode from "vscode";
import { getSettings } from "../config/settings";
import type { Mock } from "vitest";

function configuration(
  values: Record<string, unknown>,
  explicitValues: Record<string, unknown> = {},
): vscode.WorkspaceConfiguration {
  return {
    get: vi.fn((key: string) => values[key]),
    inspect: vi.fn((key: string) =>
      Object.hasOwn(explicitValues, key)
        ? { defaultValue: values[key], globalValue: explicitValues[key] }
        : undefined,
    ),
  } as unknown as vscode.WorkspaceConfiguration;
}

describe("getSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses legacy settings when modern settings only provide contributed defaults", () => {
    const modern = configuration({ baseUrl: "", maxRunsPerRepo: 20 });
    const legacy = configuration({ baseUrl: "https://legacy.example", maxRunsPerRepo: 99 });
    (vscode.workspace.getConfiguration as Mock).mockImplementation((section: string) =>
      section === "gitea-vs-extension" ? modern : legacy,
    );

    expect(getSettings()).toMatchObject({
      baseUrl: "https://legacy.example",
      maxRunsPerRepo: 99,
    });
  });

  it("prefers an explicitly configured modern setting over a legacy one", () => {
    const modern = configuration(
      { baseUrl: "", maxRunsPerRepo: 20 },
      { baseUrl: "https://modern.example", maxRunsPerRepo: 25 },
    );
    const legacy = configuration({ baseUrl: "https://legacy.example", maxRunsPerRepo: 99 });
    (vscode.workspace.getConfiguration as Mock).mockImplementation((section: string) =>
      section === "gitea-vs-extension" ? modern : legacy,
    );

    expect(getSettings()).toMatchObject({
      baseUrl: "https://modern.example",
      maxRunsPerRepo: 25,
    });
  });

  it("canonicalizes and de-duplicates valid configured instance URLs", () => {
    const modern = configuration(
      {
        baseUrl: "https://gitea.example/",
        instances: [
          "https://gitea.example",
          "https://other.example/",
          "ftp://not-gitea.example",
          "not a URL",
        ],
      },
      {
        baseUrl: "https://gitea.example/",
        instances: [
          "https://gitea.example",
          "https://other.example/",
          "ftp://not-gitea.example",
          "not a URL",
        ],
      },
    );
    const legacy = configuration({});
    (vscode.workspace.getConfiguration as Mock).mockImplementation((section: string) =>
      section === "gitea-vs-extension" ? modern : legacy,
    );

    expect(getSettings().instanceUrls).toEqual(["https://gitea.example", "https://other.example"]);
  });
});
