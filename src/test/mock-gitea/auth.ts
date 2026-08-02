import type { IncomingMessage } from "node:http";
import { MOCK_GITEA_TOKEN } from "./fixture";

export function getBearerToken(req: IncomingMessage): string | undefined {
  const raw = req.headers.authorization;
  if (!raw || typeof raw !== "string") {
    return undefined;
  }
  const m = /^token\s+(?<token>.+)$/i.exec(raw.trim());
  return m?.[1]?.trim();
}

export function requireToken(req: IncomingMessage): boolean {
  const token = getBearerToken(req);
  return token === MOCK_GITEA_TOKEN;
}
