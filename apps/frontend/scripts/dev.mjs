import * as esbuild from "esbuild";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { watch } from "node:fs";
import { copyFile, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeRuntimeConfigFile } from "./runtime-config.mjs";

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
const backendProxyOrigin = process.env.GTT_DEV_BACKEND_ORIGIN?.trim() || "http://127.0.0.1:3001";
let shuttingDown = false;
let httpServer = null;

function resolveContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".js" || extension === ".mjs") {
    return "application/javascript; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".json") {
    return "application/json; charset=utf-8";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".woff2") {
    return "font/woff2";
  }

  return "application/octet-stream";
}

function normalizeRequestPath(rawUrl) {
  const parsedUrl = new URL(rawUrl ?? "/", "http://127.0.0.1");
  const decodedPath = decodeURIComponent(parsedUrl.pathname);
  return decodedPath === "/" ? "/index.html" : decodedPath;
}

function isApiRequestPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

async function proxyApiRequest(request, response) {
  const targetUrl = new URL(request.url ?? "/", backendProxyOrigin);
  const proxyRequest = (targetUrl.protocol === "https:" ? httpsRequest : httpRequest)(targetUrl, {
    method: request.method,
    headers: {
      ...request.headers,
      host: targetUrl.host,
    },
  });

  proxyRequest.on("response", (proxyResponse) => {
    response.statusCode = proxyResponse.statusCode ?? 502;
    for (const [headerName, headerValue] of Object.entries(proxyResponse.headers)) {
      if (headerValue === undefined) {
        continue;
      }

      response.setHeader(headerName, headerValue);
    }

    proxyResponse.pipe(response);
  });

  proxyRequest.on("error", (error) => {
    response.statusCode = 502;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        message: `Failed to reach backend at ${backendProxyOrigin}: ${error.message}`,
      }),
    );
  });

  request.pipe(proxyRequest);
}

async function startSpaServer() {
  const server = createServer(async (request, response) => {
    const normalizedPath = normalizeRequestPath(request.url);

    if (isApiRequestPath(normalizedPath)) {
      await proxyApiRequest(request, response);
      return;
    }

    const relativePath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
    const requestedPath = path.resolve(distDir, `.${relativePath}`);

    if (!requestedPath.startsWith(distDir)) {
      response.statusCode = 403;
      response.end("Forbidden");
      return;
    }

    const hasExtension = path.extname(requestedPath).length > 0;

    try {
      const body = await readFile(requestedPath);
      response.statusCode = 200;
      response.setHeader("content-type", resolveContentType(requestedPath));
      response.end(body);
      return;
    } catch {
      if (hasExtension) {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }
    }

    try {
      const fallbackBody = await readFile(path.join(distDir, "index.html"));
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(fallbackBody);
    } catch {
      response.statusCode = 500;
      response.end("Failed to read frontend build output.");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  return server;
}

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
await writeRuntimeConfigFile(distDir);
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
httpServer = await startSpaServer();

const publicWatcher = watch(publicDir, { recursive: true }, async () => {
  try {
    await ensurePublicFiles();
    console.log("public assets updated");
  } catch (error) {
    console.error("Failed to refresh public assets:", error);
  }
});

console.log(`Frontend dev server running at http://${displayHost}:${port}`);
console.log(`Proxying /api requests to ${backendProxyOrigin}`);
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
  if (httpServer) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
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
