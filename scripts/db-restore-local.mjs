import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// 1. Get backup file from arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Error: Silakan tentukan file backup SQL yang ingin di-restore.");
  console.error("Contoh: npm run db:restore:local ./production_backup.sql");
  process.exit(1);
}

const backupFilePath = path.resolve(args[0]);
if (!fs.existsSync(backupFilePath)) {
  console.error(`Error: File backup tidak ditemukan di path: ${backupFilePath}`);
  process.exit(1);
}

console.log(`Menggunakan file backup: ${backupFilePath}`);

// 2. Read apps/backend/.env to get DATABASE_URL
const envPath = path.resolve("apps", "backend", ".env");
if (!fs.existsSync(envPath)) {
  console.error("Error: File apps/backend/.env tidak ditemukan.");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, "utf-8");
const databaseUrlLine = envContent
  .split("\n")
  .map((line) => line.trim())
  .find((line) => line.startsWith("DATABASE_URL="));

if (!databaseUrlLine) {
  console.error("Error: DATABASE_URL tidak ditemukan di file apps/backend/.env");
  process.exit(1);
}

// Extract the connection URL and clean quotes
let databaseUrl = databaseUrlLine.substring(databaseUrlLine.indexOf("=") + 1).trim();
if (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) {
  databaseUrl = databaseUrl.slice(1, -1);
}
if (databaseUrl.startsWith("'") && databaseUrl.endsWith("'")) {
  databaseUrl = databaseUrl.slice(1, -1);
}

// Clean up Prisma-specific query params (like ?schema=public) that are invalid in standard psql
try {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.searchParams.delete("schema");
  databaseUrl = parsedUrl.toString();
} catch (e) {
  // If parsing fails, fall back to the original URL
}

console.log("Menghubungkan ke database lokal...");

// 3. Execute restore using psql without shell to avoid Windows quote escaping issues
// Note: databaseUrl (dbname parameter) must be the LAST argument passed to psql
try {
  console.log("Membersihkan skema database lokal lama...");
  
  const dropCleanSql = "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;";
  
  const dropResult = spawnSync("psql", ["-c", dropCleanSql, databaseUrl], { stdio: "inherit" });
  if (dropResult.error) {
    throw dropResult.error;
  }
  if (dropResult.status !== 0) {
    throw new Error(`psql drop schema command failed with exit code ${dropResult.status}`);
  }
  
  console.log("Memulai pemulihan data dari file backup...");
  
  const restoreResult = spawnSync("psql", ["-f", backupFilePath, databaseUrl], { stdio: "inherit" });
  if (restoreResult.error) {
    throw restoreResult.error;
  }
  if (restoreResult.status !== 0) {
    throw new Error(`psql restore command failed with exit code ${restoreResult.status}`);
  }
  
  console.log("\n========================================================");
  console.log("🎉 BERHASIL: Database lokal telah diperbarui sesuai data backup!");
  console.log("========================================================");
} catch (error) {
  console.error("\n❌ GAGAL: Terjadi kesalahan saat melakukan restore.");
  console.error(error.message);
  console.error("\nTips Penyelesaian:");
  console.error("1. Pastikan PostgreSQL lokal Anda aktif.");
  console.error("2. Pastikan perintah 'psql' sudah ditambahkan ke System Environment PATH Anda.");
  console.error("   (Untuk Windows, biasanya di: C:\\Program Files\\PostgreSQL\\<versi>\\bin)");
  console.error("3. Periksa kecocokan credentials di apps/backend/.env");
  process.exit(1);
}
