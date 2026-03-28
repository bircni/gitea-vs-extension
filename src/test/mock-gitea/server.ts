import * as http from "http";
import { createRequestListener } from "./router";
import type { MockState } from "./state";

export function createMockGiteaServer(state: MockState): http.Server {
  const server = http.createServer();
  server.on("request", createRequestListener(server, state));
  return server;
}
