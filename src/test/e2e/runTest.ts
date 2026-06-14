import * as fs from "node:fs";
import path from "node:path";
import { runTests } from "@vscode/test-electron";
import { MOCK_GITEA_TOKEN, startMockGitea, stopMockGitea } from "../mock-gitea";

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index.js");
  const fixtureRoot = path.join(extensionDevelopmentPath, "src/test/e2e/fixture-workspace");
  const vscodeSettingsDir = path.join(fixtureRoot, ".vscode");
  const vscodeSettingsPath = path.join(vscodeSettingsDir, "settings.json");

  const mock = await startMockGitea();
  try {
    fs.mkdirSync(vscodeSettingsDir, { recursive: true });
    fs.writeFileSync(
      vscodeSettingsPath,
      `${JSON.stringify(
        {
          "gitea-vs-extension.baseUrl": mock.baseUrl,
          "gitea-vs-extension.discovery.mode": "allAccessible",
          "gitea-vs-extension.tls.insecureSkipVerify": false,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [fixtureRoot, "--disable-extensions"],
      extensionTestsEnv: {
        ...process.env,
        EXTENSION_TEST_MODE: "1",
        GITEA_EXTENSION_TEST_TOKEN: MOCK_GITEA_TOKEN,
      },
    });
  } finally {
    try {
      fs.unlinkSync(vscodeSettingsPath);
    } catch {
      /* ignore */
    }
    await stopMockGitea(mock);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
