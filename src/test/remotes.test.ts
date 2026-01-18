// ...existing code...
import { hostMatches, normalizeHost, parseRemoteUrl } from "../gitea/remotes";

test("parses https remotes", () => {
  const parsed = parseRemoteUrl("https://localhost:3000/owner/repo.git");
  expect(parsed?.host).toBe("localhost:3000");
  expect(parsed?.owner).toBe("owner");
  expect(parsed?.repo).toBe("repo");
});

test("parses ssh remotes", () => {
  const parsed = parseRemoteUrl("ssh://git@localhost:2222/owner/repo.git");
  expect(parsed?.host).toBe("localhost:2222");
  expect(parsed?.owner).toBe("owner");
  expect(parsed?.repo).toBe("repo");
});

test("parses scp-style remotes", () => {
  const parsed = parseRemoteUrl("git@localhost:owner/repo.git");
  expect(parsed?.host).toBe("localhost");
  expect(parsed?.owner).toBe("owner");
  expect(parsed?.repo).toBe("repo");
});

test("matches hostnames without ports", () => {
  expect(hostMatches("localhost:3000", "localhost")).toBe(true);
});

test("matches hostnames regardless of port casing", () => {
  expect(hostMatches("LOCALHOST:3000", "localhost:2222")).toBe(true);
});

test("does not match different hosts", () => {
  expect(hostMatches("localhost:3000", "example.com")).toBe(false);
});

test("normalizes hostnames to lowercase", () => {
  expect(normalizeHost("Gitea.Example.COM:3000")).toBe("gitea.example.com:3000");
});

test("returns undefined for unsupported remotes", () => {
  expect(parseRemoteUrl("not-a-remote")).toBeUndefined();
});
