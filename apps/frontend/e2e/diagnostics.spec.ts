import { test, expect, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { access, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

type StartedBackendServer = {
  apiBaseUrl: string;
  close: () => Promise<void>;
};

type StartedFrontendServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

type LoginUiCredentials = {
  identifier: string;
  password: string;
};

type NestLikeApplication = {
  enableCors: (options?: Record<string, unknown>) => void;
  setGlobalPrefix: (prefix: string) => void;
  useGlobalPipes: (...pipes: unknown[]) => void;
  listen: (port: number, host: string) => Promise<void>;
  close: () => Promise<void>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const backendDir = path.resolve(frontendDir, "..", "backend");
const frontendDistDir = path.resolve(frontendDir, "dist");
const backendDistEntry = path.resolve(backendDir, "dist", "app.module.js");

let backendServer: StartedBackendServer | null = null;
let frontendServer: StartedFrontendServer | null = null;

const DEV_SUPERADMIN_IDENTIFIER = "dev.superadmin";
const DEV_SUPERADMIN_PASSWORD = "DevSuperAdmin#2026";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function allocatePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close(() => {
          reject(new Error("Failed to allocate random port."));
        });
        return;
      }

      const port = address.port;
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function waitForHttpOk(url: string, timeoutMs = 15_000): Promise<void> {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await sleep(150);
  }

  throw new Error(`Timed out waiting for ${url}. Last error: ${lastError}`);
}

function resolveContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".woff2") return "font/woff2";
  return "application/octet-stream";
}

function normalizeFrontendRequestPath(rawUrl: string | undefined): string {
  const parsed = new URL(rawUrl ?? "/", "http://127.0.0.1");
  const decodedPath = decodeURIComponent(parsed.pathname);
  return decodedPath === "/" ? "/index.html" : decodedPath;
}

async function startFrontendStaticServer(): Promise<StartedFrontendServer> {
  const port = await allocatePort();
  const host = "127.0.0.1";

  const server = createServer(async (request, response) => {
    const normalizedPath = normalizeFrontendRequestPath(request.url);
    const relativePath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
    const requestedPath = path.resolve(frontendDistDir, `.${relativePath}`);

    if (!requestedPath.startsWith(frontendDistDir)) {
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

    const fallbackPath = path.resolve(frontendDistDir, "index.html");
    try {
      const body = await readFile(fallbackPath);
      response.statusCode = 200;
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(body);
    } catch {
      response.statusCode = 500;
      response.end("Failed to read frontend build output.");
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      resolve();
    });
  });

  const baseUrl = `http://${host}:${port}`;
  await waitForHttpOk(baseUrl);

  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}
function restoreEnvVar(key: "PORT" | "DATA_SOURCE" | "DATABASE_URL" | "CORS_ORIGINS", previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = previousValue;
}

