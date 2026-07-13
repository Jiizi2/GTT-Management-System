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
      include: ["src/shared/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts", "src/test/**/*.ts", "src/smoke/**/*.ts"],
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 65,
        statements: 75,
      },
    },
  },
  // Component test configuration
  // Run with: npm run test:component
  // Uses jsdom environment for DOM simulation
});
