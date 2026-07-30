import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "node_modules/", "coverage/", "prisma/migrations/"],
  },
  {
    ...js.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      globals: {
        ...globals.es2024,
        ...globals.node,
      },
    },
  },
  // Scope the TypeScript ruleset to TypeScript only. scripts/*.js are CommonJS
  // Node launchers, where `require()` is correct and no-require-imports is noise.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts}"],
  })),
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      globals: {
        ...globals.es2024,
        ...globals.node,
      },
    },
    rules: {
      // Baseline is tracked, not zero: the adapter layer still carries `any`
      // that is being retired file by file. Warn keeps it visible; the
      // directory overrides below are the ratchet that must stay clean.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Production source is `any`-free and stays that way. The single remaining
    // occurrence (invoice-number-generator's structural PrismaClient stand-in)
    // carries an inline disable explaining why it cannot be typed.
    //
    // Test files are deliberately excluded: they still carry ~60 `any`, which
    // are far lower risk than an `any` in an adapter or a contract. They remain
    // "warn" so the count stays visible without blocking.
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
);
