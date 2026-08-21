#!/usr/bin/env node
const { normalizeVersion, parseArgs, run } = require("./release-utils.cjs");

/**
 * Release helper script for Gitea VS Extension.
 * - Runs repository validation checks
 * - Gets next version with git-cliff (or a custom version via --version)
 * - Generates CHANGELOG.md
 * - Bumps package.json version
 * - Commits changes and creates git tag
 * - Prints push/undo instructions
 */

function log(msg) {
  console.log(`\x1b[36m${msg}\x1b[0m`);
}

function error(msg) {
  console.error(`\x1b[31m${msg}\x1b[0m`);
}

try {
  const { customVersion: requestedVersion } = parseArgs(process.argv);
  const customVersion = normalizeVersion(requestedVersion);
  // check that we are on main and working tree is clean
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch !== "main") {
    throw new Error(`You must be on the main branch to run this script. Current branch: ${branch}`);
  }
  const status = run("git", ["status", "--porcelain"]);
  if (status) {
    throw new Error(
      "Your working tree is not clean. Please commit or stash your changes before running this script.",
    );
  }

  // Run validation checks
  log("🔍 Running validation checks...");
  log("  🧪 Running repository checks...");
  run("npm", ["run", "validate"]);
  log("  🔒 Checking dependencies...");
  run("npm", ["run", "audit"]);
  log("✅ All validation checks passed");

  // Check if git-cliff is available
  log("🔍 Checking git-cliff availability...");
  try {
    // Try npx first (will use local node_modules/.bin if available)
    run("npx", ["--yes", "git-cliff", "--version"]);
  } catch {
    throw new Error(
      "git-cliff is not available. Run 'npm install' to install dev dependencies, or install globally with: npm install -g git-cliff",
    );
  }

  // Determine next version
  let nextVersion = customVersion;
  if (nextVersion) {
    log(`🔍 Using custom version: ${nextVersion}`);
  } else {
    log("🔍 Determining next version with git-cliff...");
    nextVersion = normalizeVersion(run("npx", ["git-cliff", "--bumped-version"]));
    if (!nextVersion) {
      throw new Error(
        "Failed to determine next version. Ensure you have conventional commits since the last tag.",
      );
    }
  }
  // Remove 'v' prefix if present for consistency
  nextVersion = normalizeVersion(nextVersion);
  const tagVersion = `v${nextVersion}`;
  log(`Next version: ${nextVersion} (tag: ${tagVersion})`);

  // Generate CHANGELOG
  log("📝 Generating CHANGELOG.md...");
  run("npx", ["git-cliff", "-o", "CHANGELOG.md", "--tag", tagVersion]);

  // Update package.json version
  log("🔢 Bumping package.json version...");
  run("npm", ["version", nextVersion, "--no-git-tag-version"]);

  // Commit changes
  log("✅ Committing changes...");
  run("git", ["add", "CHANGELOG.md", "package.json", "package-lock.json"]);
  run("git", ["commit", "-m", `chore(release): ${tagVersion}`]);

  // Create git tag
  log("🏷️  Creating git tag...");
  run("git", ["tag", tagVersion]);

  log("🎉 Release prep complete!");
  console.log("\nNext steps:");
  console.log(`  1. Push changes including the new tag:\n     git push origin main --follow-tags`);
  console.log(
    `  2. If you need to undo, run:\n     git reset --hard HEAD~1\n     git tag -d ${tagVersion}`,
  );
} catch (err) {
  error("Release failed:");
  error(err.message);
  if (err.stack && process.env.DEBUG) {
    console.error(err.stack);
  }
  process.exit(1);
}
