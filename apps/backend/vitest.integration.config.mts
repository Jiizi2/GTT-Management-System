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
    include: ["src/e2e/**/*.test.ts", "src/e2e/**/*.spec.ts"],
    exclude: ["node_modules"],
    fileParallelism: false,
    setupFiles: ["test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "../../coverage/integration/backend",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test/**/*.ts"],
    },
  },
});
