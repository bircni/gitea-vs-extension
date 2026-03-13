# Contributing to Gitea VS Extension

Thanks for your interest in contributing. This guide covers local setup, scripts, and structure.

## Prerequisites

- Node.js 24 (see `.node-version` in the repo root)
- npm
- VS Code or Cursor

## Getting Started

```bash
git clone https://github.com/bircni/gitea-vs-extension.git
cd gitea-vs-extension
npm install
```

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

## Scripts

| Script                 | Description                   |
| ---------------------- | ----------------------------- |
| `npm run compile`      | Build TypeScript to `dist/`   |
| `npm run watch`        | Build and watch for changes   |
| `npm run lint`         | Run ESLint                    |
| `npm run format`       | Check formatting              |
| `npm run format:write` | Auto format files             |
| `npm test`             | Run unit tests                |
| `npm run test:watch`   | Run tests in watch mode       |
| `npm run coverage`     | Run tests with coverage       |
| `npm run bundle`       | Bundle extension with esbuild |
| `npm run package`      | Create a VSIX package         |
| `npm run build`        | Compile, bundle, and package  |

## Project Structure

```text
src/
  config/        Settings and token storage
  controllers/   Command wiring and refresh controller
  gitea/         API client, models, discovery
  test/          Jest tests
  util/          Logging, time helpers, caching
  views/         Tree providers and nodes
  extension.ts   Extension entry point
```

## Testing

Tests use Jest and live in `src/test`.

```bash
npm test
npm run test:watch
npm run coverage
```

## Code Style

- TypeScript strict mode
- ESLint and Prettier
- Prefer explicit types and async/await

## Packaging

```bash
npm run build
```

## Questions

Open an issue or start a discussion in the repository.
