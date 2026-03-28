# Gitea API Reference

This directory contains reference copies of the Gitea API specification files.

## Files

- `swagger.json` - Swagger UI HTML wrapper page
- `swagger.v1.json` - OpenAPI/Swagger 2.0 specification for Gitea API v1

## Purpose

These files are provided for development reference only. They help developers and AI coding assistants understand the Gitea API structure when working on this extension.

## Source

Refresh the API snapshot from [gitea.com](https://gitea.com) (whatever version it currently serves):

```bash
npm run update:swagger
```

Optional: set `GITEA_SWAGGER_BASE` to another origin (no trailing slash) to pull from a different instance.

Older copies were pinned to a specific release; your checkout may differ after an update.

## Note

These files are not used by the extension build process. They serve as documentation only.
