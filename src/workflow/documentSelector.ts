/**
 * Which documents the workflow language server is attached to, and whether we may claim
 * `.github/workflows` — Gitea reads workflows from both `.gitea/workflows` and `.github/workflows`,
 * but the GitHub Actions extension also claims the latter.
 */

/** Gitea's own workflow folder; ours to claim unconditionally. */
export const GITEA_WORKFLOW_PATTERN = "**/.gitea/workflows/*.{yaml,yml}";

/** Also read by Gitea, but shared with `github.vscode-github-actions`. */
export const GITHUB_WORKFLOW_PATTERN = "**/.github/workflows/*.{yaml,yml}";

/** Composite action metadata, same schema on both platforms. */
export const ACTION_PATTERN = "**/action.{yaml,yml}";

export const LANGUAGE_ID = "gitea-actions-workflow";

export type GithubFolderLanguage = "auto" | "always" | "never";

/**
 * Whether to set our language on a file under `.github/workflows`. `auto` yields to the GitHub
 * Actions extension when it is installed, so the two never fight over the same document.
 */
export function shouldClaimGithubFolder(
  mode: GithubFolderLanguage,
  githubExtensionInstalled: boolean,
): boolean {
  switch (mode) {
    case "always": {
      return true;
    }
    case "never": {
      return false;
    }
    default: {
      return !githubExtensionInstalled;
    }
  }
}

/** True for a path VS Code would not already have given our language via `filenamePatterns`. */
export function isGithubWorkflowPath(fsPath: string): boolean {
  const normalized = fsPath.replaceAll("\\", "/");
  return /\/\.github\/workflows\/[^/]+\.ya?ml$/.test(normalized);
}
