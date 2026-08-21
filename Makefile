NPM ?= npm

.DEFAULT_GOAL := help

.PHONY: help install clean fmt fmt-check lint test test-integration coverage build package audit check e2e e2e-gitea verify release

help: ## Show the available development targets.
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install the locked dependency set.
	$(NPM) ci

clean: ## Remove generated build artifacts.
	$(NPM) run clean

fmt: ## Format the repository.
	$(NPM) run format:write

fmt-check: ## Check formatting without modifying files.
	$(NPM) run format

lint: ## Run unused-dependency and type-aware lint checks.
	$(NPM) run check-unused
	$(NPM) run lint

test: ## Run unit and hermetic mock-integration tests.
	$(NPM) test

test-integration: ## Run only hermetic Gitea API integration tests.
	$(NPM) run test:integration

coverage: ## Run tests with coverage thresholds enabled.
	$(NPM) run test:coverage

build: ## Compile, bundle, and package the VSIX artifact.
	$(NPM) run build

package: ## Create the distributable VSIX artifact.
	$(NPM) run package

audit: ## Fail on moderate-or-higher dependency vulnerabilities.
	$(NPM) run audit

check: ## Run the fast, repository-wide quality gate.
	$(NPM) run validate
	$(NPM) run audit

e2e: ## Run VS Code extension-host tests against the mock server.
	$(NPM) run test:e2e

e2e-gitea: ## Run VS Code extension-host tests against the local Gitea fixture.
	$(NPM) run test:e2e:gitea

verify: check coverage e2e e2e-gitea ## Run every automated gate used by CI.

release: ## Prepare a checked release commit and tag from main.
	$(NPM) run release
