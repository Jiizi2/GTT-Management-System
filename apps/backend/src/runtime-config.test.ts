import { describe, expect } from "vitest";
import { runCase } from "./test/run-case";
import { resolveRuntimeConfig, resolveStartupErrorMessage } from "./runtime-config";

describe("RuntimeConfig", () => {
  runCase("defaults", () => {
    const config = resolveRuntimeConfig({
      PORT: undefined,
      DATA_SOURCE: undefined,
      DATABASE_URL: undefined,
      NODE_ENV: undefined,
    });

    expect(config.port).toBe(3001);
    expect(config.dataSource).toBe("memory");
  });

  runCase("valid prisma", () => {
    const config = resolveRuntimeConfig({
      PORT: "3100",
      DATA_SOURCE: "PRISMA",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:6543/gtt_ops?schema=public",
      NODE_ENV: "development",
    });

    expect(config.port).toBe(3100);
    expect(config.dataSource).toBe("prisma");
  });

  runCase("invalid port", () => {
    expect(() =>
      resolveRuntimeConfig({
        PORT: "abc",
        DATA_SOURCE: "memory",
        DATABASE_URL: undefined,
        NODE_ENV: undefined,
      }),
    ).toThrow(/Invalid PORT value/);

    expect(() =>
      resolveRuntimeConfig({
        PORT: "0",
        DATA_SOURCE: "memory",
        DATABASE_URL: undefined,
        NODE_ENV: undefined,
      }),
    ).toThrow(/Invalid PORT value/);
  });

  runCase("invalid datasource", () => {
    expect(() =>
      resolveRuntimeConfig({
        PORT: "3001",
        DATA_SOURCE: "sqlite",
        DATABASE_URL: undefined,
        NODE_ENV: undefined,
      }),
    ).toThrow(/Invalid DATA_SOURCE value/);
  });

  runCase("missing prisma url", () => {
    expect(() =>
      resolveRuntimeConfig({
        PORT: "3001",
        DATA_SOURCE: "prisma",
        DATABASE_URL: "   ",
        NODE_ENV: undefined,
      }),
    ).toThrow(/DATABASE_URL is required when DATA_SOURCE=prisma/);
  });

  runCase("production requires prisma", () => {
    expect(() =>
      resolveRuntimeConfig({
        PORT: "3001",
        DATA_SOURCE: "memory",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:6543/gtt_ops?schema=public",
        NODE_ENV: "production",
      }),
    ).toThrow(/DATA_SOURCE must be prisma in production/);
  });

  runCase("startup error message", () => {
    expect(
      resolveStartupErrorMessage(new Error("Runtime exploded")),
    ).toBe("Runtime exploded");
    expect(resolveStartupErrorMessage("  plain error  ")).toBe("plain error");
    expect(
      resolveStartupErrorMessage({ message: "  object error message " }),
    ).toBe("object error message");
    expect(resolveStartupErrorMessage({ detail: "not-message" })).toBe("Unknown startup error.");
  });
});
