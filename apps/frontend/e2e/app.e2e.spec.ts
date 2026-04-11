import { test, expect, type Page } from "@playwright/test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { access, readFile } from "node:fs/promises";
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

type NestLikeApplication = {
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

const DEV_AUTH_IDENTIFIER = process.env.DEV_AUTH_IDENTIFIER?.trim() || "dev.superadmin";
const DEV_AUTH_PASSWORD = process.env.DEV_AUTH_PASSWORD?.trim() || "DevSuperAdmin#2026";

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

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".js") {
    return "text/javascript; charset=utf-8";
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

function restoreEnvVar(key: "PORT" | "DATA_SOURCE", previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = previousValue;
}

async function startBackendApiServer(): Promise<StartedBackendServer> {
  const previousPort = process.env.PORT;
  const previousDataSource = process.env.DATA_SOURCE;
  const port = await allocatePort();
  const host = "127.0.0.1";
  const apiBaseUrl = `http://${host}:${port}/api`;
  process.env.PORT = String(port);
  process.env.DATA_SOURCE = "memory";

  const require = createRequire(import.meta.url);
  require("reflect-metadata");
  const { NestFactory } = require("@nestjs/core") as typeof import("@nestjs/core");
  const { ValidationPipe } = require("@nestjs/common") as typeof import("@nestjs/common");
  const { AppModule } = require(backendDistEntry) as { AppModule: unknown };

  let app: NestLikeApplication | null = null;

  try {
    app = (await NestFactory.create(AppModule, {
      cors: true,
      logger: false,
    })) as NestLikeApplication;
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
    },
  };
}

async function openApp(page: Page): Promise<void> {
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

  await loginViaUi(page);
}

async function loginViaUi(page: Page): Promise<void> {
  const loginButton = page.getByRole("button", { name: "Login to Dashboard" });
  if ((await loginButton.count()) === 0) {
    return;
  }

  await page.getByLabel("Email or Username").fill(DEV_AUTH_IDENTIFIER);
  await page.locator("#login-password").fill(DEV_AUTH_PASSWORD);
  await loginButton.click();
  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();
}

type OverlayRectSnapshot = {
  top: number;
  left: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  position: string;
  parentTag: string | null;
};

async function getVisibleModalOverlayRect(page: Page): Promise<OverlayRectSnapshot | null> {
  return page.evaluate(() => {
    const overlays = Array.from(document.querySelectorAll<HTMLElement>(".serene-modal-overlay"));
    const visibleOverlay = overlays.find((overlay) => {
      const styles = window.getComputedStyle(overlay);
      const rect = overlay.getBoundingClientRect();
      return styles.display !== "none" && styles.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });

    if (!visibleOverlay) {
      return null;
    }

    const rect = visibleOverlay.getBoundingClientRect();
    const styles = window.getComputedStyle(visibleOverlay);
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      position: styles.position,
      parentTag: visibleOverlay.parentElement?.tagName ?? null,
    };
  });
}

function expectOverlayCoversViewport(overlayRect: OverlayRectSnapshot | null): void {
  expect(overlayRect).not.toBeNull();
  expect(overlayRect?.position).toBe("fixed");
  expect(Math.abs(overlayRect?.top ?? Number.NaN)).toBeLessThanOrEqual(1);
  expect(Math.abs(overlayRect?.left ?? Number.NaN)).toBeLessThanOrEqual(1);
  expect(Math.abs((overlayRect?.height ?? Number.NaN) - (overlayRect?.viewportHeight ?? Number.NaN))).toBeLessThanOrEqual(1);
  expect(Math.abs((overlayRect?.width ?? Number.NaN) - (overlayRect?.viewportWidth ?? Number.NaN))).toBeLessThanOrEqual(1);
}

function buildUniqueSuffix(): string {
  const timeFragment = Date.now().toString().slice(-7);
  const randomFragment = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");
  return `${timeFragment}${randomFragment}`;
}

async function pickTodayDate(page: Page, label: string): Promise<void> {
  await page.getByLabel(label).first().click();
  const dateDialog = page.getByRole("dialog", { name: "Select date" });
  await expect(dateDialog).toBeVisible();
  await dateDialog.getByRole("button", { name: "Today" }).click();
}

async function pickNowTime(page: Page, label: string): Promise<void> {
  await page.getByLabel(label).first().click();
  const timeDialog = page.getByRole("dialog", { name: "Select time" });
  await expect(timeDialog).toBeVisible();
  await timeDialog.getByRole("button", { name: "Now" }).click();
  await timeDialog.getByRole("button", { name: "Apply" }).click();
}

