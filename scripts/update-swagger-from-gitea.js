#!/usr/bin/env node
/**
 * Download OpenAPI/Swagger v1 JSON from gitea.com (or GITEA_SWAGGER_BASE) into docs/swagger.v1.json.
 * Path order matches src/gitea/swagger.ts (SWAGGER_PATHS).
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_BASE = "https://gitea.com";
const SWAGGER_PATHS = [
  "/swagger.v1.json",
  "/api/swagger.v1.json",
  "/api/swagger.json",
  "/api/swagger",
];

const OUT = path.resolve(__dirname, "../docs/swagger.v1.json");

function isSwaggerDoc(obj) {
  return (
    obj !== null &&
    typeof obj === "object" &&
    typeof obj.paths === "object" &&
    obj.paths !== null &&
    ("swagger" in obj || "openapi" in obj)
  );
}

async function main() {
  const base = (process.env.GITEA_SWAGGER_BASE ?? DEFAULT_BASE).replace(/\/$/, "");

  let lastError = null;
  for (const p of SWAGGER_PATHS) {
    const url = `${base}${p}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        lastError = new Error(`${url} → HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      let doc;
      try {
        doc = JSON.parse(text);
      } catch {
        lastError = new Error(`${url} → invalid JSON`);
        continue;
      }
      if (!isSwaggerDoc(doc)) {
        lastError = new Error(`${url} → not a Swagger/OpenAPI document with paths`);
        continue;
      }
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
      console.log(`Wrote ${OUT} (${url})`);
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  console.error("Failed to fetch swagger from any path:", SWAGGER_PATHS.join(", "));
  if (lastError) {
    console.error(lastError.message);
  }
  process.exit(1);
}

main();
