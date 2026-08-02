import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/test/**/*.test.ts"],
    exclude: ["src/test/e2e/**"],
    alias: {
      vscode: path.resolve(import.meta.dirname, "src/test/__mocks__/vscode.ts"),
    },
    coverage: {
      provider: "v8",
      reportsDirectory: ".tmp/coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "src/test/**",
        "**/*.test.ts",
        "src/extension.ts",
        "src/config/**",
        "src/controllers/commands.ts",
        "src/controllers/reviewCommentsController.ts",
        "src/views/nodes.ts",
        "src/util/bootstrap.ts",
        "src/controllers/secretsVariablesCommands.ts",
        "src/views/actionsTreeProvider.ts",
        "src/views/settingsTreeProvider.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
