import assert from "node:assert/strict";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "run-prisma-integration.mjs",
);

function runGuard(testDatabaseUrl) {
  const env = { ...process.env };
  delete env.TEST_DATABASE_URL;
  // Keep guard scenarios deterministic even when a developer has configured
  // TEST_DATABASE_URL in apps/backend/.env for the real integration suite.
  env.DOTENV_CONFIG_PATH = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    ".env.integration-guard-empty",
  );
  if (testDatabaseUrl !== undefined) env.TEST_DATABASE_URL = testDatabaseUrl;
  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
    env,
  });
}

test("integration runner requires TEST_DATABASE_URL", () => {
  const result = runGuard(undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /TEST_DATABASE_URL wajib diisi/u);
});

test("integration runner rejects remote database hosts", () => {
  const result = runGuard("postgresql://user:secret@db.example.com/gtt_ops_test");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /hanya boleh memakai database loopback lokal/u);
  assert.doesNotMatch(result.stderr, /secret/u);
});

test("integration runner rejects local databases without a test or qa marker", () => {
  const result = runGuard("postgresql://user:secret@127.0.0.1:5432/gtt_ops");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /wajib memuat token 'test' atau 'qa'/u);
  assert.doesNotMatch(result.stderr, /secret/u);
});
