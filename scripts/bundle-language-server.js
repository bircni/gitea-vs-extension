#!/usr/bin/env node
/**
 * Copy the prebundled GitHub Actions language server into dist/ so the extension can spawn it.
 * The package ships dist/cli.bundle.cjs (esbuild, platform=node, format=cjs), so there is nothing
 * to rebuild — @actions/languageserver itself is ESM-only and would otherwise need its own target.
 */

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "dist", "server-node.cjs");

const RELATIVE = path.join("node_modules", "@actions", "languageserver", "dist", "cli.bundle.cjs");

/** The package's `exports` map hides the file from `require.resolve`, so walk up to node_modules. */
function findServerBundle() {
  let dir = __dirname;
  for (;;) {
    const candidate = path.join(dir, RELATIVE);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`could not find ${RELATIVE} above ${__dirname}; run npm install`);
    }
    dir = parent;
  }
}

function main() {
  const source = findServerBundle();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.copyFileSync(source, OUT);
  console.log(`server-node.cjs  ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)}mb`);
}

main();
