import { defineConfig } from "vitest/config";

export default defineConfig({
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
});
