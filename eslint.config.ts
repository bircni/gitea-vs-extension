import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

// ESLint flat config for VS Code extension
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-var-requires": "warn",
      "@typescript-eslint/no-require-imports": "off", // Allow require() for CommonJS compatibility
      curly: "off",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
    },
  },
  {
    ignores: [
      "out",
      "dist",
      "**/*.d.ts",
      "node_modules",
      "coverage",
      "test-report",
      "*.js",
      "examples/**",
      "*.config.ts",
    ],
  },
  // Allow require() and any types in parser-remark.ts for CommonJS compatibility
  {
    files: ["**/parser-remark.ts"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-explicit-any": "off", // Necessary for dynamic require/import pattern
    },
  },
  // Ignore strict lint rules for test files - no warnings, just ignore
  {
    files: ["**/__mocks__/**", "**/__tests__/**", "**/*.test.ts", "**/*.test.js"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Node.js scripts directory - allow CommonJS and Node.js globals
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        global: "readonly",
      },
      ecmaVersion: "latest",
      sourceType: "script",
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
