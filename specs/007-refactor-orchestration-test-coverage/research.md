# Research: Refactor core orchestration and test coverage

**Branch**: `007-refactor-orchestration-test-coverage`  
**Phase**: 0 (Outline & Research)

All technical context is known from the existing codebase and AGENTS.md; no NEEDS CLARIFICATION remained. This document records decisions and rationale for the refactor approach.

---

## 1. Extraction order (which module first)

**Decision**: Extract and test in this order: (1) tree provider helpers, (2) refresh controller helpers, (3) commands split, (4) extension.ts bootstrap, (5) coverage config and new tests.

**Rationale**: The issue and spec recommend starting with `actionsTreeProvider.ts` because it has high branching and relatively low editor API coupling, so helpers can be unit-tested with mock store data. Refresh controller is next so state transitions and summary logic are verifiable without full integration. Splitting commands after those seams reduces the amount of command-specific mocking. Simplifying `extension.ts` after controllers/views have clear boundaries keeps activation wiring straightforward. Coverage config is updated once the new seams exist so inclusion of controllers/views does not drop coverage.

**Alternatives considered**: Doing commands first was rejected because the single large class has many VS Code dependencies; extracting tree/refresh first creates smaller, testable boundaries. Doing extension.ts first was rejected because it would orchestrate unchanged monoliths.

---

## 2. Pure-helpers-first strategy

**Decision**: Prefer extracting pure (or mostly pure) helpers first, leaving thin VS Code-facing orchestration classes that call those helpers. New logic in helpers; orchestration layers only wire editor APIs to helpers and store.

**Rationale**: Pure functions are easy to test (inputs → outputs), do not require full VS Code mocks for core behavior, and keep orchestration layers small and readable. Constitution and spec both require testable delivery; this strategy maximizes automated test coverage where it matters most.

**Alternatives considered**: Keeping logic inside controllers/views and only adding integration tests was rejected because it would require heavy mocking and would not improve maintainability as much as extracted helpers.

---

## 3. Testing and mocking strategy

**Decision**: Use existing Jest + `src/test/__mocks__/vscode.ts` for all new tests. Unit tests for helpers use plain data (e.g. store shape, filter context) and assert on return values or state transitions. Command-handler tests pass normalized arguments and assert on side effects via mocks (e.g. `executeCommand`, `window.show*`). Tree-builder tests pass mock store entries and assert on structure (nodes, labels, order). No new test runner or mock framework.

**Rationale**: Project already uses Jest and VS Code mock; adding another stack would conflict with Constitution (technical standards) and AGENTS.md. Mocking at the VS Code API boundary is sufficient for command and tree tests; helpers need no VS Code at all.

**Alternatives considered**: Integration tests against a real Gitea instance were considered out of scope for this refactor (spec allows manual verification and existing validation suite).

---

## 4. Coverage configuration

**Decision**: After new helper modules and tests exist, update `jest.config.ts` to remove or narrow `collectCoverageFrom` exclusions for `src/controllers/**` and `src/views/**` (and optionally `src/extension.ts` or `src/config/**` only where covered). Set or adjust coverage thresholds only after new tests land so that the transition does not fail the build.

**Rationale**: Spec and issue state that coverage should include orchestration code once seams are testable; removing exclusions before adding tests would lower reported coverage. Incremental approach matches “each increment leaves repo in a passing state.”

**Alternatives considered**: Leaving exclusions in place was rejected because it would not meet FR-005 / SC-002.

---

## 5. Command-unit boundaries

**Decision**: Split commands into coherent units as suggested in the spec: command registration map, artifact actions, log actions, secrets/variables actions, browser/clipboard actions. Registration remains the single place that binds command IDs to handlers; each handler group can live in its own module or class and be tested in isolation.

**Rationale**: Single-responsibility units reduce coupling and allow targeted tests. Registration map stays in one place so that contribution points in `package.json` and code stay in sync.

**Alternatives considered**: Splitting by “read vs write” or by “Gitea API vs local” was considered less aligned with the spec’s suggested grouping (artifact, log, secrets/variables, browser/clipboard).

---

## 6. Incremental delivery and PR boundaries

**Decision**: Multiple PRs are acceptable. Suggested PR breakdown (from issue): (1) Tree-building helpers + tests, (2) Refresh/state-transition helpers + tests, (3) Commands split + tests, (4) extension.ts bootstrap + smoke tests, (5) Coverage config and threshold tuning. Each PR must leave `npm run validate` passing.

**Rationale**: Spec assumptions and Constitution support incremental delivery; smaller PRs ease review and reduce risk of behavior regression.

**Alternatives considered**: Single large PR was rejected for maintainability and review load.
