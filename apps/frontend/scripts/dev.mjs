import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const distDir = path.join(appDir, "dist");
const entryFile = path.join(appDir, "src", "index.tsx");
const publicDir = path.join(appDir, "public");
const tailwindCliFile = path.join(appDir, "..", "..", "node_modules", "tailwindcss", "lib", "cli.js");

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "4173");
const displayHost = host === "127.0.0.1" ? "localhost" : host;
let shuttingDown = false;

async function ensurePublicFiles() {
  await mkdir(distDir, { recursive: true });
  await copyDirectory(publicDir, distDir);
}

async function copyDirectory(sourceDir, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await copyDirectory(sourcePath, targetPath);
        return;
      }
      if (entry.isFile()) {
        await copyFile(sourcePath, targetPath);
      }
    }),
  );
}

const ctx = await esbuild.context({
  entryPoints: [{ in: entryFile, out: "index" }],
  outdir: distDir,
  bundle: true,
  format: "esm",
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  sourcemap: true,
  logLevel: "info",
});

await ensurePublicFiles();
const tailwindWatcher = spawn(
  process.execPath,
  [tailwindCliFile, "-c", "tailwind.config.cjs", "-i", "src/styles.css", "-o", "dist/index.css", "--watch"],
  {
    cwd: appDir,
    stdio: "inherit",
  },
);

tailwindWatcher.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    console.error(`Tailwind watcher stopped unexpectedly with exit code ${code ?? "unknown"}.`);
  }
});

await ctx.watch();
const server = await ctx.serve({
  servedir: distDir,
  host,
  port,
});

const publicWatcher = watch(publicDir, { recursive: true }, async () => {
  try {
    await ensurePublicFiles();
    console.log("public assets updated");
  } catch (error) {
    console.error("Failed to refresh public assets:", error);
  }
});

console.log(`Frontend dev server running at http://${displayHost}:${server.port}`);
console.log("Watching src, CSS, and public/ assets for changes. Press Ctrl+C to stop.");

async function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  publicWatcher.close();
  if (!tailwindWatcher.killed) {
    tailwindWatcher.kill();
  }
  await ctx.dispose();
  process.exit(0);
}

process.on("SIGINT", () => {
  shutdown().catch((error) => {
    console.error("Failed to stop dev server cleanly:", error);
    process.exit(1);
  });
});

process.on("SIGTERM", () => {
  shutdown().catch((error) => {
    console.error("Failed to stop dev server cleanly:", error);
    process.exit(1);
  });
});
