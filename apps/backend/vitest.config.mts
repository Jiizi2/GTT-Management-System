import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["src/e2e/**/*.ts", "node_modules"],
    setupFiles: ["test/setup.ts"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "../../coverage/unit/backend",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**/*.ts", "src/e2e/**/*.ts"],
      thresholds: {
        lines: 60,
        functions: 68,
        branches: 62,
        statements: 60,
      },
    },
  },
});
