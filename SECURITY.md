# Security Policy

## Supported versions

Security fixes are made for the current development branch and the most recent
published extension version. Older versions may be fixed when the impact and
maintainer capacity justify it.

## Reporting a vulnerability

Please do not disclose a suspected vulnerability through a public issue,
discussion, pull request, or review comment.

Use the private security-reporting facility of the repository's hosting forge.
If that facility is unavailable, contact a project maintainer through an
existing private channel and include enough detail to reproduce the issue.
Never include a real personal-access token, job log containing credentials, or
other secret in a report.

Reports are most useful when they include:

- A clear impact statement and affected extension version(s).
- Reproduction steps or a minimal proof of concept.
- Relevant configuration, with hosts and secrets redacted.
- Any suggested mitigation or regression test.

Maintainers will acknowledge receipt, assess the report privately, and
coordinate a fix and disclosure timeline with the reporter where possible.

## Security boundaries

The extension stores tokens in VS Code SecretStorage and sends them only to the
configured Gitea instance. Changes to token routing, URL handling, filesystem
writes, command execution, log/artifact handling, and workflow parsing need
particular security review.
