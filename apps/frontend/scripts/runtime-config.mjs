import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const distDir = path.join(appDir, "dist");

function resolveConfiguredApiBaseUrl() {
  const rawValue = process.env.GTT_API_BASE_URL ?? "";
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return "";
  }

  return trimmedValue.replace(/\/+$/, "");
}

function buildRuntimeConfigSource(apiBaseUrl) {
  return [
    "(function () {",
    "  const existing = globalThis.__GTT_API_BASE_URL__;",
    "  if (typeof existing === \"string\" && existing.trim()) {",
    "    return;",
    "  }",
    "",
    `  globalThis.__GTT_API_BASE_URL__ = ${JSON.stringify(apiBaseUrl)};`,
    "})();",
  ].join("\n");
}

export async function writeRuntimeConfigFile(targetDir = distDir) {
  const apiBaseUrl = resolveConfiguredApiBaseUrl();
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, "runtime-config.js"), buildRuntimeConfigSource(apiBaseUrl), "utf8");
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  await writeRuntimeConfigFile();
}
