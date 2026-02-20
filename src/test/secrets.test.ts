import { clearToken, getToken, setToken } from "../config/secrets";

type SecretStore = Record<string, string | undefined>;

function createSecretStorage(store: SecretStore): {
  get: (key: string) => Promise<string | undefined>;
  store: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
} {
  return {
    get: async (key: string) => store[key],
    store: async (key: string, value: string) => {
      store[key] = value;
    },
    delete: async (key: string) => {
      delete store[key];
    },
  };
}

test("stores token under default key", async () => {
  const store: SecretStore = {};
  const secrets = createSecretStorage(store) as any;

  await setToken(secrets, "abc");
  const token = await getToken(secrets);

  expect(token).toBe("abc");
});

test("stores and clears profile-scoped token", async () => {
  const store: SecretStore = {};
  const secrets = createSecretStorage(store) as any;

  await setToken(secrets, "profile-token", "prod");
  await setToken(secrets, "default-token");

  expect(await getToken(secrets, "prod")).toBe("profile-token");
  expect(await getToken(secrets)).toBe("default-token");

  await clearToken(secrets, "prod");
  expect(await getToken(secrets, "prod")).toBeUndefined();
  expect(await getToken(secrets)).toBe("default-token");
});