async function createGroupViaWorkspace(page: Page): Promise<{ groupCode: string; groupName: string }> {
  const suffix = buildUniqueSuffix();
  const groupCode = `E2E${suffix}`;
  const groupName = `E2E Group ${suffix}`;

  await page.getByRole("button", { name: "Add New Group" }).click();
  await expect(page.getByRole("heading", { name: "Add New Group" }).first()).toBeVisible();

  await page.getByLabel("Group Number").first().fill(groupCode);
  await page.getByLabel("Group Name").first().fill(groupName);
  await page.getByLabel("Package Type").fill("E2E Package");
  await page.getByLabel("Number of Pax").fill("25");
  await page.getByLabel("Total Bus Required").fill("1");
  await pickTodayDate(page, "Start Date");
  await pickTodayDate(page, "End Date");
  await page.getByLabel("Musyrif Name").fill("Ustadz E2E");
  await page.getByLabel("Phone Number").fill("+6281234567890");

  const openScheduleDetailButton = page.getByRole("button", { name: "Add Schedule Detail" });
  if ((await openScheduleDetailButton.count()) > 0) {
    await openScheduleDetailButton.first().click();
  }

  const saveBaseTripsButton = page.getByRole("button", { name: "Save 5 Base Trips" });
  const isSaveBaseTripsVisible =
    (await saveBaseTripsButton.count()) > 0 && (await saveBaseTripsButton.first().isVisible());

  if (!isSaveBaseTripsVisible) {
    const addBaseTripsButton = page.getByRole("button", { name: "Add 5 Base Trips" });
    if ((await addBaseTripsButton.count()) > 0 && (await addBaseTripsButton.first().isVisible())) {
      await expect(addBaseTripsButton).toBeEnabled();
      await addBaseTripsButton.click();
    }
  }

  await page.getByRole("button", { name: "Go to step 5" }).click();
  await pickNowTime(page, "Flight Return Time");
  await pickNowTime(page, "Hotel Pickup Request Time");

  if ((await saveBaseTripsButton.count()) > 0 && (await saveBaseTripsButton.first().isVisible())) {
    await expect(saveBaseTripsButton).toBeEnabled();
    await saveBaseTripsButton.click();
  }

  const saveGroupButton = page.getByRole("button", { name: "Save Group" });
  await expect(saveGroupButton).toBeEnabled();
  await saveGroupButton.click();

  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();
  await expect(page.getByText(groupCode)).toBeVisible();

  return { groupCode, groupName };
}

test.beforeAll(async () => {
  await access(path.resolve(frontendDistDir, "index.html"));
  await access(backendDistEntry);
  backendServer = await startBackendApiServer();
  frontendServer = await startFrontendStaticServer();
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

test("renders overview with backend group data", async ({ page }) => {
  await openApp(page);

  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();
  await expect(page.getByText("9017000001")).toBeVisible();
  await expect(page.getByRole("button", { name: "View Detail" }).first()).toBeVisible();
});

test("navigates between main screens from sidebar", async ({ page }) => {
  await openApp(page);

  await page.getByRole("button", { name: "H-1 Checklist" }).click();
  await expect(page.getByRole("heading", { name: "H-1 Checklist" })).toBeVisible();

  await page.getByRole("button", { name: "Visa Tracking" }).click();
  await expect(page.getByRole("heading", { name: "Visa Tracking" })).toBeVisible();
});

test("shows loading state instead of keeping the previous screen during lazy route navigation", async ({ page }) => {
  await openApp(page);

  await page.route("**/chunks/*", async (route) => {
    await sleep(1_000);
    await route.continue();
  });

  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();

  await page.getByRole("button", { name: "H-1 Checklist" }).click();

  await expect(page.getByText("Loading screen...")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "H-1 Checklist" })).toBeVisible();
});

test("creates a new group from workspace flow", async ({ page }) => {
  await openApp(page);

  const { groupCode, groupName } = await createGroupViaWorkspace(page);
  const createdCard = page.locator("article").filter({ hasText: groupCode }).first();
  await expect(createdCard).toBeVisible();
  await expect(createdCard.getByText(groupName)).toBeVisible();
});

