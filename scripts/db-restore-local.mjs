import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const LOCAL_DATABASE_MARKER = /(?:^|[_-])(local|dev|test|qa)(?:[_-]|$)/i;

export function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return undefined;
  const line = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith(`${key}=`));
  if (!line) return undefined;
  const value = line.slice(line.indexOf("=") + 1).trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export function validateRestoreTarget(rawUrl) {
  if (!rawUrl) {
    throw new Error(
      "LOCAL_RESTORE_DATABASE_URL wajib di-set di environment atau apps/backend/.env.",
    );
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("LOCAL_RESTORE_DATABASE_URL bukan URL PostgreSQL yang valid.");
  }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) {
    throw new Error("Target restore harus memakai URL PostgreSQL.");
  }
  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Restore ditolak: host target harus localhost, 127.0.0.1, atau ::1.");
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ""));
  if (!databaseName || !LOCAL_DATABASE_MARKER.test(databaseName)) {
    throw new Error(
      "Restore ditolak: nama database harus memiliki marker local, dev, test, atau qa.",
    );
  }

  parsed.searchParams.delete("schema");
  const displayUrl = new URL(parsed.toString());
  if (displayUrl.username) displayUrl.username = "***";
  if (displayUrl.password) displayUrl.password = "***";
  return { databaseName, connectionUrl: parsed.toString(), displayUrl: displayUrl.toString() };
}

export function validateBackupFile(inputPath) {
  if (!inputPath) throw new Error("Tentukan file backup SQL yang akan di-restore.");
  const resolvedPath = path.resolve(inputPath);
  let stat;
  try {
    stat = fs.statSync(resolvedPath);
    fs.accessSync(resolvedPath, fs.constants.R_OK);
  } catch {
    throw new Error(`File backup tidak ditemukan atau tidak dapat dibaca: ${resolvedPath}`);
  }
  if (!stat.isFile() || stat.size === 0) {
    throw new Error("File backup harus berupa regular file yang tidak kosong.");
  }
  return resolvedPath;
}

export function latestRepoMigration(repoRoot = process.cwd()) {
  const migrationsDir = path.join(repoRoot, "apps", "backend", "prisma", "migrations");
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (migrations.length === 0) throw new Error("Repo tidak memiliki migration Prisma.");
  return migrations.at(-1);
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildPsqlArgs({ connectionUrl, backupFilePath, latestMigration }) {
  const checks = `
DO $audit$
BEGIN
  IF current_database() IS NULL THEN
    RAISE EXCEPTION 'current_database check failed';
  END IF;
  IF to_regclass('public._prisma_migrations') IS NULL THEN
    RAISE EXCEPTION '_prisma_migrations table is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public._prisma_migrations
    WHERE migration_name = ${sqlLiteral(latestMigration)} AND finished_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'latest repository migration is not applied';
  END IF;
  IF to_regclass('public."AuthUser"') IS NULL
     OR to_regclass('public."Group"') IS NULL
     OR to_regclass('public."Invoice"') IS NULL
     OR to_regclass('public."InvoiceItem"') IS NULL THEN
    RAISE EXCEPTION 'required application table is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace)
     OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public') THEN
    RAISE EXCEPTION 'required foreign keys or indexes are missing';
  END IF;
  PERFORM COUNT(*) FROM public."AuthUser";
  PERFORM COUNT(*) FROM public."Group";
  PERFORM COUNT(*) FROM public."Invoice";
  PERFORM COUNT(*) FROM public."InvoiceItem";
END
$audit$;`;

  return [
    `--dbname=${connectionUrl}`,
    "--set=ON_ERROR_STOP=1",
    "--single-transaction",
    "--command=DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
    `--file=${backupFilePath}`,
    `--command=${checks}`,
  ];
}

export function executeRestore({ psqlCommand = "psql", ...options }) {
  return spawnSync(psqlCommand, buildPsqlArgs(options), { stdio: "inherit", shell: false });
}

async function confirmDatabaseName(databaseName) {
  if (!stdin.isTTY) {
    throw new Error("Konfirmasi interaktif wajib dijalankan dari terminal TTY.");
  }
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    return (await prompt.question(`Ketik nama database '${databaseName}' untuk melanjutkan: `)).trim();
  } finally {
    prompt.close();
  }
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  try {
    const backupFilePath = validateBackupFile(args[0]);
    const envPath = path.resolve("apps", "backend", ".env");
    const rawUrl =
      environment.LOCAL_RESTORE_DATABASE_URL ||
      readEnvValue(envPath, "LOCAL_RESTORE_DATABASE_URL");
    const target = validateRestoreTarget(rawUrl);
    const latestMigration = latestRepoMigration();

    console.log(`Backup: ${backupFilePath}`);
    console.log(`Target lokal: ${target.displayUrl}`);
    const suppliedConfirmation = environment.LOCAL_RESTORE_CONFIRM_DATABASE;
    const confirmation = suppliedConfirmation ?? (await confirmDatabaseName(target.databaseName));
    if (confirmation !== target.databaseName) throw new Error("Konfirmasi nama database tidak cocok.");

    const result = executeRestore({
      psqlCommand: environment.PSQL_COMMAND || "psql",
      connectionUrl: target.connectionUrl,
      backupFilePath,
      latestMigration,
    });
    if (result.error) {
      throw new Error(
        result.error.code === "ENOENT"
          ? "psql tidak tersedia di PATH; database belum diubah."
          : `Gagal menjalankan psql: ${result.error.message}`,
      );
    }
    if (result.status !== 0) {
      throw new Error(`Restore dibatalkan dan di-rollback (psql exit ${result.status}).`);
    }
    console.log("BERHASIL: restore lokal dan seluruh post-restore check selesai.");
  } catch (error) {
    console.error(`GAGAL: ${error instanceof Error ? error.message : "Kesalahan tidak diketahui"}`);
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
