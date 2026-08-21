# Hermetic Gitea mock (integration tests)

Used by `src/test/gitea-api-mock.integration.test.ts` to exercise `GiteaHttpClient` + `GiteaApi` without network.

The mock documents its supported HTTP behavior directly in its fixtures and
request handlers, keeping the hermetic test contract next to the test harness.
