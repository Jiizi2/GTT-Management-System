const { execSync } = require("node:child_process");

const DEFAULT_PORT = 3001;

function resolvePort() {
  const rawPort = process.env.PORT?.trim();
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number(rawPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    console.warn(
      `[dev-port-guard] Ignoring invalid PORT='${process.env.PORT}', falling back to ${DEFAULT_PORT}.`,
    );
    return DEFAULT_PORT;
  }

  return parsedPort;
}

function runCommand(command) {
  return execSync(command, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function readListeningPidsWindows(port) {
  const output = runCommand(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`);
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const columns = trimmedLine.split(/\s+/);
    const state = columns[3]?.toUpperCase() ?? "";
    if (state !== "LISTENING") {
      continue;
    }

    const localAddress = columns[1] ?? "";
    if (!localAddress.includes(`:${port}`)) {
      continue;
    }

    const pid = Number(columns[4]);
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      pids.add(pid);
    }
  }

  return Array.from(pids);
}

function readListeningPidsPosix(port) {
  const output = runCommand(`lsof -tiTCP:${port} -sTCP:LISTEN`);
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const pid = Number(line.trim());
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      pids.add(pid);
    }
  }

  return Array.from(pids);
}

function readListeningPids(port) {
  try {
    if (process.platform === "win32") {
      return readListeningPidsWindows(port);
    }

    return readListeningPidsPosix(port);
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (process.platform === "win32") {
    runCommand(`taskkill /PID ${pid} /T /F`);
    return;
  }

  runCommand(`kill -TERM ${pid}`);
}

function readProcessName(pid) {
  try {
    if (process.platform === "win32") {
      const output = runCommand(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`).trim();
      const match = output.match(/^"([^"]+)"/);
      return match?.[1]?.trim() ?? "";
    }

    return runCommand(`ps -p ${pid} -o comm=`).trim();
  } catch {
    return "";
  }
}

function isNodeProcessName(processName) {
  const normalized = processName.trim().toLowerCase();
  return normalized === "node" || normalized === "node.exe";
}

function main() {
  const port = resolvePort();
  const pids = readListeningPids(port);
  if (pids.length === 0) {
    return;
  }

  console.log(
    `[dev-port-guard] Port ${port} is busy (PID: ${pids.join(", ")}). Attempting to free it...`,
  );

  const failedPids = [];
  for (const pid of pids) {
    const processName = readProcessName(pid);
    if (!isNodeProcessName(processName)) {
      failedPids.push({
        pid,
        error: new Error(
          `Refusing to terminate non-node process '${processName || "unknown"}' that is using port ${port}.`,
        ),
      });
      continue;
    }

    try {
      killPid(pid);
    } catch (error) {
      failedPids.push({ pid, error });
    }
  }

  if (failedPids.length > 0) {
    const details = failedPids
      .map(({ pid, error }) => {
        const message = error instanceof Error ? error.message.trim() : String(error);
        return `PID ${pid}: ${message}`;
      })
      .join(" | ");
    throw new Error(`Unable to release port ${port}. ${details}`);
  }

  const remainingPids = readListeningPids(port);
  if (remainingPids.length > 0) {
    throw new Error(`Port ${port} is still in use by PID: ${remainingPids.join(", ")}.`);
  }

  console.log(`[dev-port-guard] Port ${port} is now free.`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[dev-port-guard] ${message}`);
  process.exit(1);
}
