#!/usr/bin/env node
/**
 * Optional live Gitea smoke: GET /api/v1/version (+ /api/v1/user when token set).
 * Headers mirror GiteaHttpClient (Accept + Authorization: token … when token present).
 * Never logs the token or full Authorization value.
 *
 * Env: GITEA_BASE_URL, GITEA_TOKEN (optional for version-only), GITEA_TLS_INSECURE, REQUIRE_LIVE_GITEA
 */
"use strict";

const { request, Agent } = require("undici");

function truthyEnv(name) {
  const v = process.env[name];
  return v === "1" || v === "true" || v === "yes";
}

function buildUrl(base, rel) {
  const trimmed = base.replace(/\/$/, "");
  const path = rel.startsWith("/") ? rel : `/${rel}`;
  return `${trimmed}${path}`;
}

async function getJson(url, headers, dispatcher) {
  const res = await request(url, { method: "GET", headers, dispatcher });
  const text = await res.body.text();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;
    throw new Error(`HTTP ${res.statusCode} ${snippet}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Response was not valid JSON");
  }
}

async function main() {
  const baseUrl = (process.env.GITEA_BASE_URL || "").trim();
  const token = (process.env.GITEA_TOKEN || "").trim();
  const requireLive = truthyEnv("REQUIRE_LIVE_GITEA");
  const tlsInsecure = truthyEnv("GITEA_TLS_INSECURE");

  if (!baseUrl) {
    if (requireLive) {
      console.error("GITEA_BASE_URL is required when REQUIRE_LIVE_GITEA is set.");
      process.exit(1);
    }
    console.log("Live Gitea smoke skipped: GITEA_BASE_URL not set.");
    process.exit(0);
  }

  let origin;
  try {
    origin = new URL(baseUrl);
  } catch {
    console.error("Invalid GITEA_BASE_URL (not a valid URL).");
    process.exit(requireLive ? 1 : 0);
  }

  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    console.error("GITEA_BASE_URL must be http: or https:.");
    process.exit(1);
  }

  const dispatcher =
    origin.protocol === "https:" && tlsInsecure
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;

  const headers = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const versionBody = await getJson(buildUrl(baseUrl, "/api/v1/version"), headers, dispatcher);
    if (typeof versionBody.version !== "string" || !versionBody.version) {
      throw new Error("GET /api/v1/version: missing string `version` field");
    }
    console.log(`OK: Gitea version ${versionBody.version}`);

    if (token) {
      const userBody = await getJson(buildUrl(baseUrl, "/api/v1/user"), headers, dispatcher);
      const login = userBody.login;
      const id = userBody.id;
      if (login == null && id == null) {
        throw new Error("GET /api/v1/user: expected `login` and/or `id`");
      }
      console.log(`OK: authenticated as ${String(login ?? `id:${id}`)}`);
    } else {
      console.log("Note: GITEA_TOKEN not set; skipped GET /api/v1/user.");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Live Gitea smoke failed:", msg);
    process.exit(1);
  }
}

void main();
