import assert from "node:assert/strict";
import { resolveRuntimeConfig, resolveStartupErrorMessage } from "./runtime-config";

async function runCase(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

function testDefaultRuntimeConfig(): void {
  const config = resolveRuntimeConfig({
    PORT: undefined,
    DATA_SOURCE: undefined,
    DATABASE_URL: undefined,
    NODE_ENV: undefined,
  });

  assert.equal(config.port, 3001);
  assert.equal(config.dataSource, "memory");
}

function testValidPrismaRuntimeConfig(): void {
  const config = resolveRuntimeConfig({
    PORT: "3100",
    DATA_SOURCE: "PRISMA",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:6543/gtt_ops?schema=public",
    NODE_ENV: "development",
  });

  assert.equal(config.port, 3100);
  assert.equal(config.dataSource, "prisma");
}

function testInvalidPortValidation(): void {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        PORT: "abc",
        DATA_SOURCE: "memory",
        DATABASE_URL: undefined,
        NODE_ENV: undefined,
      }),
    /Invalid PORT value/,
  );

  assert.throws(
    () =>
      resolveRuntimeConfig({
        PORT: "0",
        DATA_SOURCE: "memory",
        DATABASE_URL: undefined,
        NODE_ENV: undefined,
      }),
    /Invalid PORT value/,
  );
}

function testInvalidDataSourceValidation(): void {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        PORT: "3001",
        DATA_SOURCE: "sqlite",
        DATABASE_URL: undefined,
        NODE_ENV: undefined,
      }),
    /Invalid DATA_SOURCE value/,
  );
}

function testMissingDatabaseUrlForPrismaValidation(): void {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        PORT: "3001",
        DATA_SOURCE: "prisma",
        DATABASE_URL: "   ",
        NODE_ENV: undefined,
      }),
    /DATABASE_URL is required when DATA_SOURCE=prisma/,
  );
}

function testProductionRequiresPrismaDataSource(): void {
  assert.throws(
    () =>
      resolveRuntimeConfig({
        PORT: "3001",
        DATA_SOURCE: "memory",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:6543/gtt_ops?schema=public",
        NODE_ENV: "production",
      }),
    /DATA_SOURCE must be prisma in production/,
  );
}

function testResolveStartupErrorMessage(): void {
  assert.equal(
    resolveStartupErrorMessage(new Error("Runtime exploded")),
    "Runtime exploded",
  );
  assert.equal(resolveStartupErrorMessage("  plain error  "), "plain error");
  assert.equal(
    resolveStartupErrorMessage({ message: "  object error message " }),
    "object error message",
  );
  assert.equal(resolveStartupErrorMessage({ detail: "not-message" }), "Unknown startup error.");
}

async function main(): Promise<void> {
  await runCase("runtime config defaults", testDefaultRuntimeConfig);
  await runCase("runtime config valid prisma", testValidPrismaRuntimeConfig);
  await runCase("runtime config invalid port", testInvalidPortValidation);
  await runCase("runtime config invalid datasource", testInvalidDataSourceValidation);
  await runCase("runtime config missing prisma url", testMissingDatabaseUrlForPrismaValidation);
  await runCase("runtime config production requires prisma", testProductionRequiresPrismaDataSource);
  await runCase("runtime config startup error message", testResolveStartupErrorMessage);
}

main().catch((error: unknown) => {
  console.error("Runtime config test failed:", error);
  throw error;
});
