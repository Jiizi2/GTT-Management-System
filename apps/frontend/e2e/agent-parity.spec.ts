import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";

let server: Server;
let baseUrl: string;
const dist = path.resolve(process.cwd(), "dist");
const captureDir = path.resolve(process.cwd(), ".impeccable/review/agent-parity");
test.beforeAll(async () => {
  await mkdir(captureDir, { recursive: true });
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    const candidate = path.resolve(dist, `.${decodeURIComponent(pathname)}`);
    if (!candidate.startsWith(`${dist}${path.sep}`) && candidate !== dist) {
      res.writeHead(403).end();
      return;
    }
    let file = candidate;
    try {
      const content = await readFile(file);
      const types: Record<string, string> = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".woff2": "font/woff2",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      };
      res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream" }).end(content);
    } catch {
      file = path.join(dist, "index.html");
      res.writeHead(200, { "Content-Type": "text/html" }).end(await readFile(file));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Preview server failed");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

const itinerary = [
  {
    id: "trip-1",
    sortOrder: 0,
    dateLabel: "5 Okt",
    yearLabel: "2026",
    category: "Arrival",
    title: "Kedatangan di Jeddah",
    isoDate: "2026-10-05T00:00:00Z",
    time: "09:00",
    flightNumber: "GA980",
    hotelName: null,
    fromHotelName: null,
    fromLocation: "Jeddah",
    toLocation: "Makkah",
    cityTourCity: null,
    requiresBus: true,
    busCount: 1,
    transferByTrain: false,
    trainDepartureTime: null,
    destinationPickupTime: null,
    hotelPickupRequestTime: null,
  },
];
const parent = {
  id: "parent",
  code: "GTT-480900100001",
  name: "Perjalanan Umrah Oktober",
  parentGroupId: null,
  lifecycleStatus: "ACTIVE",
  arrivalDate: "2026-10-05T00:00:00Z",
  returnDate: "2026-10-12T00:00:00Z",
  pax: 20,
  packageName: "Paket Umrah",
  totalBuses: 1,
  musyrif: { name: "Ustadz Ahmad", phone: "+628123456", avatar: "" },
  notes: [],
  itinerary,
};
const child = {
  ...parent,
  id: "child",
  code: "GTT-480900100002",
  name: "Child group jamaah tambahan",
  parentGroupId: "parent",
  pax: 10,
};
const visa = {
  status: "PENDING",
  issuedDate: null,
  syarikah: "Provider Agent",
  busStatus: "VISA_PLUS",
  paymentStatus: "PAID",
  makkahHotelWaived: false,
  madinahHotelWaived: true,
  raudhahAppointments: [{ id: "raudhah-1", date: "2026-10-08T00:00:00Z", status: "AFTER", tasrehPrinted: true }],
  flightLegs: [
    {
      id: "flight-1",
      direction: "ONWARD",
      sortOrder: 0,
      departureAirportCode: "CGK",
      arrivalAirportCode: "JED",
      departureDate: "2026-10-05T00:00:00Z",
      departureTime: "05:00",
      arrivalDate: "2026-10-05T00:00:00Z",
      arrivalTime: "09:00",
      carrierCode: "GA",
      flightNumber: "GA980",
    },
  ],
};
const transport = [
  {
    id: "transport-1",
    tripDate: "2026-10-05T00:00:00Z",
    activity: "Arrival",
    tripLabel: "Jeddah – Makkah",
    requiredBusCount: 1,
    scheduledTime: "09:00",
    transferByTrain: false,
    trainDepartureTime: null,
    stationPickupTime: null,
    status: "ASSIGNED",
    assignedDriverCount: 1,
    verifiedDriverCount: 1,
    drivers: [{ slotNumber: 1, name: "Pak Ahmad", phone: "+966512345", plateNumber: "1234 ABC", isVerified: true }],
  },
];
const draftTemplate = {
  id: "draft-1",
  city: "MAKKAH",
  hotelName: "Hotel Makkah Agent",
  agreementNumber: "AGR-2026-001",
  groupName: parent.name,
  pax: 30,
  status: "WAITING",
  stayStart: "2026-10-05",
  stayEnd: "2026-10-08",
  remainingPax: 30,
  assignmentStatus: "Unassigned",
  assignedGroups: [],
  editable: false,
};

async function fixture(page: Page) {
  const drafts = [{ ...draftTemplate }];
  const writes: Array<{ method: string; body: Record<string, unknown> }> = [];
  await page.route("**/api/agent/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace("/api/agent", "");
    let data: unknown;
    let status = 200;
    if (pathname === "/auth/session")
      data = {
        expiresAt: "2099-01-01",
        user: {
          portalUserId: "portal-a",
          agentId: "agent-a",
          displayName: "Operator Agent",
          email: "agent@example.test",
          agentCode: "AGENT-A",
          agentName: "Agent Umrah",
          mustChangePassword: false,
          exp: 4070908800,
        },
      };
    else if (pathname === "/auth/logout") {
      status = 204;
    } else if (pathname.startsWith("/agreement-drafts")) {
      if (request.method() === "POST" || request.method() === "PATCH") {
        const body = request.postDataJSON();
        writes.push({ method: request.method(), body });
        status = 403;
        data = { message: "Agreement dikelola oleh Admin." };
      } else data = drafts;
    } else if (pathname === "/groups") data = { items: [child, parent], total: 2, page: 1, pageSize: 50 };
    else if (pathname.endsWith("/visa"))
      data = pathname.includes(child.code) ? { ...visa, status: "ISSUED", issuedDate: "2026-10-01" } : visa;
    else if (pathname.endsWith("/hotel-agreements"))
      data = [
        {
          id: "hotel-1",
          city: "MAKKAH",
          hotelName: "Hotel Makkah Agent",
          agreementNumber: "AGR-2026-001",
          pax: 20,
          status: "APPROVED",
          stayStart: "2026-10-05",
          stayEnd: "2026-10-08",
        },
      ];
    else if (pathname.endsWith("/transportation")) data = transport;
    else if (pathname.startsWith("/groups/"))
      data = { ...(pathname.includes(child.code) ? child : parent), durationDays: 8, familyGroups: [parent, child] };
    else if (pathname === "/visa-applications") data = [];
    else {
      status = 404;
      data = { message: "Not found" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      ...(status === 204 ? {} : { body: JSON.stringify(data) }),
    });
  });
  return writes;
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(captureDir, `${name}.png`), fullPage: true, animations: "disabled" });
}
test("Agreement Inbox read-only and Muassasah desktop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await fixture(page);
  const muassasahName = "Muassasah Pelayanan Jamaah Makkah dan Madinah — Nama Pilihan Admin";
  await page.route("**/api/agent/agreement-drafts", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ ...draftTemplate, muassasahId: "muassasah-own", muassasahName }]),
    });
  });
  await page.goto(`${baseUrl}/agent/agreement-inbox`);
  await expect(page.getByText(muassasahName, { exact: true })).toBeVisible();
  await page.getByLabel("Search agreement drafts").fill("Pelayanan Jamaah");
  await expect(page.getByRole("heading", { name: draftTemplate.hotelName })).toBeVisible();
  await capture(page, "agreement-readonly-desktop");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.getByRole("button", { name: /kirim|revisi/i })).toHaveCount(0);
  await page.getByRole("button", { name: `Buka detail ${draftTemplate.agreementNumber}` }).click();
  await expect(page.getByText("Belum terhubung ke group.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /muassasah/i })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: /muassasah/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900, name: "desktop" },
  { width: 390, height: 844, name: "mobile" },
]) {
  test(`Agent parent–child and Agreement Inbox ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const writes = await fixture(page);
    await page.goto(`${baseUrl}/agent/groups`);
    await expect(page.getByRole("heading", { name: "Perjalanan", exact: true })).toBeVisible();
    await expect(page.getByText("2 group terhubung")).toBeVisible();
    await page.getByRole("searchbox").fill(child.code);
    await expect(page.getByRole("heading", { name: parent.name })).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(child.code) })).toBeVisible();
    await capture(page, `trips-${viewport.name}`);
    await page.getByRole("button", { name: new RegExp(child.code) }).click();
    await expect(page.getByRole("heading", { name: child.code })).toBeVisible();
    await expect(page.getByText("Tasreh sudah dicetak")).toBeVisible();
    await page.getByText("Preview itinerary", { exact: true }).click();
    await capture(page, `detail-${viewport.name}`);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Unduh itinerary PDF" }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
    await page.getByRole("button", { name: "Kembali ke Perjalanan" }).click();
    await expect(page.getByRole("searchbox")).toHaveValue(child.code);
    await page.goto(`${baseUrl}/agent/visa?q=${encodeURIComponent(child.code)}`);
    await expect(page.getByRole("region", { name: `Group ${child.code}`, exact: true })).toBeVisible();
    await expect(page.getByText("Group terhubung", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: `Lihat detail visa ${child.code}` })).toBeVisible();
    await capture(page, `visa-${viewport.name}`);
    await page.goto(`${baseUrl}/agent/agreement-inbox`);
    await expect(page.getByRole("heading", { name: "Hotel Makkah Agent" })).toBeVisible();
    await capture(page, `agreements-${viewport.name}`);
    await expect(page.getByRole("button", { name: /kirim|revisi/i })).toHaveCount(0);
    expect(writes).toEqual([]);
    await page.getByRole("button", { name: "Buka menu akun" }).click();
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
    await page.getByRole("button", { name: "Buka menu akun" }).click();
    await capture(page, `agreements-dark-${viewport.name}`);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByRole("button", { name: /kirim|revisi/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
