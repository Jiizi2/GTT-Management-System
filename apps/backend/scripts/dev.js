const { spawn } = require("node:child_process");
const path = require("node:path");

const backendRoot = path.resolve(__dirname, "..");
const entryFile = path.join(backendRoot, "dist", "main.js");
const tscCliFile = require.resolve("typescript/bin/tsc", { paths: [backendRoot] });

let compilerProcess = null;
let serverProcess = null;
let shuttingDown = false;
let hasSuccessfulBuild = false;
let restartingServer = false;
let pendingRestart = false;
const compilerOutputBuffers = {
  stdout: "",
  stderr: "",
};

function handleCompilerLine(line) {
  const normalizedLine = line.trim();
  if (!normalizedLine) {
    return;
  }

  if (/Found 0 errors?\. Watching for file changes\./.test(normalizedLine)) {
    restartServerAfterSuccessfulBuild();
  }
}

function flushCompilerOutput(streamName, flushRemainder = false) {
  const buffer = compilerOutputBuffers[streamName];
  const lines = buffer.split(/\r?\n/);
  if (!flushRemainder) {
    compilerOutputBuffers[streamName] = lines.pop() ?? "";
  } else {
    compilerOutputBuffers[streamName] = "";
  }

  for (const line of lines) {
    handleCompilerLine(line);
  }
}

function forwardCompilerOutput(streamName, chunk) {
  const text = chunk.toString();
  compilerOutputBuffers[streamName] += text;
  process[streamName].write(text);
  flushCompilerOutput(streamName, false);
}

function startServerProcess() {
  if (shuttingDown || serverProcess) {
    return;
  }

  serverProcess = spawn(process.execPath, [entryFile], {
    cwd: backendRoot,
    stdio: "inherit",
  });

  serverProcess.on("exit", (code, signal) => {
    const shouldRestart = restartingServer;
    serverProcess = null;

    if (shuttingDown) {
      return;
    }

    if (shouldRestart) {
      restartingServer = false;
      startServerProcess();

      if (pendingRestart) {
        pendingRestart = false;
        restartServerAfterSuccessfulBuild();
      }

      return;
    }

    console.error(
      `[backend-dev] Backend process stopped unexpectedly (code: ${code ?? "null"}, signal: ${signal ?? "null"}).`,
    );
    shutdown(code ?? 1);
  });
}

function restartServerAfterSuccessfulBuild() {
  if (shuttingDown) {
    return;
  }

  if (!hasSuccessfulBuild) {
    hasSuccessfulBuild = true;
    startServerProcess();
    return;
  }

  if (!serverProcess) {
    startServerProcess();
    return;
  }

  if (restartingServer) {
    pendingRestart = true;
    return;
  }

  restartingServer = true;
  console.log("[backend-dev] TypeScript build completed. Restarting backend server...");
  serverProcess.kill("SIGTERM");
}

function startCompilerWatcher() {
  compilerProcess = spawn(
    process.execPath,
    [tscCliFile, "-w", "-p", "tsconfig.json", "--preserveWatchOutput", "--pretty", "false"],
    {
      cwd: backendRoot,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  compilerProcess.stdout.on("data", (chunk) => {
    forwardCompilerOutput("stdout", chunk);
  });
  compilerProcess.stderr.on("data", (chunk) => {
    forwardCompilerOutput("stderr", chunk);
  });

  compilerProcess.on("exit", (code, signal) => {
    flushCompilerOutput("stdout", true);
    flushCompilerOutput("stderr", true);

    if (shuttingDown) {
      return;
    }

    console.error(
      `[backend-dev] TypeScript watcher stopped unexpectedly (code: ${code ?? "null"}, signal: ${signal ?? "null"}).`,
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

startCompilerWatcher();
