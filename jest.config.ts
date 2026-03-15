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
    "!src/config/**",
    "!src/controllers/commands.ts",
    "!src/controllers/reviewCommentsController.ts",
    "!src/views/nodes.ts",
    "!src/util/bootstrap.ts",
    "!src/controllers/secretsVariablesCommands.ts",
    "!src/views/actionsTreeProvider.ts",
    "!src/views/settingsTreeProvider.ts",
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 75,
      functions: 80,
      lines: 80,
    },
  },
  moduleNameMapper: {
    "^vscode$": "<rootDir>/src/test/__mocks__/vscode.ts",
  },
};

export default config;
