import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildPsqlArgs,
  validateBackupFile,
  validateRestoreTarget,
} from "./db-restore-local.mjs";

test("restore target rejects remote hosts and production-like database names", () => {
  assert.throws(
    () => validateRestoreTarget("postgresql://user:secret@db.example.com/gtt_ops_test"),
    /host target/u,
  );
  assert.throws(
    () => validateRestoreTarget("postgresql://user:secret@localhost/gtt_ops"),
    /nama database/u,
  );
});

test("restore target accepts local marker and redacts credentials", () => {
  const target = validateRestoreTarget(
    "postgresql://local_user:p%40ss%3Aword@127.0.0.1:5432/gtt_ops_local?schema=public",
  );
  assert.equal(target.databaseName, "gtt_ops_local");
  assert.doesNotMatch(target.displayUrl, /local_user|p%40ss|word/u);
  assert.doesNotMatch(target.connectionUrl, /schema=/u);
});

test("backup validation rejects missing, directory, and empty input", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gtt-restore-test-"));
  const empty = path.join(directory, "empty.sql");
  fs.writeFileSync(empty, "");
  assert.throws(() => validateBackupFile(path.join(directory, "missing.sql")), /tidak ditemukan/u);
  assert.throws(() => validateBackupFile(directory), /regular file/u);
  assert.throws(() => validateBackupFile(empty), /tidak kosong/u);
});

test("psql restore uses one transaction with stop-on-error and post checks", () => {
  const args = buildPsqlArgs({
    connectionUrl: "postgresql://user:p%40ss@localhost/gtt_ops_test",
    backupFilePath: "C:\\backups\\fixture.sql",
    latestMigration: "20260712180030_optimize_database_indexes",
  });
  assert.ok(args.includes("--single-transaction"));
  assert.ok(args.includes("--set=ON_ERROR_STOP=1"));
  assert.ok(args.some((value) => value.startsWith("--file=")));
  assert.ok(args.some((value) => value.includes("_prisma_migrations")));
  assert.equal(args.filter((value) => value.startsWith("--dbname=")).length, 1);
});
