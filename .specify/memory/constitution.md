<!--
Sync Impact Report

- Version change: (template) → 1.0.0
- Modified principles: Initial ratification for this project
- Added sections:
  - Core Principles
  - Additional Constraints & Technical Standards
  - Development Workflow, Review Process & Quality Gates
  - Governance
- Removed sections: None (template placeholders replaced)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check section remains valid and references this constitution conceptually)
  - ✅ .specify/templates/spec-template.md (User stories and requirements remain compatible with principles)
  - ✅ .specify/templates/tasks-template.md (User-story-first task grouping aligns with specification-driven principle)
  - ✅ README.md (Runtime guidance already aligned: security, discovery, and performance behaviour)
  - ⚠ .specify/templates/commands/ (no command templates defined; create and align with this constitution if added later)
- Follow-up TODOs:
  - None; all placeholder tokens in this file have been resolved.
-->

# Gitea VS Extension Constitution

## Core Principles

### I. In-Editor Workflow Visibility

The extension MUST make Gitea workflows and pull requests observable without leaving the editor.  
Primary user journeys (viewing workflows, inspecting runs, scanning pull requests, and managing
secrets/variables) MUST be reachable from the activity bar with minimal clicks and clear labels.  
Views MUST prioritize quick scanning: statuses, authors, branches, and recency are first-class, with
details progressively disclosed on demand.  
Any new feature MUST explicitly state how it improves in-editor awareness or reduces context switching.

### II. Secure, Minimal Gitea Access

Tokens MUST be stored using the host editor’s secure storage (for VS Code-compatible editors, SecretStorage)
and MUST NOT be written to disk in plaintext.  
The extension MUST request and document the minimum Gitea scopes required for each capability; optional
capabilities (for example, managing secrets/variables) MUST be clearly tied to additional scopes.  
Configuration options such as `tls.insecureSkipVerify` MUST default to safe values and MUST be called out
as risky when enabled, including guidance in the UI and documentation.  
Network calls MUST respect Gitea API limits and error responses, failing safely without leaking sensitive
data in logs or error messages.

### III. Reliability, Observability & Safe Failure

The extension MUST handle transient network failures, authentication issues, and API errors gracefully,
communicating clear, actionable status to users instead of silent failures.  
Adaptive polling MUST be implemented so that active states are refreshed quickly and idle states poll less
frequently, with behaviour documented and testable.  
All background operations that can fail (polling, loading runs, loading logs, secrets/variables operations)
MUST emit structured log entries suitable for debugging when debug logging is enabled.  
Failure modes (for example, invalid token, unreachable server, schema changes in Gitea) MUST degrade
gracefully: core views remain usable where possible, and users are guided to fix configuration instead of
being blocked without explanation.

### IV. Performance & Responsiveness

The extension MUST feel responsive on typical repositories and network conditions; operations that might be
slow (such as loading large logs or many runs) MUST be lazy-loaded and cancellable where supported by the
editor APIs.  
Polling intervals, maximum runs per repository, and maximum jobs per run MUST have sensible defaults that
balance freshness with resource usage, and these MUST remain configurable via settings.  
Any feature that can significantly increase API or resource usage (for example, automatic log expansion)
MUST be opt-in or carefully bounded, with clear documentation.  
Performance regressions identified by contributors or users MUST be treated as first-class issues and
triaged alongside feature work.

### V. Specification-Driven, Testable Delivery

New non-trivial changes (for example, new views, workflows, or configuration surfaces) SHOULD be introduced
through the SpecKit flow: `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`, using the templates in
`.specify/templates/`.  
User stories in specs MUST describe independently testable journeys (for example, “monitor workflow runs for
a single repository”) that can be implemented and demonstrated in isolation.  
Plans MUST define how behaviour will be exercised (manual flows and, where feasible, automated tests such as
unit tests, integration tests against mock or local Gitea, or contract-style API checks).  
Tasks MUST map back to user stories and requirements, making it possible to trace a shipped change to its
specification and to verify that acceptance criteria are met.

## Additional Constraints & Technical Standards

The extension MUST target VS Code-compatible environments and follow their extension API guidelines,
including activation events, contribution points, and workspace trust requirements.  
TypeScript SHOULD be the primary implementation language, with strict compiler options and linting enforced
for new code.  
Configuration keys (for example, `gitea-vs-extension.baseUrl`) MUST remain stable once released; any
breaking changes require a major version bump of the extension and a migration path.  
Error messages shown to users MUST be concise, avoid leaking sensitive information, and link to relevant
documentation or troubleshooting steps when appropriate.  
All new features MUST document their settings and behaviour in `README.md` (or a more detailed
documentation file referenced from it) before being considered complete.

## Development Workflow, Review Process & Quality Gates

Contributors SHOULD start significant changes by creating or updating a feature specification using
`.specify/templates/spec-template.md`, deriving user stories and acceptance criteria.  
An implementation plan based on `.specify/templates/plan-template.md` SHOULD be created for medium and large
features, capturing technical context, project structure decisions, and a Constitution Check that explicitly
confirms alignment with the principles in this document.  
Tasks for implementation SHOULD be generated or refined using `.specify/templates/tasks-template.md`, grouped
by user story to enable incremental delivery and clear review boundaries.  
Every pull request MUST:

- Reference its spec/plan/tasks (if applicable).  
- Explain how it adheres to the Core Principles (especially security, reliability, and performance).  
- Include tests or manual verification notes that exercise the relevant user stories.

Code review MUST verify that new code and configuration respect the principles in this constitution; if a
principle is intentionally bent or violated, the pull request MUST document the justification and any
mitigations.

## Governance

This constitution defines the non-negotiable principles and workflow expectations for the Gitea VS
Extension. Where it conflicts with prior habits or undocumented practices, this document takes precedence.  
Amendments to the constitution MUST be proposed via pull request modifying `.specify/memory/constitution.md`
with:

- A clear description of the motivation and impact.  
- An updated Sync Impact Report at the top of the file.  
- An updated version number consistent with the semantic rules below.  
- Any necessary updates to templates, documentation, or tooling referenced here.

Versioning of this constitution follows semantic rules:

- **MAJOR**: Backward-incompatible changes to principles or governance (for example, removing a principle,
  redefining security guarantees, or changing amendment requirements).  
- **MINOR**: New principles or sections, or material expansion of existing ones that introduce new
  obligations.  
- **PATCH**: Clarifications, wording improvements, and typo fixes that do not change intent.

When a change is merged, the **Last Amended** date MUST be set to the merge date in ISO format
`YYYY-MM-DD`. Ratification date remains the date of initial adoption unless the project is rebooted with
a fundamentally new governance model, in which case a new MAJOR version and ratification date MAY be chosen
via explicit maintainer agreement.

All maintainers and contributors are expected to keep this constitution in mind when proposing, reviewing,
and implementing changes. Features that cannot reasonably comply MUST document their deviations and, where
appropriate, trigger an amendment to this document.

**Version**: 1.0.0 | **Ratified**: 2026-03-13 | **Last Amended**: 2026-03-13
