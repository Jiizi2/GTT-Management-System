import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, parseKind, retentionPrefixes } from "./production-backup.mjs";

const baseEnvironment = {
  BACKUP_STAGING_DIR: "/var/lib/gtt-backup/staging",
  BACKUP_AGE_RECIPIENTS_FILE: "/run/secrets/gtt-backup-recipients.txt",
  BACKUP_RCLONE_REMOTE: "s3:gtt-production/",
};

test("backup kind only permits scheduled and predeploy", () => {
  assert.equal(parseKind([]), "scheduled");
  assert.equal(parseKind(["--kind", "predeploy"]), "predeploy");
  assert.throws(() => parseKind(["--kind", "other"]), /scheduled atau predeploy/u);
});

test("configuration requires isolated staging, recipient, and remote", () => {
  const config = loadConfig(baseEnvironment);
  assert.equal(config.rcloneRemote, "s3:gtt-production");
  assert.throws(() => loadConfig({ ...baseEnvironment, BACKUP_STAGING_DIR: "/" }), /filesystem root/u);
  assert.throws(
    () => loadConfig({ ...baseEnvironment, BACKUP_STAGING_DIR: ".local-backups" }),
    /di luar repository/u,
  );
  assert.throws(() => loadConfig({ ...baseEnvironment, BACKUP_RCLONE_REMOTE: "" }), /wajib di-set/u);
  assert.throws(
    () => loadConfig({ ...baseEnvironment, BACKUP_RCLONE_REMOTE: "/mnt/backups" }),
    /bukan path lokal/u,
  );
});

test("scheduled backup promotes the first UTC slot to daily and monthly", () => {
  assert.deepEqual(retentionPrefixes("scheduled", new Date("2026-08-01T00:00:00Z")), [
    "six-hour",
    "daily",
    "monthly",
  ]);
  assert.deepEqual(retentionPrefixes("scheduled", new Date("2026-08-02T06:00:00Z")), ["six-hour"]);
  assert.deepEqual(retentionPrefixes("predeploy", new Date("2026-08-01T00:00:00Z")), ["predeploy"]);
});
