import assert from "node:assert/strict";
import {
  buildBootstrapSuperAdminHelpText,
  deriveBootstrapUsername,
  parseBootstrapSuperAdminOptions,
  resolveBootstrapSuperAdminInput,
} from "./bootstrap-super-admin";

async function runCase(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

function testParsesInlineAndPositionalOptions(): void {
  const parsed = parseBootstrapSuperAdminOptions([
    "--name",
    "Owner",
    "--email=owner@example.com",
    "--password",
    "StrongPassword#2026",
    "--username=owner.root",
  ]);

  assert.equal(parsed.name, "Owner");
  assert.equal(parsed.email, "owner@example.com");
  assert.equal(parsed.password, "StrongPassword#2026");
  assert.equal(parsed.username, "owner.root");
}

function testDerivesUsernameFromEmailLocalPart(): void {
  assert.equal(deriveBootstrapUsername("Owner Name"), "owner.name");
  assert.equal(deriveBootstrapUsername("___"), "user");
}

function testResolvesInputWithEnvFallbacks(): void {
  const resolved = resolveBootstrapSuperAdminInput([], {
    BOOTSTRAP_SUPERADMIN_NAME: "Initial Owner",
    BOOTSTRAP_SUPERADMIN_EMAIL: "Owner@Example.com",
    BOOTSTRAP_SUPERADMIN_PASSWORD: "StrongPassword#2026",
  });

  assert.ok(resolved);
  assert.equal(resolved?.name, "Initial Owner");
  assert.equal(resolved?.email, "owner@example.com");
  assert.equal(resolved?.username, "owner");
}

function testRejectsTooShortPassword(): void {
  assert.throws(
    () =>
      resolveBootstrapSuperAdminInput([
        "--name",
        "Owner",
        "--email",
        "owner@example.com",
        "--password",
        "short",
      ]),
    /at least 12 characters/i,
  );
}

function testRejectsMissingRequiredValues(): void {
  assert.throws(
    () =>
      resolveBootstrapSuperAdminInput([
        "--name",
        "Owner",
        "--password",
        "StrongPassword#2026",
      ]),
    /email is required/i,
  );
}

function testHelpTextIsReturnedForHelpFlag(): void {
  const resolved = resolveBootstrapSuperAdminInput(["--help"]);
  assert.equal(resolved, null);
  assert.match(buildBootstrapSuperAdminHelpText(), /Bootstrap the first persistent super-admin/i);
}

async function main(): Promise<void> {
  await runCase("bootstrap super-admin parses options", testParsesInlineAndPositionalOptions);
  await runCase("bootstrap super-admin derives usernames", testDerivesUsernameFromEmailLocalPart);
  await runCase("bootstrap super-admin resolves env fallbacks", testResolvesInputWithEnvFallbacks);
  await runCase("bootstrap super-admin rejects short password", testRejectsTooShortPassword);
  await runCase("bootstrap super-admin rejects missing values", testRejectsMissingRequiredValues);
  await runCase("bootstrap super-admin supports help flag", testHelpTextIsReturnedForHelpFlag);
}

void main().catch((error: unknown) => {
  console.error("Bootstrap super-admin test failed:", error);
  process.exitCode = 1;
});