async function startBackendApiServer(frontendOrigin: string): Promise<StartedBackendServer> {
  const previousPort = process.env.PORT;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousCorsOrigins = process.env.CORS_ORIGINS;
  const port = await allocatePort();
  const host = "127.0.0.1";
  const apiBaseUrl = `http://${host}:${port}/api`;
  process.env.PORT = String(port);

  // Load database URL from backend .env
  let dbUrl = "postgresql://postgres:admin123@127.0.0.1:5432/gtt_ops_rehearsal_20260620_v2?schema=public";
  try {
    const envContent = await readFile(path.resolve(backendDir, ".env"), "utf-8");
    const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"\n'\r]+)["']?/);
    if (dbUrlMatch) {
      dbUrl = dbUrlMatch[1];
    }
  } catch (err) {
    console.warn("Could not read apps/backend/.env file, using default DB URL fallback.");
  }

  process.env.DATA_SOURCE = "prisma";
  process.env.DATABASE_URL = dbUrl;
  process.env.CORS_ORIGINS = frontendOrigin;

  const require = createRequire(import.meta.url);
  Object.keys(require.cache).forEach((key) => {
    const normalizedKey = key.replace(/\\/g, "/");
    if (normalizedKey.includes("apps/backend/dist") || normalizedKey.includes("@nestjs/config")) {
      delete require.cache[key];
    }
  });
  require("reflect-metadata");
  const { NestFactory } = require("@nestjs/core") as typeof import("@nestjs/core");
  const { ValidationPipe } = require("@nestjs/common") as typeof import("@nestjs/common");
  const { AppModule } = require(backendDistEntry) as { AppModule: any };

  let app: NestLikeApplication | null = null;

  try {
    app = (await NestFactory.create(AppModule, {
      logger: false,
    })) as NestLikeApplication;
    app.enableCors({
      origin: true,
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(port, host);
    await waitForHttpOk(`${apiBaseUrl}/health`);
  } catch (error: unknown) {
    if (app) {
      await app.close();
    }
    restoreEnvVar("PORT", previousPort);
    restoreEnvVar("DATA_SOURCE", previousDataSource);
    restoreEnvVar("DATABASE_URL", previousDatabaseUrl);
    restoreEnvVar("CORS_ORIGINS", previousCorsOrigins);
    throw error;
  }

  return {
    apiBaseUrl,
    close: async () => {
      if (app) {
        await app.close();
      }
      restoreEnvVar("PORT", previousPort);
      restoreEnvVar("DATA_SOURCE", previousDataSource);
      restoreEnvVar("DATABASE_URL", previousDatabaseUrl);
      restoreEnvVar("CORS_ORIGINS", previousCorsOrigins);
    },
  };
}
async function openApp(
  page: Page,
  credentials: LoginUiCredentials = {
    identifier: DEV_SUPERADMIN_IDENTIFIER,
    password: DEV_SUPERADMIN_PASSWORD,
  },
): Promise<void> {
  if (!backendServer || !frontendServer) {
    throw new Error("E2E servers were not started.");
  }

  await page.addInitScript((apiBaseUrl: string) => {
    localStorage.clear();
    (globalThis as { __GTT_API_BASE_URL__?: string }).__GTT_API_BASE_URL__ = apiBaseUrl;
  }, backendServer.apiBaseUrl);

  await page.goto(frontendServer.baseUrl, {
    waitUntil: "networkidle",
  });

  await loginViaUi(page, credentials);
}

async function loginViaUi(
  page: Page,
  credentials: LoginUiCredentials = {
    identifier: DEV_SUPERADMIN_IDENTIFIER,
    password: DEV_SUPERADMIN_PASSWORD,
  },
): Promise<void> {
  const loginButton = page.getByRole("button", { name: "Login to Dashboard" });
  if ((await loginButton.count()) === 0) {
    return;
  }

  await page.getByLabel("Email or Username").fill(credentials.identifier);
  await page.locator("#login-password").fill(credentials.password);
  await loginButton.click();
  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();
}

test.beforeAll(async () => {
  await access(path.resolve(frontendDistDir, "index.html"));
  await access(backendDistEntry);
  frontendServer = await startFrontendStaticServer();
  backendServer = await startBackendApiServer(frontendServer.baseUrl);
});

test.afterAll(async () => {
  if (frontendServer) {
    await frontendServer.close();
    frontendServer = null;
  }

  if (backendServer) {
    await backendServer.close();
    backendServer = null;
  }
});

test("Capture diagnostics logs during invoice edit/save", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (msg) => {
    logs.push(msg.text());
  });

  try {
    await openApp(page);

    // Navigate to invoice page
    console.log("--- Navigating to Invoice Page ---");
    await page.goto(`${frontendServer?.baseUrl ?? ""}/invoice`, {
      waitUntil: "networkidle",
    });
    await expect(page.getByRole("heading", { name: "Invoice List" })).toBeVisible();
    // Create an invoice first
    console.log("--- Creating Invoice ---");
    await page.getByRole("button", { name: "New Invoice" }).click();
    await expect(page.locator("#invoice-client")).toBeVisible();
    
    // Click the client dropdown button
    await page.locator("#invoice-client").click();
    // Select the second option from the portal listbox
    await page.getByRole("option").nth(2).click();
    // Click the bank account dropdown button
    await page.locator("#invoice-bank-account").click();
    // Select the first valid bank option (nth(1))
    await page.getByRole("option").nth(1).click();

    // Click Issue Date input to open the datepicker popover
    await page.locator("#invoice-issue-date").click();
    const dateDialog = page.getByRole("dialog", { name: "Select date" });
    await expect(dateDialog).toBeVisible();
    await dateDialog.getByRole("button", { name: "Today" }).click();

    // Fill in package item row 0 details
    const row = page.locator("tbody tr").first();
    await row.locator("textarea[placeholder='Input description / uraian...']").fill("E2E Test Invoice Item");
    await row.locator("input[type='number']").fill("2");
    await row.locator("input[type='text']").fill("15000000");
    
    // Generate invoice
    await page.getByRole("button", { name: "Generate Invoice" }).click();
    await expect(page.getByRole("heading", { name: "Invoice List" })).toBeVisible();

    // Wait to stabilize
    await page.waitForTimeout(1000);

    // Edit the newly created invoice
    console.log("--- Editing Invoice ---");
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(page.locator("#invoice-client")).toBeVisible();
    // Click status dropdown and select "Cancelled" option
    await page.locator("#invoice-status").click();
    await page.getByRole("option", { name: "Cancelled" }).first().click();

    // Click save
    console.log("--- Clicking Save Changes ---");
    await page.getByRole("button", { name: "Save Changes" }).click();

    // Click confirm save in warning modal
    await page.getByRole("button", { name: "Ya, Simpan" }).click();
    // Wait for list screen to render and settle
    await page.waitForTimeout(3000);
  } finally {
    console.log("--- Captured E2E Logs ---");
    const formattedLogs = logs.join("\n");
    console.log(formattedLogs);

    // Write log to appDataDir/brain/currentConversationId/diagnostics_run.log
    const logPath = "C:\\Users\\ghozi\\.gemini\\antigravity-ide\\brain\\6d450fa8-848a-457d-ad78-d25d909c0ba2\\diagnostics_run.log";
    await writeFile(logPath, formattedLogs, "utf-8");
    console.log(`Diagnostics log written to ${logPath}`);
  }
});
