# Gitea VS Extension

Monitor Gitea Actions & Pull Requests without leaving your editor.

Works with VS Code, Cursor, VSCodium, Windsurf, and other VS Code compatible editors.

## Features

- Workflow runs with colored status icons
- Workflows grouped by branch
- Pull Requests view with author, labels, and last updated time
- Jobs and step logs with one click
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
- Reading Actions runs, jobs, artifacts
- Reading pull requests
- Managing secrets/variables if you want to use the Settings view for those actions

If you do not plan to manage secrets or variables, you can use a read-only token.

## How It Works

- Discovers repositories from your workspace git remotes or API (based on discovery mode).
- Polls for workflow runs and pull requests using an adaptive refresh interval.
- Loads jobs, steps, artifacts, secrets, and variables only when you expand a node.
- Uses the built-in SecretStorage to keep your token off disk.

## Tree Views

### Workflows

Groups runs by branch so you can scan what is active per branch.

### Pull Requests

Lists open PRs per repository with author, labels, and last updated time.

### Workflow Runs

Recent workflow runs for the current local branch per repository. Expand a run to load jobs and steps on demand.
If the extension cannot determine a repository's current local branch (for example detached HEAD or no local checkout), the view shows a warning node for that repository.

### Settings

Manage token, test connection, and edit secrets and variables.

## Configuration

| Setting                                             | Default     | Description                             |
| --------------------------------------------------- | ----------- | --------------------------------------- |
| `gitea-vs-extension.baseUrl`                        | -           | Base URL of your Gitea instance         |
| `gitea-vs-extension.discovery.mode`                 | `workspace` | How to discover repositories            |
| `gitea-vs-extension.refresh.runningIntervalSeconds` | `15`        | Polling interval while runs are active  |
| `gitea-vs-extension.refresh.idleIntervalSeconds`    | `60`        | Polling interval while idle             |
| `gitea-vs-extension.maxRunsPerRepo`                 | `20`        | Maximum runs to fetch per repository    |
| `gitea-vs-extension.maxJobsPerRun`                  | `50`        | Maximum jobs to fetch per run           |
| `gitea-vs-extension.tls.insecureSkipVerify`         | `false`     | Skip TLS verification (not recommended) |
| `gitea-vs-extension.logging.debug`                  | `false`     | Enable debug logging                    |

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

## Contributing

See `CONTRIBUTING.md`.

## License

MIT. See `LICENSE`.
