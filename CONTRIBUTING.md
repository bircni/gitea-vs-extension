# Contributing to Gitea VS Extension

Thanks for your interest in contributing. Keep changes focused, reproducible,
and covered by the narrowest useful test; separate unrelated cleanup into its
own change.

## Prerequisites

- Node.js 24 (see `.node-version` in the repo root)
- npm
- VS Code or another compatible editor
- Docker, for the local Gitea extension-host fixture suite

## Getting Started

```bash
git clone https://github.com/bircni/gitea-vs-extension.git
cd gitea-vs-extension
npm ci
```

`npm ci` is the reproducible install path. Use `npm install` only when you
intend to change dependencies and the lockfile.

## Build and Run

```bash
# Build TypeScript
npm run compile

# Watch mode
npm run watch
```

### Run the Extension

1. Open the project in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. The extension activates in the new window.

## Canonical tasks

The top-level `Makefile` is the portable entry point for contributors and CI:

| Target           | Description                                                |
| ---------------- | ---------------------------------------------------------- |
| `make check`     | Fast quality gate: validate, package, and dependency audit |
| `make verify`    | Every automated gate, including both extension-host suites |
| `make e2e`       | VS Code extension-host tests against the mock server       |
| `make e2e-gitea` | VS Code extension-host tests against a local Gitea fixture |
| `make fmt`       | Format the repository                                      |
| `make release`   | Prepare a validated release commit and tag from `main`     |

Run `make help` to list all targets. The underlying npm scripts remain useful
for editor integrations and targeted local work.

## npm scripts

| Script                   | Description                   |
| ------------------------ | ----------------------------- |
| `npm run compile`        | Build TypeScript to `dist/`   |
| `npm run watch`          | Build and watch for changes   |
| `npm run lint`           | Run oxlint (type-aware)       |
| `npm run format`         | Check formatting              |
| `npm run format:write`   | Auto format files             |
| `npm test`               | Run unit tests                |
| `npm run test:watch`     | Run tests in watch mode       |
| `npm run test:coverage`  | Run tests with coverage       |
| `npm run bundle`         | Bundle extension with esbuild |
| `npm run package`        | Create a VSIX package         |
| `npm run build`          | Compile, bundle, and package  |
| `npm run validate`       | Full fast validation gate     |
| `npm run test:e2e`       | Extension-host mock suite     |
| `npm run test:e2e:gitea` | Extension-host Gitea fixture  |
| `npm run audit`          | Dependency vulnerability scan |

## Project Structure

```text
src/
  config/        Settings and token storage
  controllers/   Command wiring and refresh controller
  gitea/         API client, models, discovery
  test/          Vitest tests
  util/          Logging, time helpers, caching
  views/         Tree providers and nodes
  extension.ts   Extension entry point
```

## Testing

Tests use Vitest and live in `src/test`. Extension-host tests live in
`src/test/e2e` and require the compiled and bundled extension; their npm
scripts perform that preparation automatically.

```bash
npm test
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run test:e2e:gitea
```

Run `make check` before opening a pull request. Run `make verify` when the
change affects activation, commands, tree views, extension-host behavior,
packaging, or the Gitea API integration. The fixture suite starts local
containers and therefore needs Docker to be available.

## Code Style

- TypeScript strict mode
- oxlint and oxfmt
- Prefer explicit types and async/await

## Packaging

```bash
npm run build
```

Do not commit `dist/`; it is generated. CI packages the same VSIX that the
release workflow publishes.

## Pull requests

- Use a focused, descriptive title; Conventional Commit titles are preferred.
- Explain user-visible behavior and compatibility implications in the pull
  request body.
- Add or update tests for behavior changes, including regression coverage for
  bugs and security-sensitive changes.
- Keep tokens, instance URLs, logs, and other sensitive data out of commits,
  screenshots, and discussion.
- Address review feedback with follow-up commits that preserve a reviewable
  history until maintainers choose a merge strategy.

For a suspected vulnerability, follow [SECURITY.md](SECURITY.md) rather than
opening a public issue.

## Questions

Open an issue or start a discussion in the repository.
