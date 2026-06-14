import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { request } from "undici";
import { runTests } from "@vscode/test-electron";
import { GITEA_FIXTURE_ARCHIVE, type GiteaFixtureMetadata } from "./giteaFixture";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../..");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index.js");
  const fixtureArchive = path.join(
    extensionDevelopmentPath,
    "src/test/e2e/fixtures",
    GITEA_FIXTURE_ARCHIVE,
  );
  const runRoot = path.join(
    extensionDevelopmentPath,
    ".tmp/e2e-gitea",
    `${Date.now()}-${process.pid}`,
  );
  const dataRoot = path.join(runRoot, "data");
  const workspaceRoot = path.join(runRoot, "workspace");
  const settingsDir = path.join(workspaceRoot, ".vscode");
  const settingsPath = path.join(settingsDir, "settings.json");
  const containerName = `gitea-vs-extension-e2e-${Date.now()}-${process.pid}`;

  let metadata: GiteaFixtureMetadata | undefined;
  try {
    fs.mkdirSync(dataRoot, { recursive: true });
    await execFileAsync("tar", ["-xzf", fixtureArchive, "-C", dataRoot], {
      cwd: extensionDevelopmentPath,
    });
    metadata = readMetadata(dataRoot);
    prepareRuntimeSecrets(dataRoot);

    await docker([
      "run",
      "-d",
      "--name",
      containerName,
      "-p",
      "127.0.0.1::3000",
      "-v",
      `${dataRoot}:/data`,
      metadata.image,
    ]);
    const port = await getMappedPort(containerName);
    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForGitea(baseUrl);
    const token = await createAccessToken(baseUrl, metadata.username, metadata.password);

    createWorkspace(workspaceRoot, baseUrl, metadata);
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      settingsPath,
      `${JSON.stringify(
        {
          "gitea-vs-extension.baseUrl": baseUrl,
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
      launchArgs: [workspaceRoot, "--disable-extensions"],
      extensionTestsEnv: {
        ...process.env,
        EXTENSION_TEST_MODE: "1",
        GITEA_EXTENSION_TEST_KIND: "real-gitea",
        GITEA_EXTENSION_TEST_TOKEN: token,
        GITEA_EXTENSION_TEST_BASE_URL: baseUrl,
        GITEA_EXTENSION_TEST_OWNER: metadata.owner,
        GITEA_EXTENSION_TEST_REPO: metadata.repo,
        GITEA_EXTENSION_TEST_BRANCH: metadata.branch,
        GITEA_EXTENSION_TEST_COMMENT_FILE: path.join(workspaceRoot, metadata.commentFile),
        GITEA_EXTENSION_TEST_COMMENT_LINE: String(metadata.commentLine),
        GITEA_EXTENSION_TEST_REVIEW_COMMENT_BODY: `e2e review comment ${Date.now()}`,
        GITEA_EXTENSION_TEST_SEEDED_COMMENT_COUNT: String(metadata.seededReviewCommentCount),
      },
    });
  } finally {
    await docker(["rm", "-f", containerName]).catch(() => {});
    await normalizeRunRootPermissions(runRoot, metadata?.image).catch(() => {});
    fs.rmSync(runRoot, { recursive: true, force: true });
  }
}

async function normalizeRunRootPermissions(
  runRoot: string,
  cleanupImage: string | undefined,
): Promise<void> {
  if (process.platform === "win32" || !cleanupImage) {
    return;
  }

  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (typeof uid !== "number" || typeof gid !== "number") {
    return;
  }

  await docker([
    "run",
    "--rm",
    "-v",
    `${runRoot}:/cleanup`,
    "--entrypoint",
    "sh",
    cleanupImage,
    "-c",
    `chown -R ${uid}:${gid} /cleanup && chmod -R u+rwX /cleanup`,
  ]);
}

function readMetadata(dataRoot: string): GiteaFixtureMetadata {
  const metadataPath = path.join(dataRoot, "codex-fixture.json");
  return JSON.parse(fs.readFileSync(metadataPath, "utf8")) as GiteaFixtureMetadata;
}

function prepareRuntimeSecrets(dataRoot: string): void {
  const appIniPath = path.join(dataRoot, "gitea", "conf", "app.ini");
  let appIni = fs.readFileSync(appIniPath, "utf8");
  const replacements: Record<string, string> = {
    SECRET_KEY: `e2e-secret-key-${Date.now()}-${process.pid}`,
    INTERNAL_TOKEN: `e2e-internal-token-${Date.now()}-${process.pid}`,
    JWT_SECRET: `e2e-jwt-secret-${Date.now()}-${process.pid}`,
  };

  for (const [key, value] of Object.entries(replacements)) {
    appIni = replaceIniValue(appIni, key, value);
  }
  fs.writeFileSync(appIniPath, appIni, "utf8");
}

function replaceIniValue(input: string, key: string, value: string): string {
  const escaped = key.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(String.raw`^${escaped}\s*=.*$`, "m");
  if (pattern.test(input)) {
    return input.replace(pattern, `${key} = ${value}`);
  }
  return `${input.trimEnd()}\n${key} = ${value}\n`;
}

function createWorkspace(
  workspaceRoot: string,
  baseUrl: string,
  metadata: GiteaFixtureMetadata,
): void {
  fs.mkdirSync(workspaceRoot, { recursive: true });
  fs.writeFileSync(
    path.join(workspaceRoot, metadata.commentFile),
    ["# Fixture repo", "", "updated feature line", ""].join(os.EOL),
    "utf8",
  );
  const remote = `${baseUrl}/${metadata.owner}/${metadata.repo}.git`;
  runGit(["init"], workspaceRoot);
  runGit(["config", "user.email", "fixture@example.com"], workspaceRoot);
  runGit(["config", "user.name", "Fixture User"], workspaceRoot);
  runGit(["checkout", "-b", metadata.branch], workspaceRoot);
  runGit(["add", metadata.commentFile], workspaceRoot);
  runGit(["commit", "-m", "fixture workspace"], workspaceRoot);
  runGit(["remote", "add", "origin", remote], workspaceRoot);
}

function runGit(args: string[], cwd: string): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

async function createAccessToken(
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const response = await request(`${baseUrl}/api/v1/users/${encodeURIComponent(username)}/tokens`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: `e2e-${Date.now()}`, scopes: ["all"] }),
  });
  const body = (await response.body.json()) as { sha1?: string };
  if (response.statusCode < 200 || response.statusCode >= 300 || !body.sha1) {
    throw new Error(`failed to create Gitea token: HTTP ${response.statusCode}`);
  }
  return body.sha1;
}

async function waitForGitea(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await request(`${baseUrl}/api/v1/version`);
      if (response.statusCode === 200) {
        const body = (await response.body.json()) as { version?: string };
        if (body.version === "1.26.1") {
          return;
        }
        throw new Error(`expected Gitea 1.26.1, got ${body.version ?? "unknown"}`);
      }
      await response.body.text();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Gitea did not become ready: ${String(lastError)}`);
}

async function getMappedPort(containerName: string): Promise<string> {
  const { stdout } = await docker(["port", containerName, "3000/tcp"]);
  const match = /:(\d+)\s*$/.exec(stdout.trim());
  if (!match) {
    throw new Error(`could not resolve mapped Gitea port from: ${stdout}`);
  }
  return match[1];
}

async function docker(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("docker", args, { maxBuffer: 10 * 1024 * 1024 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
