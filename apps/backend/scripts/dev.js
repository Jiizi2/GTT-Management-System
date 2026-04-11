const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const entryFile = path.join(backendRoot, "dist", "main.js");
const tscCliFile = require.resolve("typescript/bin/tsc", { paths: [backendRoot] });

let compilerProcess = null;
let serverProcess = null;
let shuttingDown = false;

function runInitialBuild() {
  const result = spawnSync(process.execPath, [tscCliFile, "-p", "tsconfig.json"], {
    cwd: backendRoot,
    stdio: "inherit",
  });

  if (result.error) {
    console.error("[backend-dev] Failed to run initial TypeScript build.", result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function startCompilerWatcher() {
  compilerProcess = spawn(
    process.execPath,
    [tscCliFile, "-w", "-p", "tsconfig.json", "--preserveWatchOutput"],
    {
      cwd: backendRoot,
      stdio: "inherit",
    },
  );

  compilerProcess.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(
      `[backend-dev] TypeScript watcher stopped unexpectedly (code: ${code ?? "null"}, signal: ${signal ?? "null"}).`,
    );
    shutdown(code ?? 1);
  });
}

function startServerWatcher() {
  serverProcess = spawn("node", ["--watch", entryFile], {
    cwd: backendRoot,
    stdio: "inherit",
  });

  serverProcess.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(
      `[backend-dev] Node watcher stopped unexpectedly (code: ${code ?? "null"}, signal: ${signal ?? "null"}).`,
    );
    shutdown(code ?? 1);
  });
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (compilerProcess && !compilerProcess.killed) {
    compilerProcess.kill("SIGTERM");
  }

  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
  }

  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

runInitialBuild();
startCompilerWatcher();
startServerWatcher();
