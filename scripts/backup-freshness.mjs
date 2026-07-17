import fs from "node:fs";
import path from "node:path";

const stateFile = path.resolve(process.env.BACKUP_STATE_FILE || "/var/lib/gtt-backup/last-success.json");
const maximumAgeHours = Number(process.env.BACKUP_MAX_AGE_HOURS || "7");

try {
  if (!Number.isFinite(maximumAgeHours) || maximumAgeHours <= 0) {
    throw new Error("BACKUP_MAX_AGE_HOURS harus angka positif.");
  }
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  const completedAt = Date.parse(state.completedAtUtc);
  if (!Number.isFinite(completedAt)) throw new Error("completedAtUtc tidak valid.");
  const ageHours = (Date.now() - completedAt) / 3_600_000;
  console.log(`gtt_backup_age_hours ${ageHours.toFixed(3)}`);
  console.log(`gtt_backup_fresh ${ageHours <= maximumAgeHours ? 1 : 0}`);
  if (ageHours > maximumAgeHours) throw new Error(`backup terakhir berumur ${ageHours.toFixed(2)} jam.`);
} catch (error) {
  console.error(`BACKUP_STALE: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
