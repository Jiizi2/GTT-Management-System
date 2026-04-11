import assert from "node:assert/strict";
import { validateEnvironment } from "./env.validation";

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testConvertsTrustedProxyBoolean(): void {
  const validated = validateEnvironment({
    TRUST_PROXY: "true",
  });

  assert.equal(validated.TRUST_PROXY, true);
}

function testProductionRequiresCorsOrigins(): void {
  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: "production",
        PORT: "3001",
        DATA_SOURCE: "prisma",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/gtt_ops?schema=public",
        AUTH_SECRET: "x".repeat(32),
        CORS_ORIGINS: "   ",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
      }),
    /CORS_ORIGINS is required in production/i,
  );
}

function testRejectsWildcardCorsOrigins(): void {
  assert.throws(
    () =>
      validateEnvironment({
        CORS_ORIGINS: "*",
      }),
    /cannot contain '\*'/i,
  );
}

async function main(): Promise<void> {
  await runCase("env validation converts trust proxy boolean", testConvertsTrustedProxyBoolean);
  await runCase("env validation requires cors origins in production", testProductionRequiresCorsOrigins);
  await runCase("env validation rejects wildcard cors origins", testRejectsWildcardCorsOrigins);
}

void main().catch((error: unknown) => {
  console.error("Environment validation test failed:", error);
  process.exitCode = 1;
});
