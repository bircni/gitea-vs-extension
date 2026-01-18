import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/test/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  coverageDirectory: ".tmp/coverage/",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/test/**",
    "!**/*.test.ts",
    "!src/extension.ts",
    "!src/controllers/**",
    "!src/views/**",
    "!src/config/**",
  ],
  moduleNameMapper: {
    "^vscode$": "<rootDir>/src/test/__mocks__/vscode.ts",
  },
};

export default config;
