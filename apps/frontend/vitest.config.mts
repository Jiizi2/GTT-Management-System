import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "../../coverage/unit/frontend",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**/*.ts", "src/smoke/**/*.ts"],
      thresholds: {
        lines: 45,
        functions: 50,
        branches: 40,
        statements: 45,
      },
    },
  },
  // Component test configuration
  // Run with: npm run test:component
  // Uses jsdom environment for DOM simulation
});