test("edits group name from group detail modal", async ({ page }) => {
  await openApp(page);

  const { groupCode, groupName } = await createGroupViaWorkspace(page);
  const createdCard = page.locator("article").filter({ hasText: groupCode }).first();
  await createdCard.getByRole("button", { name: "View Detail" }).click();
  await expect(page.getByRole("heading", { name: "Group Detail" })).toBeVisible();

  await page.getByRole("button", { name: /Edit group info/i }).first().click();
  const groupEditModal = page.locator("#group-edit-modal");
  await expect(groupEditModal).toBeVisible();

  const updatedGroupName = `${groupName} Updated`;
  await groupEditModal.getByLabel("Group Name").fill(updatedGroupName);
  await groupEditModal.getByRole("button", { name: "Save Changes" }).click();
  await expect(groupEditModal).toBeHidden();

  await page.getByRole("button", { name: "Back to Groups" }).click();
  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();

  const updatedCard = page.locator("article").filter({ hasText: groupCode }).first();
  await expect(updatedCard).toBeVisible();
  await expect(updatedCard.getByText(updatedGroupName)).toBeVisible();
});

test("uses full-viewport modal overlays in group detail and profile", async ({ page }) => {
  await openApp(page);

  const overviewCard = page.locator("article").filter({ hasText: "9017000001" }).first();
  await expect(overviewCard).toBeVisible();
  await overviewCard.getByRole("button", { name: "View Detail" }).click();
  await expect(page.getByRole("heading", { name: "Group Detail" })).toBeVisible();

  await page.getByRole("button", { name: /Edit group info/i }).first().click();
  expectOverlayCoversViewport(await getVisibleModalOverlayRect(page));
  await page.getByRole("button", { name: "Close edit group popup" }).click();

  await page.getByRole("button", { name: "Back to Groups" }).click();
  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();

  await page.getByRole("button", { name: "Open Profile" }).click();
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();

  await page.getByRole("button", { name: "Edit Profile" }).click();
  expectOverlayCoversViewport(await getVisibleModalOverlayRect(page));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Edit profile" })).toBeHidden();

  await page.getByRole("button", { name: "Change", exact: true }).click();
  expectOverlayCoversViewport(await getVisibleModalOverlayRect(page));
});

test("deletes a group from group detail", async ({ page }) => {
  await openApp(page);

  const { groupCode } = await createGroupViaWorkspace(page);
  const createdCard = page.locator("article").filter({ hasText: groupCode }).first();
  await createdCard.getByRole("button", { name: "View Detail" }).click();
  await expect(page.getByRole("heading", { name: "Group Detail" })).toBeVisible();

  await page.getByRole("button", { name: "Delete Group" }).first().click();
  const deleteGroupModal = page.getByRole("dialog", { name: "Delete this group?" });
  await expect(deleteGroupModal).toBeVisible();
  await deleteGroupModal.getByRole("button", { name: "Delete Group", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Itinerary Overview" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: groupCode })).toHaveCount(0);
});

test("updates payment status from visa detail", async ({ page }) => {
  await openApp(page);

  const groupCode = "9017000001";
  await page.getByRole("button", { name: "Visa Tracking" }).click();
  await expect(page.getByRole("heading", { name: "Visa Tracking" })).toBeVisible();

  const visaTable = page.locator('section[aria-label="Visa tracking table"]');
  await expect(visaTable).toBeVisible();

  const visaRow = visaTable.locator("article").filter({ hasText: groupCode }).first();
  await expect(visaRow).toBeVisible();
  await visaRow.getByRole("button", { name: "View Details" }).click();

  await expect(page.getByRole("button", { name: "Back to Visa Tracking" })).toBeVisible();
  await expect(page.getByRole("heading", { name: groupCode, exact: true })).toBeVisible();

  const paymentSection = page.locator("article").filter({
    has: page.getByRole("heading", { name: "Payment" }),
  });
  await expect(paymentSection).toBeVisible();

  const paymentToggleButton = paymentSection.getByRole("button", {
    name: /Toggle to Paid|Mark as Unpaid/,
  });
  await expect(paymentToggleButton).toBeVisible();
  const buttonLabel = (await paymentToggleButton.textContent())?.trim() ?? "";

  await paymentToggleButton.click();

  if (buttonLabel.includes("Toggle to Paid")) {
    await expect(paymentSection.getByText("Paid", { exact: true })).toBeVisible();
    await expect(
      paymentSection.getByRole("button", { name: "Mark as Unpaid" }),
    ).toBeVisible();
  } else {
    await expect(paymentSection.getByText("Unpaid", { exact: true })).toBeVisible();
    await expect(
      paymentSection.getByRole("button", { name: "Toggle to Paid" }),
    ).toBeVisible();
  }
});
