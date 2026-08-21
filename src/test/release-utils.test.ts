// CommonJS keeps the release helper directly executable by Node.
const releaseUtils = require("../../scripts/release-utils.cjs") as {
  normalizeVersion: (version: string | null | undefined) => string | null;
  parseArgs: (argv: string[]) => { customVersion: string | null | undefined };
};

describe("release utilities", () => {
  it("normalizes valid release versions", () => {
    expect(releaseUtils.normalizeVersion("v1.2.3")).toBe("1.2.3");
    expect(releaseUtils.normalizeVersion("1.2.3-rc.1+build.5")).toBe("1.2.3-rc.1+build.5");
    expect(releaseUtils.normalizeVersion(null)).toBeNull();
  });

  it("rejects shell syntax and malformed custom versions", () => {
    expect(() => releaseUtils.normalizeVersion("1.2.3; touch should-not-run")).toThrow(
      "Invalid version",
    );
    expect(() => releaseUtils.normalizeVersion("1.2")).toThrow("Invalid version");
    expect(() => releaseUtils.normalizeVersion("")).toThrow("cannot be empty");
  });

  it("parses supported version flag forms", () => {
    expect(releaseUtils.parseArgs(["node", "release.js", "--version", "1.2.3"])).toEqual({
      customVersion: "1.2.3",
    });
    expect(releaseUtils.parseArgs(["node", "release.js", "--version=v1.2.3"])).toEqual({
      customVersion: "v1.2.3",
    });
  });
});
