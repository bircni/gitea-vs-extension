import type { Server } from "http";
import { createMockGiteaServer } from "./server";
import { createInitialState, type MockState } from "./state";

export type MockGiteaInstance = {
  baseUrl: string;
  state: MockState;
  server: Server;
  close: () => Promise<void>;
};

export function stopMockGitea(instance: MockGiteaInstance | undefined): Promise<void> {
  if (!instance) {
    return Promise.resolve();
  }
  return instance.close();
}

export async function startMockGitea(): Promise<MockGiteaInstance> {
  const state = createInitialState();
  const server = createMockGiteaServer(state);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    server.close();
    throw new Error("mock server has no port");
  }
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    baseUrl,
    state,
    server,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
