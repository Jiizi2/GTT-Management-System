import { spawnSync } from "node:child_process";
import process from "node:process";
import "dotenv/config";

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SAFE_DATABASE_NAME_PATTERN = /(?:^|[_-])(qa|test)(?:$|[_-])/i;

function fail(message) {
  console.error("[integration] " + message);
  process.exit(1);
}

function resolveTestDatabase() {
  const rawUrl = process.env.TEST_DATABASE_URL?.trim();
  if (!rawUrl) {
    fail(
      "TEST_DATABASE_URL wajib diisi. Gunakan database PostgreSQL lokal khusus QA, misalnya gtt_ops_test.",
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    fail("TEST_DATABASE_URL bukan URL PostgreSQL yang valid.");
  }

  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    fail("TEST_DATABASE_URL harus menggunakan protocol postgresql:// atau postgres://.");
  }

  if (!LOCAL_DATABASE_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    fail(
      "Host '" +
        parsedUrl.hostname +
        "' ditolak. Integration test hanya boleh memakai database loopback lokal.",
    );
  }

  const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, "")).trim();
  if (!databaseName || !SAFE_DATABASE_NAME_PATTERN.test(databaseName)) {
    fail(
      "Database '" +
        (databaseName || "<kosong>") +
        "' ditolak. Nama database wajib memuat token 'test' atau 'qa'.",
    );
  }

  const portLabel = parsedUrl.port ? ":" + parsedUrl.port : "";
  return {
    databaseName,
    rawUrl,
    targetLabel: parsedUrl.hostname + portLabel + "/" + databaseName,
  };
}

function runNpmScript(scriptName, env) {
  // Invoking npm.cmd directly with shell=false can fail with EINVAL on Windows.
  // npm_execpath points at npm-cli.js whenever this runner is launched through npm,
  // so execute that script with the current Node binary on every platform.
  const npmCliPath = process.env.npm_execpath;
  const executable = npmCliPath
    ? process.execPath
    : process.platform === "win32"
      ? "npm.cmd"
      : "npm";
  const args = npmCliPath
    ? [npmCliPath, "run", scriptName]
    : ["run", scriptName];
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      "npm run " + scriptName + " gagal dengan exit code " + (result.status ?? "unknown") + ".",
    );
  }
}

const testDatabase = resolveTestDatabase();
const testEnvironment = {
  ...process.env,
  DATABASE_URL: testDatabase.rawUrl,
  TEST_DATABASE_URL: testDatabase.rawUrl,
};

console.log("[integration] Target database tervalidasi: " + testDatabase.targetLabel);

try {
  console.log("[integration] Menghasilkan Prisma Client dari schema repo...");
  runNpmScript("db:generate", testEnvironment);
  console.log("[integration] Menerapkan migration repo ke database QA...");
  runNpmScript("db:deploy", testEnvironment);
  console.log("[integration] Menjalankan seluruh suite Prisma melalui Vitest...");
  runNpmScript("test:integration:vitest", testEnvironment);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
}
