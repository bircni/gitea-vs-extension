# Gitea VS Extension

Monitor Gitea Actions & Pull Requests without leaving your editor.

Works with VS Code, Cursor, VSCodium, Windsurf, and other VS Code compatible editors.

## Features

- Workflow runs with colored status icons
- Workflows grouped by branch
- Pull Requests view with author, labels, and last updated time
- Inline pull request review comments, including adding a new review comment from the editor context menu
- Workflow file authoring: syntax highlighting, schema validation, expression checking, completion and hover docs
- Jobs and step logs with one click
- Re-run a workflow run, only its failed jobs, or a single job
- Download workflow artifacts from the tree (context menu); double-click an artifact to open it in the editor (or be prompted to download first)
- Secrets and variables management
- Adaptive polling (fast when active, slower when idle)
- Status bar summary for running and failed runs

## Quick Start

1. Install the extension (VSIX or marketplace, depending on your setup).
2. Set `gitea-vs-extension.baseUrl` to your Gitea instance (for example, `http://localhost:3000`).
3. Open the Gitea VS Extension activity bar view.
4. In Settings, set your personal access token and click Test Connection.

### Required Gitea Token Scopes

Use a personal access token with scopes that allow:

- Reading repositories
- Reading Actions runs, jobs, and artifacts
- Writing Actions, if you want to re-run runs or jobs
- Reading pull requests; write access to pull requests is required to add review comments from the editor
- Managing secrets/variables if you want to use the Settings view for those actions

If you do not plan to re-run runs or manage secrets or variables, you can use a read-only token.

### Re-running Runs and Jobs

Right click a run to **Re-run** it or to re-run just its **failed jobs**, and a job to re-run that
job alone. All three appear only where Gitea would accept them: re-run needs a finished run, and
re-run failed jobs needs a run that actually failed.

There is deliberately no **Cancel**: Gitea exposes no API endpoint for cancelling a run (verified
through 1.27.2), so it can only be done from the Gitea web UI. Deleting a run is likewise not
offered.

### Workflow File Authoring

Files under `.gitea/workflows/` get the **Gitea Actions Workflow** language: highlighting for the
workflow schema and for `${{ }}` expressions, validation of both, completion, and hover
documentation. Gitea also runs workflows from `.github/workflows/`, so those files get the same
treatment — unless the GitHub Actions extension is installed, in which case we leave them to it. Use
`gitea-vs-extension.workflows.githubFolderLanguage` to override that choice.

This runs entirely offline against a bundled language server; nothing is sent anywhere. The one
thing it cannot check is whether the inputs you pass to a `uses:` action are valid, because that
would mean fetching the action's metadata from github.com. Set
`gitea-vs-extension.workflows.languageServer.enabled` to `false` to turn the whole thing off.

## How It Works

- Discovers repositories from your workspace git remotes or API (based on discovery mode).
- Polls for workflow runs and pull requests using an adaptive refresh interval.
- Loads jobs, steps, artifacts, secrets, and variables only when you expand a node.
- Uses the built-in SecretStorage to keep your token off disk.

## Tree Views

### Workflows

Shows **all** workflow runs in the repo, grouped by branch. No branch filter is applied.

### Current Branch Runs

Shows workflow runs for your **current branch** only (when the repo is from your workspace). Use the branch filter (toolbar or context menu on the repo) to view another branch or all branches. Expand a run to load jobs and steps on demand. Under Artifacts, use the row buttons or context menu to **Download** or **Open in browser**; double-click an artifact to open the file in the editor if already downloaded, or see "Download the artifact first" otherwise.

### Pull Requests

Lists open PRs per repository with author, labels, and last updated time. Existing review comments are shown inline for the current branch. To add a new review comment, right click a line in a file on a branch with an open PR and run `gitea-vs-extension: Add Review Comment`.

### Settings

Manage token, test connection, and edit secrets and variables.

## Configuration

| Setting                                               | Default                 | Description                                         |
| ----------------------------------------------------- | ----------------------- | --------------------------------------------------- |
| `gitea-vs-extension.baseUrl`                          | -                       | Base URL of your Gitea instance                     |
| `gitea-vs-extension.discovery.mode`                   | `workspace`             | How to discover repositories                        |
| `gitea-vs-extension.refresh.runningIntervalSeconds`   | `15`                    | Polling interval while runs are active              |
| `gitea-vs-extension.refresh.idleIntervalSeconds`      | `60`                    | Polling interval while idle                         |
| `gitea-vs-extension.maxRunsPerRepo`                   | `20`                    | Maximum runs to fetch per repository                |
| `gitea-vs-extension.maxJobsPerRun`                    | `50`                    | Maximum jobs to fetch per run                       |
| `gitea-vs-extension.tls.insecureSkipVerify`           | `false`                 | Skip TLS verification (not recommended)             |
| `gitea-vs-extension.logging.debug`                    | `false`                 | Enable debug logging                                |
| `gitea-vs-extension.artifacts.downloadPath`           | `.tmp/gitea-artifacts/` | Base directory for downloaded workflow artifacts    |
| `gitea-vs-extension.workflows.languageServer.enabled` | `true`                  | Validate and auto-complete workflow files           |
| `gitea-vs-extension.workflows.githubFolderLanguage`   | `auto`                  | Claim `.github/workflows` (`auto`/`always`/`never`) |

### Discovery Modes

| Mode            | Description                                            |
| --------------- | ------------------------------------------------------ |
| `workspace`     | Discover repos from git remotes in your open workspace |
| `allAccessible` | Fetch all repos you can access via the Gitea API       |

## Tips

- Expand runs only when you need jobs or artifacts for faster refresh.
- Right click on items for context actions like Open in Browser.
- Click the status bar entry to jump to the extension view.

## Troubleshooting

- Connection fails: verify the base URL and token scopes, then run "Test Connection".
- Missing repos: check the discovery mode and ensure your git remotes match the Gitea host.
- Slow refresh: increase the idle interval or reduce max runs/jobs in settings.

## Security

Tokens are stored via VS Code SecretStorage and are never written to settings files.

## Testing (contributors)

- **`npm test`** — unit tests plus hermetic Gitea mock integration (`GiteaApi` over local HTTP); no real credentials.
- **`npm run test:integration`** — only the mock integration file.
- **Mock token** used in tests is the documented fake string `MOCK_GITEA_TOKEN` in `src/test/mock-gitea/fixture.ts` — **never commit a real Gitea PAT**; use env / CI secrets for live checks.
- **`npm run test:live`** — optional smoke against a real instance (`GITEA_BASE_URL`, optional `GITEA_TOKEN`, optional `GITEA_TLS_INSECURE`, `REQUIRE_LIVE_GITEA` for strict CI). See `specs/008-e2e-gitea-integration-testing/quickstart.md`.
- **`npm run test:e2e`** — VS Code extension host tests against the mock (after `npm run compile` and `npm run bundle`). See `src/test/e2e/README.md`.

## Contributing

See `CONTRIBUTING.md`.

## License

MIT. See `LICENSE`.

The workflow grammars in `language/` are vendored from
[github/vscode-github-actions](https://github.com/github/vscode-github-actions) (MIT); see
`language/NOTICE.md`.
