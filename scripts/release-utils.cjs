const { execFileSync } = require("child_process");

const SEMVER =
  /^(?:v)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function commandLabel(file, args) {
  return [file, ...args].join(" ");
}

function run(file, args, options = {}) {
  try {
    return execFileSync(file, args, { encoding: "utf8", stdio: "pipe", ...options }).trim();
  } catch (err) {
    throw new Error(`Command failed: ${commandLabel(file, args)}\n${err.message}`);
  }
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let customVersion = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--version" || arg === "-v") {
      customVersion = args[index + 1];
      index += 1;
    } else if (arg.startsWith("--version=")) {
      customVersion = arg.slice("--version=".length);
    }
  }

  return { customVersion };
}

function normalizeVersion(version) {
  if (version === "") {
    throw new Error("Custom version cannot be empty. Use --version <x.y.z>.");
  }
  if (version === undefined) {
    throw new Error("Missing value for --version. Use --version <x.y.z>.");
  }
  if (version === null) {
    return null;
  }
  if (!SEMVER.test(version)) {
    throw new Error(`Invalid version: ${version}. Use a valid semantic version such as 1.2.3.`);
  }
  return version.replace(/^v/, "");
}

module.exports = { normalizeVersion, parseArgs, run };
