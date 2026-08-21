# Upstream Readiness

This repository is structured so that its automated quality gates and
contributor workflow are independent of its current hosting organization.

## In-repository guarantees

- `make check` runs the fast quality gate: unused-dependency checking,
  type-aware linting, formatting, unit/mock integration tests, packaging, and
  a moderate-or-higher dependency audit.
- `make verify` adds both VS Code extension-host suites: one against the mock
  Gitea server and one against the local Gitea fixture.
- CI runs the same source, package, coverage, and extension-host checks on
  every pull request targeting `main`.
- Release automation requires a clean `main` checkout and validates before it
  creates a version commit or tag.

## Decisions that need maintainer authority

An organizational transfer or official publication needs decisions that cannot
be made from this repository alone:

- The target forge, publisher identity, and extension IDs.
- Maintainer, review, signing, and release permissions.
- The private channel used for security reports.
- Marketplace and Open VSX ownership transfer and token rotation.
- The project code of conduct and any organization-wide contributor agreement.

Until those decisions are made, source changes should remain portable and must
not assume a particular personal account or private contact address.
