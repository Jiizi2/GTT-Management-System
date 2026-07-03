import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { validateEnvironment } from "./env.validation";

describe("EnvironmentValidation", () => {
  runCase("converts trust proxy boolean", () => {
    const validated = validateEnvironment({
      TRUST_PROXY: "true",
    });

    expect(validated.TRUST_PROXY).toBe(true);
  });

  runCase("converts auth cookie secure boolean", () => {
    const validated = validateEnvironment({
      AUTH_COOKIE_SECURE: "false",
    });

    expect(validated.AUTH_COOKIE_SECURE).toBe(false);
  });

  runCase("requires cors origins in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        PORT: "3001",
        DATA_SOURCE: "prisma",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gtt_ops?schema=public",
        AUTH_SECRET: "x".repeat(32),
        CORS_ORIGINS: "   ",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
      }),
    ).toThrow(/CORS_ORIGINS is required in production/i);
  });

  runCase("rejects wildcard cors origins", () => {
    expect(() =>
      validateEnvironment({
        CORS_ORIGINS: "*",
      }),
    ).toThrow(/cannot contain '\*'/i);
  });

  runCase("rejects bootstrap in production", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "production",
        PORT: "3001",
        DATA_SOURCE: "prisma",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gtt_ops?schema=public",
        AUTH_SECRET: "x".repeat(32),
        CORS_ORIGINS: "https://app.example.com",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "true",
      }),
    ).toThrow(/AUTH_BOOTSTRAP_DEFAULT_USERS must be false in production/i);
  });

  runCase("requires bootstrap passwords in prisma mode", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "development",
        PORT: "3001",
        DATA_SOURCE: "prisma",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gtt_ops?schema=public",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "true",
        DEV_AUTH_SUPERADMIN_PASSWORD: "BootstrapSuper#2026",
        DEV_AUTH_ADMIN_PASSWORD: "   ",
      }),
    ).toThrow(/DEV_AUTH_SUPERADMIN_PASSWORD and DEV_AUTH_ADMIN_PASSWORD are required/i);
  });
});
