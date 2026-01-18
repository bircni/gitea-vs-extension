# Contributing to Gitea VS Extension

Thanks for your interest in contributing. This guide covers local setup, scripts, and structure.

## Prerequisites

- Node.js 18+
- Yarn 4+
- VS Code or Cursor

## Getting Started

```bash
git clone https://github.com/bircni/gitea-vs-extension.git
cd gitea-vs-extension
yarn install
```

## Build and Run

```bash
# Build TypeScript
yarn compile

# Watch mode
yarn watch
```

### Run the Extension

1. Open the project in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. The extension activates in the new window.

## Scripts

| Script              | Description                   |
| ------------------- | ----------------------------- |
| `yarn compile`      | Build TypeScript to `dist/`   |
| `yarn watch`        | Build and watch for changes   |
| `yarn lint`         | Run ESLint                    |
| `yarn format`       | Check formatting              |
| `yarn format:write` | Auto format files             |
| `yarn test`         | Run unit tests                |
| `yarn test:watch`   | Run tests in watch mode       |
| `yarn coverage`     | Run tests with coverage       |
| `yarn bundle`       | Bundle extension with esbuild |
| `yarn package`      | Create a VSIX package         |
| `yarn build`        | Compile, bundle, and package  |

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
yarn test
yarn test:watch
yarn coverage
```

## Code Style

- TypeScript strict mode
- ESLint and Prettier
- Prefer explicit types and async/await

## Packaging

```bash
yarn build
```

## Questions

Open an issue or start a discussion in the repository.
