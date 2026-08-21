/**
 * Unit tests for workflow language document selection and the language server init options.
 */
import type * as vscode from "vscode";
import {
  isGithubWorkflowPath,
  LANGUAGE_ID,
  shouldClaimGithubFolder,
} from "../workflow/documentSelector";
import { claimGithubWorkflowDocument, type DocumentTrackerDeps } from "../workflow/documentTracker";
import { buildInitializationOptions } from "../workflow/initializationOptions";

function makeDocument(fsPath: string, languageId = "yaml"): vscode.TextDocument {
  return {
    languageId,
    uri: { scheme: "file", fsPath },
  } as unknown as vscode.TextDocument;
}

function makeDeps(overrides: Partial<DocumentTrackerDeps> = {}): DocumentTrackerDeps {
  return {
    getMode: () => "auto",
    isGithubExtensionInstalled: () => false,
    setLanguage: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("shouldClaimGithubFolder", () => {
  it("yields to the GitHub Actions extension on auto", () => {
    expect(shouldClaimGithubFolder("auto", true)).toBe(false);
    expect(shouldClaimGithubFolder("auto", false)).toBe(true);
  });

  it("honours the explicit overrides regardless of the other extension", () => {
    expect(shouldClaimGithubFolder("always", true)).toBe(true);
    expect(shouldClaimGithubFolder("never", false)).toBe(false);
  });
});

describe("isGithubWorkflowPath", () => {
  it.each([
    ["/repo/.github/workflows/ci.yml", true],
    ["/repo/.github/workflows/ci.yaml", true],
    [String.raw`C:\repo\.github\workflows\ci.yml`, true],
    ["/repo/.github/workflows/nested/ci.yml", false],
    ["/repo/.gitea/workflows/ci.yml", false],
    ["/repo/.github/ci.yml", false],
    ["/repo/.github/workflows/README.md", false],
  ])("%s -> %s", (fsPath, expected) => {
    expect(isGithubWorkflowPath(fsPath)).toBe(expected);
  });
});

describe("claimGithubWorkflowDocument", () => {
  it("sets our language on a .github workflow when nothing else claims it", () => {
    const deps = makeDeps();

    expect(claimGithubWorkflowDocument(deps, makeDocument("/repo/.github/workflows/ci.yml"))).toBe(
      true,
    );
    expect(deps.setLanguage).toHaveBeenCalled();
  });

  it("leaves the document alone when the GitHub extension is installed", () => {
    const deps = makeDeps({ isGithubExtensionInstalled: () => true });

    expect(claimGithubWorkflowDocument(deps, makeDocument("/repo/.github/workflows/ci.yml"))).toBe(
      false,
    );
    expect(deps.setLanguage).not.toHaveBeenCalled();
  });

  it("ignores documents that already have our language", () => {
    const deps = makeDeps();
    const document = makeDocument("/repo/.github/workflows/ci.yml", LANGUAGE_ID);

    expect(claimGithubWorkflowDocument(deps, document)).toBe(false);
    expect(deps.setLanguage).not.toHaveBeenCalled();
  });

  it("ignores non-file schemes such as a diff or git view", () => {
    const deps = makeDeps();
    const document = {
      languageId: "yaml",
      uri: { scheme: "git", fsPath: "/repo/.github/workflows/ci.yml" },
    } as unknown as vscode.TextDocument;

    expect(claimGithubWorkflowDocument(deps, document)).toBe(false);
  });

  it("ignores files outside .github/workflows", () => {
    const deps = makeDeps();

    expect(claimGithubWorkflowDocument(deps, makeDocument("/repo/src/index.ts"))).toBe(false);
    expect(deps.setLanguage).not.toHaveBeenCalled();
  });
});

describe("buildInitializationOptions", () => {
  it("never sends credentials or a repository context to the server", () => {
    const options = buildInitializationOptions(false);

    // Passing any of these would make the server talk to github.com with a Gitea token.
    expect(options.sessionToken).toBeUndefined();
    expect(options.repos).toBeUndefined();
    expect(options.gitHubApiUrl).toBeUndefined();
  });

  it("raises the log level with the debug logging setting", () => {
    expect(buildInitializationOptions(false).logLevel).toBe(2);
    expect(buildInitializationOptions(true).logLevel).toBe(0);
  });
});
