import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

let server: Server;
let baseUrl: string;
const dist = path.resolve(process.cwd(), "dist");
const captures = path.resolve(process.cwd(), "test-results/skeleton-loading");

test.beforeAll(async () => {
  await mkdir(captures, { recursive: true });
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    const candidate = path.resolve(dist, `.${decodeURIComponent(pathname)}`);
    if (!candidate.startsWith(`${dist}${path.sep}`)) {
      res.writeHead(403).end();
      return;
    }
    const types: Record<string, string> = {
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".woff2": "font/woff2",
      ".svg": "image/svg+xml",
      ".png": "image/png",
    };
    try {
      const content = await readFile(candidate);
      res.writeHead(200, { "Content-Type": types[path.extname(candidate)] ?? "application/octet-stream" }).end(content);
    } catch {
      const content = await readFile(path.join(dist, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html" }).end(content);
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Preview server failed");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
const group = {
  id: "g",
  code: "GROUP-001",
  name: "Perjalanan uji",
  lifecycleStatus: "ACTIVE",
  arrivalDate: "2026-10-30",
  returnDate: "2026-11-05",
  pax: 20,
  packageName: "Umrah",
  totalBuses: 1,
  musyrif: null,
  notes: [],
  itinerary: [],
};
const draft = {
  id: "d",
  city: "MAKKAH",
  hotelName: "Hotel data terakhir",
  agreementNumber: "AGR-001",
  groupName: "Group uji",
  pax: 20,
  status: "APPROVED",
  stayStart: "2026-10-30",
  stayEnd: "2026-11-05",
  remainingPax: 20,
  assignmentStatus: "Unassigned",
  editable: false,
  assignedGroups: [],
};
const agentSession = {
  expiresAt: "2099-01-01",
  user: {
    portalUserId: "portal-a",
    agentId: "agent-a",
    displayName: "Operator Agent",
    email: "agent@example.test",
    agentCode: "AGENT-A",
    agentName: "Agent Uji",
    mustChangePassword: false,
    exp: 4070908800,
  },
};
const opsSession = {
  expiresAt: "2099-01-01",
  rememberSession: false,
  user: { id: "u", name: "Admin Uji", username: "admin", email: "admin@example.test", accessTier: "super-admin" },
};

async function fixture(page: Page) {
  const state = { gate: gate(), status: 200, drafts: [] as (typeof draft)[], requests: [] as string[] };
  await page.addInitScript(() => {
    (window as unknown as { __GTT_API_BASE_URL__: string }).__GTT_API_BASE_URL__ = `${location.origin}/api`;
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname.replace("/api", "");
    expect(route.request().method()).toBe("GET");
    if (pathname === "/agent/auth/session" || pathname === "/auth/session") {
      await route.fulfill({ json: pathname.startsWith("/agent/") ? agentSession : opsSession });
      return;
    }
    const requestState = { gate: state.gate, status: state.status, drafts: state.drafts };
    state.requests.push(pathname);
    await requestState.gate.promise;
    if (route.request().failure()) return;
    if (requestState.status !== 200) {
      await route.fulfill({ status: requestState.status, json: { message: "Simulated network failure" } });
      return;
    }
    let data: unknown = [];
    if (pathname === "/agent/groups") data = { items: [], total: 0, page: 1, pageSize: 50 };
    else if (pathname === "/agent/groups/GROUP-001") data = group;
    else if (pathname.endsWith("/visa") && pathname.startsWith("/agent/groups/"))
      data = { status: "PENDING", issuedDate: null, syarikah: null, busStatus: "VISA_PLUS", paymentStatus: "PAID" };
    else if (pathname === "/agent/dashboard")
      data = {
        groups: { journeys: 0, total: 0, active: 0, completed: 0, archived: 0, upcoming: 0, totalPax: 0 },
        attention: { visaGroups: 0, hotelGroups: 0 },
        upcomingGroups: [],
        recentTimeline: [],
      };
    else if (pathname === "/agent/profile")
      data = { account: { displayName: "Operator Agent" }, agent: { code: "AGENT-A", name: "Agent Uji" } };
    else if (pathname === "/agent/agreement-drafts") data = requestState.drafts;
    else if (pathname === "/health") data = { dataSource: "prisma" };
    else if (pathname === "/analytics/operational")
      data = { totals: { groups: 0, pax: 0, activeGroups: 0, completedGroups: 0 }, monthly: [], packages: [] };
    else if (pathname === "/analytics/visa")
      data = {
        totals: { totalPax: 0, issuedPax: 0, notIssuedPax: 0, issuedRate: 0, missingIssuedDatePax: 0 },
        monthly: [],
        funnel: [],
      };
    else if (pathname === "/analytics/agents") data = { agents: [] };
    await route.fulfill({ json: data });
  });
  return state;
}

const surfaces = [
  ["/overview", "Itinerary Overview"],
  ["/visa", "Visa Tracking"],
  ["/groups/GROUP-001", "Detail Group"],
  ["/visa/GROUP-001", "Detail Visa"],
  ["/statistics", "Statistik & Performa"],
  ["/invoice", "Invoice List"],
  ["/checklist", "H-1 Checklist"],
  ["/master-data", "Master Data"],
  ["/user-management", "User Management"],
  ["/agent/overview", "Dashboard"],
  ["/agent/groups", "Perjalanan"],
  ["/agent/groups/GROUP-001", "Detail perjalanan"],
  ["/agent/visa", "Visa Tracking"],
  ["/agent/visa/GROUP-001", "Detail visa"],
  ["/agent/agreement-inbox", "Agreement Inbox"],
  ["/agent/checklist", "H-1 Checklist"],
  ["/agent/profile", "Profile"],
] as const;

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`initial loading, empty results, responsive shapes and reduced motion at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const state = await fixture(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const [route, heading] of surfaces) {
      await test.step(route, async () => {
        state.gate = gate();
        await page.goto(`${baseUrl}${route}`);
        await expect(page.locator(".serene-route-surface > div")).toBeVisible();
        await expect(page.getByRole("heading", { name: heading, exact: true }).first()).toBeVisible();
        await expect(page.locator(".serene-skeleton").first()).toBeVisible();
        expect(
          await page
            .locator(".serene-skeleton")
            .first()
            .evaluate((node) => getComputedStyle(node).animationName),
        ).toBe("none");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (route === "/statistics" && viewport.width === 1440) {
          const tops = await page
            .locator('[aria-label="Ringkasan metrik"] .serene-card')
            .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
          expect(tops).toHaveLength(4);
          expect(new Set(tops).size).toBe(1);
        }
        if (["/overview", "/statistics", "/agent/overview", "/agent/groups"].includes(route)) {
          await page.screenshot({
            path: path.join(captures, `${route.slice(1).replaceAll("/", "-")}-${viewport.width}.png`),
            fullPage: true,
          });
        }
        state.gate.release();
        await expect(page.locator(".serene-skeleton")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      });
    }
    expect(errors).toEqual([]);
  });
}

test("failed refresh retains agreements and a retry recovers without replacing the list", async ({ page }) => {
  const state = await fixture(page);
  state.drafts = [draft];
  state.gate.release();
  await page.goto(`${baseUrl}/agent/agreement-inbox`);
  await expect(page.getByRole("heading", { name: draft.hotelName })).toBeVisible();
  state.gate = gate();
  state.status = 500;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByText("Memperbarui data…")).toBeVisible();
  await expect(page.getByRole("heading", { name: draft.hotelName })).toBeVisible();
  await expect(page.locator(".serene-skeleton")).toHaveCount(0);
  state.gate.release();
  await expect(page.getByText(/Gagal memperbarui/)).toBeVisible();
  await expect(page.getByRole("heading", { name: draft.hotelName })).toBeVisible();
  state.gate = gate();
  state.status = 200;
  state.gate.release();
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByText(/Gagal memperbarui/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: draft.hotelName })).toBeVisible();
});

test("dark theme uses shared tokens with gentle motion", async ({ page }) => {
  const state = await fixture(page);
  await page.addInitScript(() => localStorage.setItem("serene-ui-theme", "dark"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/agent/groups`);
  await expect(page.locator(".serene-skeleton").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const style = await page
    .locator(".serene-skeleton")
    .first()
    .evaluate((node) => ({
      animation: getComputedStyle(node).animationName,
      duration: getComputedStyle(node).animationDuration,
      background: getComputedStyle(node).backgroundColor,
    }));
  expect(style.animation).toBe("serene-skeleton-pulse");
  expect(style.duration).toBe("1.8s");
  expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
  await page.screenshot({ path: path.join(captures, "agent-groups-dark-390.png"), fullPage: true });
  state.gate.release();
  await expect(page.locator(".serene-skeleton")).toHaveCount(0);
});

test("navigation during a pending request keeps the destination context", async ({ page }) => {
  const state = await fixture(page);
  const previousGate = state.gate;
  await page.goto(`${baseUrl}/agent/groups`);
  await expect(page.getByRole("heading", { name: "Perjalanan", exact: true })).toBeVisible();
  await expect(page.locator(".serene-skeleton").first()).toBeVisible();
  state.gate = gate();
  await page.getByRole("link", { name: "Visa Tracking", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Visa Tracking", exact: true })).toBeVisible();
  state.gate.release();
  await expect(page.getByRole("heading", { name: "Belum ada pengajuan visa" })).toBeVisible();
  previousGate.release();
  await expect(page.getByRole("heading", { name: "Perjalanan", exact: true })).toHaveCount(0);
  await expect(page.locator(".serene-skeleton")).toHaveCount(0);
});

test("an initial failure stops loading and retry restores profile data", async ({ page }) => {
  const state = await fixture(page);
  state.status = 500;
  state.gate.release();
  await page.goto(`${baseUrl}/agent/profile`);
  await expect(page.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator(".serene-skeleton")).toHaveCount(0);
  state.status = 200;
  await page.getByRole("button", { name: "Coba lagi", exact: true }).click();
  await expect(page.getByText("Nama pengguna", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const surface of [
  {
    name: "Admin",
    start: "/overview",
    title: "Itinerary Overview",
    link: "H-1 Checklist",
    chunk: "**/chunks/checklist-page-*.js",
    destination: "H-1 Checklist",
    dataLoadingLabel: "Memuat checklist H-1…",
    role: "link" as const,
  },
  {
    name: "Agent",
    start: "/agent/groups",
    title: "Perjalanan",
    link: "Dashboard",
    chunk: "**/chunks/dashboard-page-*.js",
    destination: "Dashboard",
    dataLoadingLabel: "Memuat ringkasan…",
    role: "link" as const,
  },
  {
    name: "Agent trips",
    start: "/agent/overview",
    title: "Dashboard",
    link: "Perjalanan",
    chunk: "**/chunks/trips-page-*.js",
    destination: "Perjalanan",
    dataLoadingLabel: "Memuat perjalanan…",
    role: "link" as const,
  },
]) {
  test(`${surface.name} uses only skeletons while page code and data load`, async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const state = await fixture(page);
    state.gate.release();
    await page.goto(`${baseUrl}${surface.start}`);
    await expect(page.getByRole("heading", { name: surface.title, exact: true })).toBeVisible();
    await expect(page.locator(".serene-skeleton")).toHaveCount(0);
    const chunk = gate();
    await page.route(surface.chunk, async (route) => {
      await chunk.promise;
      await route.continue();
    });
    state.gate = gate();
    try {
      await page.getByRole(surface.role, { name: surface.link, exact: true }).first().click();
      await expect(page.getByRole("status", { name: "Memuat halaman…", exact: true })).toBeVisible();
      await expect(page.locator(".serene-skeleton").first()).toBeVisible();
      await expect(page.getByText("Loading screen...", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Memuat halaman...", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: surface.title, exact: true })).toHaveCount(0);
      const beforeRoot = await page
        .getByRole("status", { name: "Memuat halaman…", exact: true })
        .locator("..")
        .boundingBox();
      const beforeBody = await page.getByRole("status", { name: surface.dataLoadingLabel, exact: true }).boundingBox();
      chunk.release();
      await expect(page.locator(".serene-route-surface > div")).toBeVisible();
      await expect(page.getByRole("heading", { name: surface.destination, exact: true })).toBeVisible();
      await expect(page.locator(".serene-skeleton").first()).toBeVisible();
      const afterRoot = await page.locator(".serene-route-surface > div").boundingBox();
      const afterBody = await page.getByRole("status", { name: surface.dataLoadingLabel, exact: true }).boundingBox();
      expect(beforeRoot).not.toBeNull();
      expect(afterRoot).not.toBeNull();
      expect(beforeBody).not.toBeNull();
      expect(afterBody).not.toBeNull();
      for (const coordinate of ["x", "y", "width"] as const) {
        expect(Math.abs(beforeRoot![coordinate] - afterRoot![coordinate])).toBeLessThanOrEqual(1);
        expect(Math.abs(beforeBody![coordinate] - afterBody![coordinate])).toBeLessThanOrEqual(1);
      }
      state.gate.release();
      await expect(page.locator(".serene-skeleton")).toHaveCount(0);
    } finally {
      chunk.release();
      state.gate.release();
    }
  });
}
