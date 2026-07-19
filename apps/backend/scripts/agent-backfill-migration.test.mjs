import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function migrationSql(name) {
  return fs.readFileSync(
    path.join(backendRoot, "prisma", "migrations", name, "migration.sql"),
    "utf8",
  );
}

test("agreement draft migration creates deterministic agents from legacy names", () => {
  const sql = migrationSql("20260717200000_add_agent_to_agreement_drafts");

  assert.match(sql, /^BEGIN;/u);
  assert.match(sql, /FROM "HotelAgreementDraft"/u);
  assert.match(sql, /NULLIF\(BTRIM\("agentName"\), ''\) IS NOT NULL/u);
  assert.match(sql, /'agent_legacy_' \|\| MD5\("normalizedName"\)/u);
  assert.match(sql, /'LEGACY-' \|\| UPPER/u);
  assert.match(sql, /COMMIT;\s*$/u);
});

test("agreement draft migration maps and verifies every non-empty legacy agent", () => {
  const sql = migrationSql("20260717200000_add_agent_to_agreement_drafts");

  assert.match(sql, /'agent_legacy_' \|\| MD5\(LOWER\(BTRIM\("agentName"\)\)\)/u);
  assert.match(sql, /Legacy hotel agreement agent backfill verification failed/u);
  assert.match(sql, /agent\."id" IS NULL/u);
  assert.match(sql, /LOWER\(BTRIM\(agent\."name"\)\) <> LOWER\(BTRIM\(draft\."agentName"\)\)/u);
});

test("legacy agentName remains available for production reconciliation", () => {
  const sql = migrationSql("20260717210000_remove_legacy_agent_name");

  assert.doesNotMatch(sql, /DROP\s+COLUMN/iu);
  assert.match(sql, /compatibility release/u);
});
