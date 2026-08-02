import { resolveExtensionTestPat } from "../util/extensionTestMode";

const KEYS = ["EXTENSION_TEST_MODE", "GITEA_EXTENSION_TEST_TOKEN"] as const;

describe("extensionTestMode", () => {
  const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = saved[k];
      }
    }
  });

  it("returns undefined when EXTENSION_TEST_MODE is not 1", () => {
    delete process.env.EXTENSION_TEST_MODE;
    delete process.env.GITEA_EXTENSION_TEST_TOKEN;
    expect(resolveExtensionTestPat()).toBeUndefined();
  });

  it("returns undefined when mode is 1 but token unset", () => {
    process.env.EXTENSION_TEST_MODE = "1";
    delete process.env.GITEA_EXTENSION_TEST_TOKEN;
    expect(resolveExtensionTestPat()).toBeUndefined();
  });

  it("returns trimmed token when mode is 1 and token set", () => {
    process.env.EXTENSION_TEST_MODE = "1";
    process.env.GITEA_EXTENSION_TEST_TOKEN = "  pat-value  ";
    expect(resolveExtensionTestPat()).toBe("pat-value");
  });
});
