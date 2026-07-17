import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VALID_KINDS = new Set(["scheduled", "predeploy"]);

function required(environment, name) {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} wajib di-set.`);
  return value;
}

export function parseKind(args) {
  const kindIndex = args.indexOf("--kind");
  const kind = kindIndex >= 0 ? args[kindIndex + 1] : "scheduled";
  if (!VALID_KINDS.has(kind)) {
    throw new Error("--kind harus scheduled atau predeploy.");
  }
  return kind;
}

export function loadConfig(environment = process.env) {
  const stagingDir = path.resolve(required(environment, "BACKUP_STAGING_DIR"));
  const rcloneRemote = required(environment, "BACKUP_RCLONE_REMOTE").replace(/\/+$/u, "");
  const filesystemRoot = path.parse(stagingDir).root;
  if (stagingDir === filesystemRoot) {
    throw new Error("BACKUP_STAGING_DIR tidak boleh filesystem root.");
  }
  const relativeToRepo = path.relative(process.cwd(), stagingDir);
  const insideRepository =
    relativeToRepo === "" ||
    (!relativeToRepo.startsWith(`..${path.sep}`) &&
      relativeToRepo !== ".." &&
      !path.isAbsolute(relativeToRepo));
  if (insideRepository) {
    throw new Error("BACKUP_STAGING_DIR harus berada di luar repository.");
  }
  if (!/^[A-Za-z0-9_.-]+:/u.test(rcloneRemote)) {
    throw new Error("BACKUP_RCLONE_REMOTE harus memakai nama remote rclone, bukan path lokal.");
  }

  return {
    stagingDir,
    ageRecipientsFile: path.resolve(required(environment, "BACKUP_AGE_RECIPIENTS_FILE")),
    rcloneRemote,
    composeFile: path.resolve(environment.BACKUP_COMPOSE_FILE || "docker-compose.prod.yml"),
    stateFile: path.resolve(environment.BACKUP_STATE_FILE || "/var/lib/gtt-backup/last-success.json"),
    database: environment.POSTGRES_DB?.trim() || "gtt_ops",
    releaseSha: environment.RELEASE_SHA?.trim(),
    dockerCommand: environment.DOCKER_COMMAND || "docker",
    ageCommand: environment.AGE_COMMAND || "age",
    rcloneCommand: environment.RCLONE_COMMAND || "rclone",
  };
}

export function retentionPrefixes(kind, date) {
  if (kind === "predeploy") return ["predeploy"];
  const prefixes = ["six-hour"];
  if (date.getUTCHours() < 6) prefixes.push("daily");
  if (date.getUTCDate() === 1 && date.getUTCHours() < 6) prefixes.push("monthly");
  return prefixes;
}

export function latestMigration(repoRoot = process.cwd()) {
  const directory = path.join(repoRoot, "apps", "backend", "prisma", "migrations");
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .at(-1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { shell: false, encoding: "utf8", ...options });
  if (result.error) throw new Error(`${command} gagal dijalankan: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = result.stderr?.trim();
    throw new Error(`${command} exit ${result.status}${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
  } catch {
    // Cleanup errors must not hide the original backup failure.
  }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

function resolveReleaseSha(config) {
  if (config.releaseSha) return config.releaseSha;
  const result = run("git", ["rev-parse", "HEAD"]);
  return result.stdout.trim();
}

function verifyRemote(config, remotePath, expectedSha, temporaryPath) {
  run(config.rcloneCommand, ["copyto", remotePath, temporaryPath]);
  const actualSha = sha256(temporaryPath);
  safeUnlink(temporaryPath);
  if (actualSha !== expectedSha) {
    throw new Error(`Checksum hasil download verifikasi tidak cocok untuk ${remotePath}.`);
  }
}

export function buildManifest({ timestamp, kind, config, dumpPath, encryptedPath, releaseSha }) {
  return {
    formatVersion: 1,
    timestampUtc: timestamp.toISOString(),
    kind,
    database: config.database,
    plaintextBytes: fs.statSync(dumpPath).size,
    plaintextSha256: sha256(dumpPath),
    ciphertextBytes: fs.statSync(encryptedPath).size,
    ciphertextSha256: sha256(encryptedPath),
    releaseSha,
    latestMigration: latestMigration(),
    encryption: "age",
  };
}

export function executeBackup({ kind = "scheduled", environment = process.env, now = new Date() } = {}) {
  const config = loadConfig(environment);
  if (!fs.existsSync(config.composeFile)) throw new Error("BACKUP_COMPOSE_FILE tidak ditemukan.");
  if (!fs.statSync(config.composeFile).isFile()) throw new Error("BACKUP_COMPOSE_FILE bukan file.");
  if (!fs.existsSync(config.ageRecipientsFile) || !fs.statSync(config.ageRecipientsFile).isFile()) {
    throw new Error("BACKUP_AGE_RECIPIENTS_FILE tidak ditemukan atau bukan file.");
  }

  fs.mkdirSync(config.stagingDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(config.stagingDir, 0o700);
  const stamp = now.toISOString().replaceAll(/[-:]/gu, "").replace(".000Z", "Z");
  const basename = `gtt-${kind}-${stamp}`;
  const dumpPath = path.join(config.stagingDir, `${basename}.sql`);
  const encryptedPath = `${dumpPath}.age`;
  const manifestPath = `${encryptedPath}.manifest.json`;
  const verifyPath = `${encryptedPath}.${process.pid}.verify`;

  try {
    const dumpFd = fs.openSync(dumpPath, "wx", 0o600);
    try {
      run(
        config.dockerCommand,
        [
          "compose",
          "-f",
          config.composeFile,
          "exec",
          "-T",
          "postgres",
          "sh",
          "-c",
          'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --no-owner --no-privileges',
        ],
        { stdio: ["ignore", dumpFd, "pipe"] },
      );
    } finally {
      fs.closeSync(dumpFd);
    }
    if (!fs.statSync(dumpPath).isFile() || fs.statSync(dumpPath).size === 0) {
      throw new Error("pg_dump menghasilkan file kosong atau bukan regular file.");
    }

    run(config.ageCommand, ["--encrypt", "--recipients-file", config.ageRecipientsFile, "--output", encryptedPath, dumpPath]);
    const manifest = buildManifest({
      timestamp: now,
      kind,
      config,
      dumpPath,
      encryptedPath,
      releaseSha: resolveReleaseSha(config),
    });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

    const remoteObjects = [];
    for (const prefix of retentionPrefixes(kind, now)) {
      const remoteBase = `${config.rcloneRemote}/${prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const encryptedRemote = `${remoteBase}/${path.basename(encryptedPath)}`;
      const manifestRemote = `${remoteBase}/${path.basename(manifestPath)}`;
      run(config.rcloneCommand, ["copyto", encryptedPath, encryptedRemote]);
      verifyRemote(config, encryptedRemote, manifest.ciphertextSha256, verifyPath);
      run(config.rcloneCommand, ["copyto", manifestPath, manifestRemote]);
      verifyRemote(config, manifestRemote, sha256(manifestPath), verifyPath);
      remoteObjects.push({ encrypted: encryptedRemote, manifest: manifestRemote });
    }

    const success = { ...manifest, completedAtUtc: new Date().toISOString(), remoteObjects };
    writeJsonAtomic(config.stateFile, success);
    return success;
  } finally {
    safeUnlink(verifyPath);
    safeUnlink(dumpPath);
    safeUnlink(encryptedPath);
    safeUnlink(manifestPath);
  }
}

export function main(args = process.argv.slice(2), environment = process.env) {
  try {
    const result = executeBackup({ kind: parseKind(args), environment });
    console.log(JSON.stringify({ status: "success", ...result }));
  } catch (error) {
    console.error(`BACKUP_FAILED: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
