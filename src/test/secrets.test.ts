import { clearToken, getToken, setToken, tokenKeyForBaseUrl } from "../config/secrets";

function createSecretStorage() {
  const values = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => values.get(key)),
    store: vi.fn(async (key: string, value: string) => void values.set(key, value)),
    delete: vi.fn(async (key: string) => void values.delete(key)),
  };
}

test("stores tokens under different opaque keys for different Gitea instances", async () => {
  const secrets = createSecretStorage();
  const first = "https://one.gitea.example";
  const second = "https://two.gitea.example";

  await setToken(secrets as never, "first-token", first);
  await setToken(secrets as never, "second-token", second);

  expect(tokenKeyForBaseUrl(first)).not.toBe(tokenKeyForBaseUrl(second));
  await expect(getToken(secrets as never, first)).resolves.toBe("first-token");
  await expect(getToken(secrets as never, second)).resolves.toBe("second-token");

  await clearToken(secrets as never, first);
  await expect(getToken(secrets as never, first)).resolves.toBeUndefined();
  await expect(getToken(secrets as never, second)).resolves.toBe("second-token");
});
