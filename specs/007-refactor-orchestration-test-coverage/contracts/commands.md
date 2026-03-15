# Contract: Command registration and handlers

**Branch**: `007-refactor-orchestration-test-coverage`  
**Consumers**: Extension activation, `package.json` contribution points, tree/view context menus

## Scope

Commands are the primary way users and the UI trigger extension behavior (refresh, view logs, branch filter, open in browser, secrets/variables, etc.). This contract describes how command IDs are bound to handlers and what signature handlers must satisfy so that context (e.g. selected repo or tree item) is passed correctly.

## Registration contract

- **Single registration point**: All `vscode.commands.registerCommand` calls for this extension’s commands MUST be performed from one registration layer (e.g. a function or class that receives the store and other services and registers every command).
- **Contribution points**: Every command ID registered in code MUST appear in `package.json` under `contributes.commands` (and optionally under `contributes.menus` for tree/item context menus).
- **First argument as context**: For commands that are invoked from a tree item or view (e.g. “Refresh” on a repo node), the handler MUST accept the first argument as the context (e.g. the tree item or repo reference) and use it to determine which repo or resource to act on. This avoids acting on the wrong repo in multi-repo workspaces (per AGENTS.md).

## Handler signature (advisory)

- **With context**: `(arg: T | undefined, ...rest: unknown[]) => void | Promise<void>`
  - `arg` is the value passed when the command is invoked from a tree item or view (e.g. `TreeItem` or repo identifier).
  - When the command is invoked from the command palette, `arg` may be `undefined`; the handler MUST resolve context from the current selection or a prompt if required.
- **Without context**: `() => void | Promise<void>` for commands that do not depend on selection (e.g. “Refresh all”).
- Handlers MAY be async; the extension host allows async command handlers.

## Command units (post-refactor)

Handlers are grouped into units (artifact, log, secrets/variables, browser/clipboard, etc.). Each unit:
- Exposes one or more handler functions.
- Is registered by the central registration layer.
- Can be tested in isolation by invoking the handler with a mock `arg` and asserting on side effects (mocked VS Code APIs, store updates, or returned values).

## Verification

- **Build-time**: Contribution points in `package.json` can be checked against the registration list (e.g. script or manual review).
- **Test-time**: Unit tests pass a known `arg` (e.g. repo ref or tree item) and verify the correct repo or resource is used (e.g. via mock calls).
- **Runtime**: Manual verification that context menu commands act on the selected item.
