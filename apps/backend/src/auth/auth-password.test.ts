import assert from "node:assert/strict";
import {
  createLegacyScryptPasswordHashForTest,
  hashAuthPassword,
  hashAuthPasswordAsync,
  verifyAuthPassword,
  verifyAuthPasswordAsync,
} from "./auth-password";

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testHashesNewPasswordsWithBcrypt(): void {
  const hash = hashAuthPassword("Password#2026");

  assert.match(hash, /^\$2[aby]\$\d{2}\$/);
  assert.equal(verifyAuthPassword("Password#2026", hash), true);
  assert.equal(verifyAuthPassword("WrongPassword#2026", hash), false);
}

function testVerifiesLegacyScryptHashes(): void {
  const legacyHash = createLegacyScryptPasswordHashForTest("Legacy#2026");

  assert.equal(verifyAuthPassword("Legacy#2026", legacyHash), true);
  assert.equal(verifyAuthPassword("WrongLegacy#2026", legacyHash), false);
}

function testRejectsMalformedHashes(): void {
  assert.equal(verifyAuthPassword("Password#2026", ""), false);
  assert.equal(verifyAuthPassword("Password#2026", "not-a-real-hash"), false);
  assert.equal(verifyAuthPassword("", hashAuthPassword("Password#2026")), false);
}

async function testAsyncBcryptHelpers(): Promise<void> {
  const hash = await hashAuthPasswordAsync("AsyncPassword#2026");

  assert.match(hash, /^\$2[aby]\$\d{2}\$/);
  assert.equal(await verifyAuthPasswordAsync("AsyncPassword#2026", hash), true);
  assert.equal(await verifyAuthPasswordAsync("WrongAsyncPassword#2026", hash), false);
}

async function main(): Promise<void> {
  await runCase("auth password hashes new passwords with bcrypt", testHashesNewPasswordsWithBcrypt);
  await runCase("auth password verifies legacy scrypt hashes", testVerifiesLegacyScryptHashes);
  await runCase("auth password rejects malformed hashes", testRejectsMalformedHashes);
  await runCase("auth password supports async bcrypt helpers", testAsyncBcryptHelpers);
}

void main().catch((error: unknown) => {
  console.error("Auth password test failed:", error);
  process.exitCode = 1;
});
