import "reflect-metadata";
import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

type StartedServer = {
  baseUrl: string;
  shutdown: () => Promise<void>;
};

const DEV_AUTH_IDENTIFIER = process.env.DEV_AUTH_IDENTIFIER?.trim() || "dev.superadmin";
const DEV_AUTH_PASSWORD =
  process.env.DEV_AUTH_PASSWORD?.trim() || "DevSuperAdmin#2026";

let activeAuthCookie: string | null = null;

function buildUniqueGroupCode(): string {
  const timeFragment = Date.now().toString().slice(-8);
  const randomFragment = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");
  return `E2E-${timeFragment}${randomFragment}`;
}

function restoreEnvVar(key: "PORT" | "DATA_SOURCE", previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = previousValue;
}

async function startBackendServer(): Promise<StartedServer> {
  const port = 4100 + Math.floor(Math.random() * 400);
  const baseUrl = `http://127.0.0.1:${port}`;
  const previousPort = process.env.PORT;
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.PORT = String(port);
  process.env.DATA_SOURCE = "memory";

  let app: INestApplication | null = null;

  try {
    const { AppModule } = await import("../app.module.js");
    app = await NestFactory.create(AppModule, { cors: true, logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(port);
  } catch (error: unknown) {
    if (app) {
      await app.close();
    }
    restoreEnvVar("PORT", previousPort);
    restoreEnvVar("DATA_SOURCE", previousDataSource);
    throw error;
  }

  return {
    baseUrl,
    shutdown: async () => {
      if (app) {
        await app.close();
      }
      restoreEnvVar("PORT", previousPort);
      restoreEnvVar("DATA_SOURCE", previousDataSource);
    },
  };
}

async function requestJson(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; json: unknown; text: string; headers: Headers }> {
  const headers = new Headers(init?.headers);
  const method = init?.method?.trim().toUpperCase() ?? "GET";
  if (activeAuthCookie && !headers.has("cookie")) {
    headers.set("cookie", activeAuthCookie);
  }
  if (
    activeAuthCookie &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS" &&
    !headers.has("origin")
  ) {
    headers.set("origin", baseUrl);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();

  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }

  return {
    status: response.status,
    json,
    text,
    headers: response.headers,
  };
}

async function authenticateDevSession(baseUrl: string): Promise<void> {
  const loginResponse = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      identifier: DEV_AUTH_IDENTIFIER,
      password: DEV_AUTH_PASSWORD,
      rememberSession: false,
    }),
  });

  assert.equal(loginResponse.status, 200, `Auth login failed: ${loginResponse.text}`);
  assert.equal(
    typeof (loginResponse.json as { user?: unknown })?.user,
    "object",
    "Auth login should return a browser session payload.",
  );
  const setCookie = loginResponse.headers.get("set-cookie") ?? "";
  const cookieHeader = setCookie.split(";")[0]?.trim() ?? "";
  assert.notEqual(cookieHeader, "", "Auth login should return a session cookie.");
  activeAuthCookie = cookieHeader;
}

type GroupRecord = {
  code?: string;
  tone?: string;
  status?: string;
  arrivalDate?: string;
  returnDate?: string;
  itinerary?: Array<{ category?: string; categoryKey?: string; title?: string }>;
  notes?: Array<{ text?: string }>;
  visaSetup?: {
    visaStatus?: string;
    paymentStatus?: string;
    hotelAgreements?: Array<{ id?: string; city?: string; status?: string }>;
    raudhahAppointments?: Array<{ date?: string; status?: string }>;
  };
};

type InvoiceClient = {
  id?: string;
  label?: string;
};

type InvoiceRecord = {
  id?: string;
  invoiceNumber?: string;
  status?: string;
  amount?: number;
  downPaymentIdr?: number;
  groupCode?: string;
};

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(baseIsoDate: string, dayOffset: number): string {
  const nextDate = new Date(`${baseIsoDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
  return toIsoDateOnly(nextDate);
}

function toDateLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00.000Z`);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parsed.getUTCDate()} ${monthNames[parsed.getUTCMonth()]}`;
}

function ensureArray<T>(value: unknown, message: string): T[] {
  assert.equal(Array.isArray(value), true, message);
  return value as T[];
}

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertSameCodeSet(actualCodes: string[], expectedCodes: string[], message: string): void {
  assert.deepEqual(sorted(actualCodes), sorted(expectedCodes), message);
}

async function cleanupAllGroups(baseUrl: string): Promise<void> {
  const beforeCleanupResponse = await requestJson(baseUrl, "/api/groups");
  assert.equal(beforeCleanupResponse.status, 200, `List groups before cleanup failed: ${beforeCleanupResponse.text}`);
  const existingGroups = ensureArray<GroupRecord>(
    beforeCleanupResponse.json,
    "Group list payload before cleanup should be an array.",
  );

  for (const group of existingGroups) {
    const code = group.code?.trim() ?? "";
    if (!code) {
      continue;
    }

    const deleteResponse = await requestJson(baseUrl, `/api/groups/${encodeURIComponent(code)}`, {
      method: "DELETE",
    });
    assert.equal(deleteResponse.status, 204, `Delete group '${code}' failed: ${deleteResponse.text}`);
  }

  const afterCleanupResponse = await requestJson(baseUrl, "/api/groups");
  assert.equal(afterCleanupResponse.status, 200, `List groups after cleanup failed: ${afterCleanupResponse.text}`);
  const groupsAfterCleanup = ensureArray<GroupRecord>(
    afterCleanupResponse.json,
    "Group list payload after cleanup should be an array.",
  );
  assert.equal(groupsAfterCleanup.length, 0, "Expected all groups removed before scenario setup.");
}

function buildScenarioGroupPayload(args: {
  code: string;
  name: string;
  status: string;
  tone: "ACTIVE" | "INACTIVE";
  pax: number;
  totalBuses: number;
  packageName: string;
  durationDays: number;
  arrivalIso: string;
  transferIso: string;
  departureIso: string;
  itineraryMode?: "arrival-only" | "arrival-departure" | "arrival-transfer-departure" | "full-trip";
  notes?: string[];
  visaSetup?: {
    visaStatus: "DRAFT" | "PENDING" | "ISSUED";
    issuedDate?: string;
    syarikah: string;
    paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
    hotelAgreements?: Array<{
      city: "MAKKAH" | "MADINAH";
      hotelName: string;
      agreementNumber: string;
      pax: number;
      status: "WAITING" | "APPROVED";
      stayStart: string;
      stayEnd: string;
    }>;
    raudhahAppointments?: Array<{ date: string; status: "FREE" | "AFTER" | "BEFORE" }>;
  };
  checklistAssignments?: Array<{
    tripDate: string;
    activity: string;
    tripLabel: string;
    requiredBusCount: number;
    scheduledTime: string;
    status: "NOT_COMPLETE" | "ASSIGNED";
    drivers: Array<{
      slotNumber: number;
      name: string;
      phone: string;
      plateNumber: string;
      isVerified: boolean;
    }>;
  }>;
}) {
  const itineraryMode = args.itineraryMode ?? "arrival-transfer-departure";
  const makkahCityTourIso = addUtcDays(args.arrivalIso, 1);
  const madinahCityTourIso = addUtcDays(args.transferIso, 1);

  const arrivalItem = {
    sortOrder: 0,
    dateLabel: toDateLabel(args.arrivalIso),
    yearLabel: args.arrivalIso.slice(0, 4),
    category: "Arrival",
    categoryKey: "arrival",
    title: "Arrival and transfer to Makkah hotel",
    meta: "07:15 | JED Airport -> Makkah Hotel",
    icon: "flight_land",
    isoDate: args.arrivalIso,
    time: "07:15",
    fromLocation: "JED Airport",
    toLocation: "Makkah Hotel",
    requiresBus: true,
  };
  const transferItem = {
    sortOrder: 1,
    dateLabel: toDateLabel(args.transferIso),
    yearLabel: args.transferIso.slice(0, 4),
    category: "Transfer",
    categoryKey: "transfer",
    title: "Transfer from Makkah to Madinah",
    meta: "08:30 | Makkah Hotel -> Madinah Hotel",
    icon: "airport_shuttle",
    isoDate: args.transferIso,
    time: "08:30",
    fromLocation: "Makkah Hotel",
    toLocation: "Madinah Hotel",
    requiresBus: true,
  };
  const departureItem = {
    sortOrder: 2,
    dateLabel: toDateLabel(args.departureIso),
    yearLabel: args.departureIso.slice(0, 4),
    category: "Departure",
    categoryKey: "departure",
    title: "Departure to airport",
    meta: "21:45 | Madinah Hotel -> MED Airport",
    icon: "flight_takeoff",
    isoDate: args.departureIso,
    time: "21:45",
    fromLocation: "Madinah Hotel",
    toLocation: "MED Airport",
    requiresBus: true,
    hotelPickupRequestTime: "18:30",
  };
  const makkahCityTourItem = {
    sortOrder: 1,
    dateLabel: toDateLabel(makkahCityTourIso),
    yearLabel: makkahCityTourIso.slice(0, 4),
    category: "City Tour",
    categoryKey: "city-tour",
    title: "Makkah City Tour",
    meta: "08:00 | Makkah Hotel -> Masjidil Haram",
    icon: "tour",
    isoDate: makkahCityTourIso,
    time: "08:00",
    fromLocation: "Makkah Hotel",
    toLocation: "Masjidil Haram",
    cityTourCity: "Makkah",
    requiresBus: true,
  };
  const madinahCityTourItem = {
    sortOrder: 3,
    dateLabel: toDateLabel(madinahCityTourIso),
    yearLabel: madinahCityTourIso.slice(0, 4),
    category: "City Tour",
    categoryKey: "city-tour",
    title: "Madinah City Tour",
    meta: "09:00 | Madinah Hotel -> Masjid Nabawi",
    icon: "tour",
    isoDate: madinahCityTourIso,
    time: "09:00",
    fromLocation: "Madinah Hotel",
    toLocation: "Masjid Nabawi",
    cityTourCity: "Madinah",
    requiresBus: true,
  };
  const selectedItineraryItems =
    itineraryMode === "arrival-only"
      ? [arrivalItem]
      : itineraryMode === "arrival-departure"
        ? [arrivalItem, departureItem]
        : itineraryMode === "full-trip"
          ? [arrivalItem, makkahCityTourItem, transferItem, madinahCityTourItem, departureItem]
          : [arrivalItem, transferItem, departureItem];
  const itinerary = selectedItineraryItems.map((item, index) => ({
    ...item,
    sortOrder: index,
  }));

  return {
    agentId: "agent_gtt_direct",
    code: args.code,
    name: args.name,
    status: args.status,
    arrivalDate: args.arrivalIso,
    returnDate: args.departureIso,
    tone: args.tone,
    pax: args.pax,
    totalBuses: args.totalBuses,
    packageName: args.packageName,
    durationDays: args.durationDays,
    timeline: [
      {
        sortOrder: 0,
        dateLabel: toDateLabel(args.arrivalIso),
        title: "Arrival",
        isCurrent: true,
        nextActivity: "Arrival and transfer to Makkah hotel",
      },
      {
        sortOrder: 1,
        dateLabel: toDateLabel(args.departureIso),
        title: "Departure",
        isCurrent: false,
      },
    ],
    itinerary,
    notes: (args.notes ?? []).map((text, index) => ({
      sortOrder: index,
      text,
      pinned: index === 0,
    })),
    visaSetup: args.visaSetup,
    checklistAssignments: args.checklistAssignments ?? [],
  };
}

function createGroupPayload(groupCode: string) {
  const todayIso = toIsoDateOnly(new Date());
  const arrivalIso = addUtcDays(todayIso, 1);
  const returnIso = addUtcDays(arrivalIso, 8);

  return {
    agentId: "agent_gtt_direct",
    code: groupCode,
    name: "E2E Integration Group",
    status: "Active",
    arrivalDate: arrivalIso,
    returnDate: returnIso,
    pax: 25,
    packageName: "E2E Package",
    durationDays: 9,
    timeline: [],
    itinerary: [],
    notes: [
      {
        sortOrder: 0,
        text: "Bus status: Visa+.",
        pinned: true,
      },
    ],
    checklistAssignments: [],
  };
}

async function testBackendApiFlow(): Promise<void> {
  const server = await startBackendServer();

  try {
    const healthResponse = await requestJson(server.baseUrl, "/api/health");
    assert.equal(healthResponse.status, 200);
    assert.equal(
      (healthResponse.json as { dataSource?: string }).dataSource,
      "memory",
      `Unexpected /api/health payload: ${healthResponse.text}`,
    );

    await authenticateDevSession(server.baseUrl);

    const groupCode = buildUniqueGroupCode();
    const createResponse = await requestJson(server.baseUrl, "/api/groups", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(createGroupPayload(groupCode)),
    });

    assert.equal(createResponse.status, 201, `Create group failed: ${createResponse.text}`);
    assert.equal(
      (createResponse.json as { code?: string }).code,
      groupCode,
      `Unexpected create response: ${createResponse.text}`,
    );

    const findOneResponse = await requestJson(server.baseUrl, `/api/groups/${groupCode}`);
    assert.equal(findOneResponse.status, 200, `Find group failed: ${findOneResponse.text}`);
    assert.equal(
      (findOneResponse.json as { code?: string }).code,
      groupCode,
      `Unexpected find response: ${findOneResponse.text}`,
    );
    const fetchedGroupNotes = (findOneResponse.json as { notes?: Array<{ text?: string }> }).notes ?? [];
    assert.equal(
      fetchedGroupNotes.some((note) => note.text === "Bus status: Visa+."),
      true,
      `Expected persisted bus status note in find response: ${findOneResponse.text}`,
    );

    const updateResponse = await requestJson(server.baseUrl, `/api/groups/${groupCode}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "E2E Integration Group Updated",
        pax: 30,
      }),
    });
    assert.equal(updateResponse.status, 200, `Update group failed: ${updateResponse.text}`);
    assert.equal(
      (updateResponse.json as { name?: string }).name,
      "E2E Integration Group Updated",
      `Unexpected update response: ${updateResponse.text}`,
    );
    assert.equal(
      (updateResponse.json as { pax?: number }).pax,
      30,
      `Unexpected update response: ${updateResponse.text}`,
    );

    const invoiceClientsResponse = await requestJson(server.baseUrl, "/api/invoices/clients");
    assert.equal(
      invoiceClientsResponse.status,
      200,
      `Fetch invoice clients failed: ${invoiceClientsResponse.text}`,
    );
    assert.equal(Array.isArray(invoiceClientsResponse.json), true, "Invoice clients payload should be an array.");
    const invoiceClients = invoiceClientsResponse.json as Array<{
      id?: string;
      label?: string;
    }>;
    assert.equal(invoiceClients.length >= 1, true, "Expected at least one invoice client in memory mode.");
    assert.equal(
      typeof invoiceClients[0]?.label,
      "string",
      "Invoice client should include display label.",
    );

    const invoiceIssuedIso = toIsoDateOnly(new Date());
    const invoiceDueIso = addUtcDays(invoiceIssuedIso, 10);
    const manualInvoiceIssuedIso = addUtcDays(invoiceIssuedIso, 1);
    const manualInvoiceDueIso = addUtcDays(invoiceIssuedIso, 11);
    const updateInvoiceDueIso = addUtcDays(invoiceIssuedIso, 20);
    const invoiceYear = invoiceDueIso.slice(0, 4);

    const createInvoiceResponse = await requestJson(server.baseUrl, "/api/invoices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentId: "agent_gtt_direct",
        clientId: invoiceClients[0]?.id,
        groupCode,
        issuedDate: invoiceIssuedIso,
        dueDate: invoiceDueIso,
        amount: 14500000,
      }),
    });
    assert.equal(
      createInvoiceResponse.status,
      201,
      `Create invoice failed: ${createInvoiceResponse.text}`,
    );
    const createdInvoice = createInvoiceResponse.json as {
      id?: string;
      invoiceNumber?: string;
      clientLabel?: string;
      status?: string;
    };
    assert.equal(
      new RegExp(`^GTT/INV/${invoiceYear}/\\d{4}$`).test(createdInvoice.invoiceNumber ?? ""),
      true,
      `Unexpected invoice number pattern: ${createInvoiceResponse.text}`,
    );
    assert.equal(
      typeof createdInvoice.clientLabel,
      "string",
      `Expected invoice client label in response: ${createInvoiceResponse.text}`,
    );
    assert.equal(typeof createdInvoice.id, "string", `Expected invoice id in response: ${createInvoiceResponse.text}`);
    assert.equal(createdInvoice.status, "Pending");

    const createManualInvoiceResponse = await requestJson(server.baseUrl, "/api/invoices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentId: "agent_gtt_direct",
        clientName: "Manual E2E Client",
        issuedDate: manualInvoiceIssuedIso,
        dueDate: manualInvoiceDueIso,
        amount: 2300000,
      }),
    });
    assert.equal(
      createManualInvoiceResponse.status,
      201,
      `Create manual invoice failed: ${createManualInvoiceResponse.text}`,
    );
    const createdManualInvoice = createManualInvoiceResponse.json as {
      clientName?: string;
      status?: string;
    };
    assert.equal(
      createdManualInvoice.clientName,
      "Manual E2E Client",
      `Unexpected manual invoice response: ${createManualInvoiceResponse.text}`,
    );
    assert.equal(
      createdManualInvoice.status,
      "Pending",
      `Unexpected manual invoice response: ${createManualInvoiceResponse.text}`,
    );

    const updateInvoiceResponse = await requestJson(
      server.baseUrl,
      `/api/invoices/${createdInvoice.id ?? ""}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          dueDate: updateInvoiceDueIso,
          amount: 15100000,
          status: "CANCELLED",
          version: (createdInvoice as { version?: number }).version ?? 0,
        }),
      },
    );
    assert.equal(
      updateInvoiceResponse.status,
      200,
      `Update invoice failed: ${updateInvoiceResponse.text}`,
    );
    const updatedInvoice = updateInvoiceResponse.json as {
      dueDateIso?: string;
      amount?: number;
      status?: string;
    };
    assert.equal(updatedInvoice.dueDateIso, updateInvoiceDueIso, `Unexpected update response: ${updateInvoiceResponse.text}`);
    assert.equal(updatedInvoice.amount, 15100000, `Unexpected update response: ${updateInvoiceResponse.text}`);
    assert.equal(updatedInvoice.status, "Cancelled", `Unexpected update response: ${updateInvoiceResponse.text}`);

    const deleteInvoiceResponse = await requestJson(
      server.baseUrl,
      `/api/invoices/${createdInvoice.id ?? ""}`,
      {
        method: "DELETE",
      },
    );
    assert.equal(
      deleteInvoiceResponse.status,
      200,
      `Delete invoice failed: ${deleteInvoiceResponse.text}`,
    );

    const listInvoicesResponse = await requestJson(server.baseUrl, "/api/invoices");
    assert.equal(
      listInvoicesResponse.status,
      200,
      `List invoices failed: ${listInvoicesResponse.text}`,
    );
    assert.equal(Array.isArray(listInvoicesResponse.json), true, "Invoices payload should be an array.");
    const invoices = listInvoicesResponse.json as Array<{ invoiceNumber?: string }>;
    assert.equal(
      invoices.some((invoice) => invoice.invoiceNumber === createdInvoice.invoiceNumber),
      false,
      "Created invoice should not be returned in list endpoint after deletion.",
    );

    const deleteResponse = await requestJson(server.baseUrl, `/api/groups/${groupCode}`, {
      method: "DELETE",
    });
    assert.equal(deleteResponse.status, 204, `Delete group failed: ${deleteResponse.text}`);

    const afterDeleteResponse = await requestJson(server.baseUrl, `/api/groups/${groupCode}`);
    assert.equal(afterDeleteResponse.status, 404, "Deleted group should return 404.");
  } finally {
    activeAuthCookie = null;
    await server.shutdown();
  }
}

async function testManagedUserPasswordHttpFlow(): Promise<void> {
  const server = await startBackendServer();
  const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;
  const managedUserEmail = `http.admin.${uniqueSuffix}@example.com`;

  try {
    await authenticateDevSession(server.baseUrl);

    const createResponse = await requestJson(server.baseUrl, "/api/auth/users", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "HTTP Managed Admin",
        email: managedUserEmail,
        roleId: "admin",
      }),
    });
    assert.equal(createResponse.status, 201, `Create managed user failed: ${createResponse.text}`);
    const createdUser = createResponse.json as {
      id?: string;
      hasPassword?: boolean;
    };
    assert.equal(typeof createdUser.id, "string", `Expected managed user id: ${createResponse.text}`);
    assert.equal(createdUser.hasPassword, false, `Expected hasPassword=false: ${createResponse.text}`);

    const setPasswordResponse = await requestJson(
      server.baseUrl,
      `/api/auth/users/${encodeURIComponent(createdUser.id ?? "")}/password`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          password: "ManagedHttp#2026",
        }),
      },
    );
    assert.equal(
      setPasswordResponse.status,
      200,
      `Set managed user password failed: ${setPasswordResponse.text}`,
    );
    assert.equal(
      (setPasswordResponse.json as { hasPassword?: boolean }).hasPassword,
      true,
      `Expected hasPassword=true after reset: ${setPasswordResponse.text}`,
    );

    const usersResponse = await requestJson(server.baseUrl, "/api/auth/users");
    assert.equal(usersResponse.status, 200, `List managed users failed: ${usersResponse.text}`);
    const users = ensureArray<{ id?: string; hasPassword?: boolean }>(
      usersResponse.json,
      "Managed user list should be an array.",
    );
    const updatedUser = users.find((entry) => entry.id === createdUser.id);
    assert.equal(Boolean(updatedUser), true, "Expected created managed user in list.");
    assert.equal(updatedUser?.hasPassword, true, "Expected listed user to reflect hasPassword=true.");

    const logoutResponse = await requestJson(server.baseUrl, "/api/auth/logout", {
      method: "POST",
    });
    assert.equal(logoutResponse.status, 204, `Logout failed: ${logoutResponse.text}`);
    activeAuthCookie = null;

    const loginResponse = await requestJson(server.baseUrl, "/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        identifier: managedUserEmail,
        password: "ManagedHttp#2026",
        rememberSession: false,
      }),
    });
    assert.equal(loginResponse.status, 200, `Managed user login failed: ${loginResponse.text}`);
    assert.equal(
      (loginResponse.json as { user?: { accessTier?: string } })?.user?.accessTier,
      "admin",
      `Expected managed user access tier in login response: ${loginResponse.text}`,
    );
  } finally {
    activeAuthCookie = null;
    await server.shutdown();
  }
}

async function testComprehensiveAddGroupOverviewInvoiceAndRaudhahFlow(): Promise<void> {
  const server = await startBackendServer();
  const todayIso = toIsoDateOnly(new Date());
  const scenarioPrefix = buildUniqueGroupCode().replace("E2E-", "SCN-");

  const dates = {
    arrivalIso: addUtcDays(todayIso, 1),
    transferIso: addUtcDays(todayIso, 3),
    departureIso: addUtcDays(todayIso, 6),
    raudhahCriticalIso: addUtcDays(todayIso, 2),
    raudhahUrgentIso: addUtcDays(todayIso, 3),
    raudhahActiveIso: addUtcDays(todayIso, 5),
  };

  const groupCodes = {
    activeIssued: `${scenarioPrefix}-ACTIVE-ISSUED`,
    inactivePending: `${scenarioPrefix}-INACTIVE-PENDING`,
    activeDraft: `${scenarioPrefix}-ACTIVE-DRAFT`,
    activeUnpaid: `${scenarioPrefix}-ACTIVE-UNPAID`,
    arrivalDeparture: `${scenarioPrefix}-ARRIVAL-DEPARTURE`,
    arrivalOnly: `${scenarioPrefix}-ARRIVAL-ONLY`,
    fullTrip: `${scenarioPrefix}-FULL-TRIP`,
  };

  const postJson = async (path: string, payload: unknown) =>
    requestJson(server.baseUrl, path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  const patchJson = async (path: string, payload: unknown) =>
    requestJson(server.baseUrl, path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  const putJson = async (path: string, payload: unknown) =>
    requestJson(server.baseUrl, path, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

  try {
    await authenticateDevSession(server.baseUrl);
    await cleanupAllGroups(server.baseUrl);

    const createPayloads = [
      buildScenarioGroupPayload({
        code: groupCodes.activeIssued,
        name: "Scenario Active Issued",
        status: "Active",
        tone: "ACTIVE",
        pax: 44,
        totalBuses: 2,
        packageName: "Scenario Premium",
        durationDays: 9,
        arrivalIso: dates.arrivalIso,
        transferIso: dates.transferIso,
        departureIso: dates.departureIso,
        notes: ["Bus status: Visa+.", "Flow source: add new group."],
        visaSetup: {
          visaStatus: "ISSUED",
          issuedDate: addUtcDays(todayIso, -1),
          syarikah: "Provider Alpha",
          paymentStatus: "PAID",
          hotelAgreements: [
            {
              city: "MAKKAH",
              hotelName: "Makkah Scenario Hotel",
              agreementNumber: `${scenarioPrefix}-MAK-01`,
              pax: 44,
              status: "APPROVED",
              stayStart: dates.arrivalIso,
              stayEnd: dates.transferIso,
            },
            {
              city: "MADINAH",
              hotelName: "Madinah Scenario Hotel",
              agreementNumber: `${scenarioPrefix}-MAD-01`,
              pax: 44,
              status: "APPROVED",
              stayStart: dates.transferIso,
              stayEnd: dates.departureIso,
            },
          ],
          raudhahAppointments: [{ date: dates.raudhahActiveIso, status: "AFTER" }],
        },
        checklistAssignments: [
          {
            tripDate: dates.departureIso,
            activity: "Departure",
            tripLabel: "Departure to airport",
            requiredBusCount: 2,
            scheduledTime: "18:30",
            status: "NOT_COMPLETE",
            drivers: [
              {
                slotNumber: 1,
                name: "Driver Existing",
                phone: "+966 50 111 1111",
                plateNumber: "B 1111 E2E",
                isVerified: true,
              },
            ],
          },
        ],
      }),
      buildScenarioGroupPayload({
        code: groupCodes.inactivePending,
        name: "Scenario Inactive Pending",
        status: "Inactive",
        tone: "INACTIVE",
        pax: 30,
        totalBuses: 1,
        packageName: "Scenario Standard",
        durationDays: 8,
        arrivalIso: dates.arrivalIso,
        transferIso: dates.transferIso,
        departureIso: dates.departureIso,
        notes: ["Bus status: Visa+."],
        visaSetup: {
          visaStatus: "PENDING",
          syarikah: "Provider Beta",
          paymentStatus: "PARTIAL",
          hotelAgreements: [],
          raudhahAppointments: [{ date: dates.raudhahCriticalIso, status: "BEFORE" }],
        },
      }),
      buildScenarioGroupPayload({
        code: groupCodes.activeDraft,
        name: "Scenario Active Draft",
        status: "Active",
        tone: "ACTIVE",
        pax: 25,
        totalBuses: 1,
        packageName: "Scenario Draft",
        durationDays: 7,
        arrivalIso: dates.arrivalIso,
        transferIso: dates.transferIso,
        departureIso: dates.departureIso,
        notes: ["Bus status: Visa+."],
      }),
      buildScenarioGroupPayload({
        code: groupCodes.activeUnpaid,
        name: "Scenario Active Unpaid",
        status: "Active",
        tone: "ACTIVE",
        pax: 36,
        totalBuses: 2,
        packageName: "Scenario Gold",
        durationDays: 10,
        arrivalIso: dates.arrivalIso,
        transferIso: dates.transferIso,
        departureIso: dates.departureIso,
        notes: ["Bus status: Visa+."],
        visaSetup: {
          visaStatus: "ISSUED",
          issuedDate: todayIso,
          syarikah: "Provider Delta",
          paymentStatus: "UNPAID",
          hotelAgreements: [
            {
              city: "MAKKAH",
              hotelName: "Makkah Unpaid Hotel",
              agreementNumber: `${scenarioPrefix}-MAK-02`,
              pax: 36,
              status: "WAITING",
              stayStart: dates.arrivalIso,
              stayEnd: dates.transferIso,
            },
          ],
          raudhahAppointments: [{ date: dates.raudhahUrgentIso, status: "FREE" }],
        },
      }),
      buildScenarioGroupPayload({
        code: groupCodes.arrivalDeparture,
        name: "Scenario Arrival and Departure",
        status: "Active",
        tone: "ACTIVE",
        pax: 28,
        totalBuses: 1,
        packageName: "Scenario Direct Return",
        durationDays: 7,
        arrivalIso: dates.arrivalIso,
        transferIso: dates.transferIso,
        departureIso: dates.departureIso,
        itineraryMode: "arrival-departure",
        notes: ["Bus status: Visa+.", "Overview case: arrival + departure."],
        visaSetup: {
          visaStatus: "ISSUED",
          issuedDate: todayIso,
          syarikah: "Provider Epsilon",
          paymentStatus: "PAID",
          hotelAgreements: [
            {
              city: "MAKKAH",
              hotelName: "Makkah Direct Return Hotel",
              agreementNumber: `${scenarioPrefix}-MAK-03`,
              pax: 28,
              status: "APPROVED",
              stayStart: dates.arrivalIso,
              stayEnd: addUtcDays(dates.arrivalIso, 2),
            },
          ],
          raudhahAppointments: [],
        },
      }),
      buildScenarioGroupPayload({
        code: groupCodes.arrivalOnly,
        name: "Scenario Arrival Only",
        status: "Active",
        tone: "ACTIVE",
        pax: 20,
        totalBuses: 1,
        packageName: "Scenario Arrival Only",
        durationDays: 5,
        arrivalIso: dates.arrivalIso,
        transferIso: dates.transferIso,
        departureIso: dates.departureIso,
        itineraryMode: "arrival-only",
        notes: ["Bus status: Visa+.", "Overview case: arrival only."],
        visaSetup: {
          visaStatus: "ISSUED",
          issuedDate: todayIso,
          syarikah: "Provider Zeta",
          paymentStatus: "PAID",
          hotelAgreements: [
            {
              city: "MAKKAH",
              hotelName: "Makkah Arrival Base",
              agreementNumber: `${scenarioPrefix}-MAK-04`,
              pax: 20,
              status: "APPROVED",
              stayStart: dates.arrivalIso,
              stayEnd: addUtcDays(dates.arrivalIso, 1),
            },
          ],
          raudhahAppointments: [],
        },
      }),
      buildScenarioGroupPayload({
        code: groupCodes.fullTrip,
        name: "Scenario Full Trip",
        status: "Active",
        tone: "ACTIVE",
        pax: 46,
        totalBuses: 2,
        packageName: "Scenario Full Journey",
        durationDays: 10,
        arrivalIso: dates.arrivalIso,
        transferIso: dates.transferIso,
        departureIso: dates.departureIso,
        itineraryMode: "full-trip",
        notes: ["Bus status: Visa+.", "Overview case: full trip itinerary."],
        visaSetup: {
          visaStatus: "ISSUED",
          issuedDate: todayIso,
          syarikah: "Provider Omega",
          paymentStatus: "PAID",
          hotelAgreements: [
            {
              city: "MAKKAH",
              hotelName: "Makkah Full Trip Hotel",
              agreementNumber: `${scenarioPrefix}-MAK-05`,
              pax: 46,
              status: "APPROVED",
              stayStart: dates.arrivalIso,
              stayEnd: dates.transferIso,
            },
            {
              city: "MADINAH",
              hotelName: "Madinah Full Trip Hotel",
              agreementNumber: `${scenarioPrefix}-MAD-05`,
              pax: 46,
              status: "APPROVED",
              stayStart: dates.transferIso,
              stayEnd: dates.departureIso,
            },
          ],
          raudhahAppointments: [{ date: addUtcDays(dates.transferIso, 1), status: "AFTER" }],
        },
      }),
    ];

    for (const payload of createPayloads) {
      const response = await postJson("/api/groups", payload);
      assert.equal(response.status, 201, `Create group scenario failed: ${response.text}`);
    }

    const listGroupsResponse = await requestJson(server.baseUrl, "/api/groups");
    assert.equal(listGroupsResponse.status, 200, `List groups failed: ${listGroupsResponse.text}`);
    const groups = ensureArray<GroupRecord>(listGroupsResponse.json, "Groups payload should be an array.");
    assert.equal(groups.length, 7);

    const groupsByCode = new Map(groups.map((group) => [group.code ?? "", group]));
    const activeIssuedGroup = groupsByCode.get(groupCodes.activeIssued);
    const inactivePendingGroup = groupsByCode.get(groupCodes.inactivePending);
    const activeDraftGroup = groupsByCode.get(groupCodes.activeDraft);
    const activeUnpaidGroup = groupsByCode.get(groupCodes.activeUnpaid);
    const arrivalDepartureGroup = groupsByCode.get(groupCodes.arrivalDeparture);
    const arrivalOnlyGroup = groupsByCode.get(groupCodes.arrivalOnly);
    const fullTripGroup = groupsByCode.get(groupCodes.fullTrip);
    assert.ok(activeIssuedGroup);
    assert.ok(inactivePendingGroup);
    assert.ok(activeDraftGroup);
    assert.ok(activeUnpaidGroup);
    assert.ok(arrivalDepartureGroup);
    assert.ok(arrivalOnlyGroup);
    assert.ok(fullTripGroup);

    assertSameCodeSet(
      groups.map((group) => group.code ?? "").filter((code) => code.length > 0),
      [
        groupCodes.activeIssued,
        groupCodes.inactivePending,
        groupCodes.activeDraft,
        groupCodes.activeUnpaid,
        groupCodes.arrivalDeparture,
        groupCodes.arrivalOnly,
        groupCodes.fullTrip,
      ],
      "Unexpected overview scenario groups.",
    );

    assert.equal(activeIssuedGroup?.tone, "ACTIVE");
    assert.equal(inactivePendingGroup?.tone, "INACTIVE");
    assert.equal(inactivePendingGroup?.status, "Inactive");
    assert.equal(
      (activeIssuedGroup?.notes ?? []).some((note) => note.text === "Bus status: Visa+."),
      true,
    );
    assert.deepEqual(
      (arrivalDepartureGroup?.itinerary ?? []).map((item) => item.category),
      ["Arrival", "Departure"],
      "Arrival + departure scenario should have exactly two itinerary categories.",
    );
    assert.deepEqual(
      (arrivalOnlyGroup?.itinerary ?? []).map((item) => item.category),
      ["Arrival"],
      "Arrival-only scenario should have exactly one arrival itinerary item.",
    );
    const fullTripCategories = (fullTripGroup?.itinerary ?? []).map((item) => item.category);
    assert.equal(fullTripCategories.length, 5);
    assert.equal(fullTripCategories.includes("Arrival"), true);
    assert.equal(fullTripCategories.includes("Transfer"), true);
    assert.equal(fullTripCategories.includes("Departure"), true);
    assert.equal(fullTripCategories.filter((category) => category === "City Tour").length, 2);

    const normalizedSearchQuery = groupCodes.arrivalDeparture.toLowerCase().replace(/-/g, " ");
    const normalizedSearchCodes = ensureArray<GroupRecord>(
      (await requestJson(server.baseUrl, `/api/groups?q=${encodeURIComponent(normalizedSearchQuery)}`)).json,
      "normalized search payload should be array.",
    )
      .map((group) => group.code ?? "")
      .filter((code) => code.length > 0);
    assertSameCodeSet(
      normalizedSearchCodes,
      [groupCodes.arrivalDeparture],
      "Expected normalized search to match arrival-departure group by spaced code.",
    );

    const notIssuedCodes = ensureArray<GroupRecord>(
      (await requestJson(server.baseUrl, "/api/groups?filter=not-issued")).json,
      "not-issued payload should be array.",
    )
      .map((group) => group.code ?? "")
      .filter((code) => code.length > 0);
    assertSameCodeSet(
      notIssuedCodes,
      [groupCodes.inactivePending, groupCodes.activeDraft],
      "Unexpected not-issued group set.",
    );

    const missingHotelCodes = ensureArray<GroupRecord>(
      (await requestJson(server.baseUrl, "/api/groups?filter=missing-hotel")).json,
      "missing-hotel payload should be array.",
    )
      .map((group) => group.code ?? "")
      .filter((code) => code.length > 0);
    assertSameCodeSet(
      missingHotelCodes,
      [
        groupCodes.inactivePending,
        groupCodes.activeDraft,
        groupCodes.activeUnpaid,
        groupCodes.arrivalDeparture,
        groupCodes.arrivalOnly,
      ],
      "Unexpected missing-hotel group set.",
    );

    const unpaidCodes = ensureArray<GroupRecord>(
      (await requestJson(server.baseUrl, "/api/groups?filter=unpaid")).json,
      "unpaid payload should be array.",
    )
      .map((group) => group.code ?? "")
      .filter((code) => code.length > 0);
    assertSameCodeSet(
      unpaidCodes,
      [groupCodes.inactivePending, groupCodes.activeDraft, groupCodes.activeUnpaid],
      "Unexpected unpaid group set.",
    );

    const paginatedResponse = await requestJson(server.baseUrl, "/api/groups?page=1&pageSize=2");
    assert.equal(paginatedResponse.status, 200, `Paginated groups failed: ${paginatedResponse.text}`);
    const paginatedPayload = paginatedResponse.json as { items?: unknown[]; total?: number };
    assert.equal(Array.isArray(paginatedPayload.items), true, "Expected paginated payload to include items.");
    assert.equal((paginatedPayload.items ?? []).length, 2);
    assert.equal(paginatedPayload.total, 7);

    const checklistConfirmResponse = await postJson(
      `/api/groups/${encodeURIComponent(groupCodes.activeIssued)}/checklist/confirm-driver`,
      {
        tripDate: dates.departureIso,
        activity: "Departure",
        tripLabel: "Departure to airport",
        requiredBusCount: 2,
        scheduledTime: "18:30",
        driver: {
          name: "Driver Newly Confirmed",
          phone: "+966 50 222 2222",
          plateNumber: "B 2222 E2E",
        },
      },
    );
    assert.equal(checklistConfirmResponse.status, 201, `Confirm checklist failed: ${checklistConfirmResponse.text}`);
    const checklistConfirmPayload = checklistConfirmResponse.json as { status?: string; drivers?: unknown[] };
    assert.equal(checklistConfirmPayload.status, "ASSIGNED");
    assert.equal((checklistConfirmPayload.drivers ?? []).length, 2);

    const checklistResetResponse = await postJson(
      `/api/groups/${encodeURIComponent(groupCodes.activeIssued)}/checklist/reset-driver`,
      {
        tripDate: dates.departureIso,
        scheduledTime: "18:30",
        activity: "Departure",
      },
    );
    assert.equal(checklistResetResponse.status, 201, `Reset checklist failed: ${checklistResetResponse.text}`);
    const checklistResetPayload = checklistResetResponse.json as { status?: string; drivers?: unknown[] };
    assert.equal(checklistResetPayload.status, "NOT_COMPLETE");
    assert.equal((checklistResetPayload.drivers ?? []).length, 0);

    const addHotelResponse = await postJson(
      `/api/groups/${encodeURIComponent(groupCodes.inactivePending)}/visa/hotels`,
      {
        city: "MAKKAH",
        hotelName: "Makkah Dynamic Hotel",
        agreementNumber: `${scenarioPrefix}-DYN-MAK-01`,
        pax: 30,
        status: "WAITING",
        stayStart: dates.raudhahCriticalIso,
        stayEnd: addUtcDays(dates.raudhahCriticalIso, 1),
      },
    );
    assert.equal(addHotelResponse.status, 201, `Add visa hotel failed: ${addHotelResponse.text}`);
    const addedHotelId = ((addHotelResponse.json as GroupRecord).visaSetup?.hotelAgreements ?? [])[0]?.id ?? "";
    assert.notEqual(addedHotelId, "");

    const updateHotelResponse = await patchJson(
      `/api/groups/${encodeURIComponent(groupCodes.inactivePending)}/visa/hotels/${encodeURIComponent(addedHotelId)}`,
      {
        city: "MAKKAH",
        hotelName: "Makkah Dynamic Hotel Updated",
        agreementNumber: `${scenarioPrefix}-DYN-MAK-01`,
        pax: 30,
        status: "APPROVED",
        stayStart: dates.raudhahCriticalIso,
        stayEnd: addUtcDays(dates.raudhahCriticalIso, 1),
      },
    );
    assert.equal(updateHotelResponse.status, 200, `Update visa hotel failed: ${updateHotelResponse.text}`);
    assert.equal((updateHotelResponse.json as GroupRecord).visaSetup?.hotelAgreements?.[0]?.status, "APPROVED");

    const removeHotelResponse = await requestJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(groupCodes.inactivePending)}/visa/hotels/${encodeURIComponent(addedHotelId)}`,
      { method: "DELETE" },
    );
    assert.equal(removeHotelResponse.status, 200, `Remove visa hotel failed: ${removeHotelResponse.text}`);

    const raudhahFreeResponse = await putJson(
      `/api/groups/${encodeURIComponent(groupCodes.inactivePending)}/visa/raudhah`,
      { date: dates.raudhahCriticalIso, status: "FREE" },
    );
    assert.equal(raudhahFreeResponse.status, 200, `Upsert FREE raudhah failed: ${raudhahFreeResponse.text}`);
    assert.equal((raudhahFreeResponse.json as GroupRecord).visaSetup?.raudhahAppointments?.[0]?.status, "FREE");

    const raudhahBeforeResponse = await putJson(
      `/api/groups/${encodeURIComponent(groupCodes.inactivePending)}/visa/raudhah`,
      { date: dates.raudhahCriticalIso, status: "BEFORE" },
    );
    assert.equal(raudhahBeforeResponse.status, 200, `Upsert BEFORE raudhah failed: ${raudhahBeforeResponse.text}`);

    const raudhahAfterResponse = await putJson(
      `/api/groups/${encodeURIComponent(groupCodes.activeUnpaid)}/visa/raudhah`,
      { date: dates.raudhahUrgentIso, status: "AFTER" },
    );
    assert.equal(raudhahAfterResponse.status, 200, `Upsert AFTER raudhah failed: ${raudhahAfterResponse.text}`);

    const reminderGroups = ensureArray<GroupRecord>(
      (await requestJson(server.baseUrl, "/api/groups")).json,
      "Reminder group payload should be array.",
    );
    const reminderByCode = new Map(reminderGroups.map((group) => [group.code ?? "", group]));
    assert.equal(
      reminderByCode.get(groupCodes.activeIssued)?.visaSetup?.raudhahAppointments?.[0]?.date,
      dates.raudhahActiveIso,
    );
    assert.equal(
      reminderByCode.get(groupCodes.inactivePending)?.visaSetup?.raudhahAppointments?.[0]?.status,
      "BEFORE",
    );
    assert.equal(
      reminderByCode.get(groupCodes.activeUnpaid)?.visaSetup?.raudhahAppointments?.[0]?.status,
      "AFTER",
    );

    const invoiceClients = ensureArray<InvoiceClient>(
      (await requestJson(server.baseUrl, "/api/invoices/clients")).json,
      "Invoice clients payload should be array.",
    );
    assert.equal(invoiceClients.length >= 1, true);

    const pendingInvoiceResponse = await postJson("/api/invoices", {
      agentId: "agent_gtt_direct",
      clientId: invoiceClients[0]?.id,
      groupCode: groupCodes.activeIssued,
      issuedDate: todayIso,
      dueDate: addUtcDays(todayIso, 10),
      amount: 5_000_000,
      downPaymentIdr: 1_500_000,
    });
    assert.equal(pendingInvoiceResponse.status, 201, `Create pending invoice failed: ${pendingInvoiceResponse.text}`);
    const pendingInvoice = pendingInvoiceResponse.json as InvoiceRecord;
    assert.equal(pendingInvoice.status, "Partially Paid");
    assert.equal(pendingInvoice.downPaymentIdr, 1_500_000);

    const overdueInvoiceResponse = await postJson("/api/invoices", {
      agentId: "agent_gtt_direct",
      clientName: "Scenario Overdue Client",
      groupCode: groupCodes.inactivePending,
      issuedDate: addUtcDays(todayIso, -7),
      dueDate: addUtcDays(todayIso, -1),
      amount: 1_250_000,
      downPaymentIdr: 250_000,
    });
    assert.equal(overdueInvoiceResponse.status, 201, `Create overdue invoice failed: ${overdueInvoiceResponse.text}`);
    const overdueInvoice = overdueInvoiceResponse.json as InvoiceRecord;
    assert.equal(overdueInvoice.status, "Overdue");
    assert.equal(overdueInvoice.downPaymentIdr, 250_000);

    const paidInvoiceResponse = await postJson("/api/invoices", {
      agentId: "agent_gtt_direct",
      clientName: "Scenario Paid Client",
      groupCode: groupCodes.activeUnpaid,
      issuedDate: addUtcDays(todayIso, -6),
      dueDate: addUtcDays(todayIso, -2),
      amount: 2_300_000,
      downPaymentIdr: 2_300_000,
      status: "PAID",
    });
    assert.equal(paidInvoiceResponse.status, 201, `Create paid invoice failed: ${paidInvoiceResponse.text}`);
    const paidInvoice = paidInvoiceResponse.json as InvoiceRecord;
    assert.equal(paidInvoice.status, "Paid");
    assert.equal(paidInvoice.downPaymentIdr, 2_300_000);

    const cancelledInvoiceResponse = await postJson("/api/invoices", {
      agentId: "agent_gtt_direct",
      clientName: "Scenario Cancelled Client",
      issuedDate: todayIso,
      dueDate: addUtcDays(todayIso, 5),
      amount: 990_000,
      downPaymentIdr: 120_000,
      status: "CANCELLED",
    });
    assert.equal(
      cancelledInvoiceResponse.status,
      201,
      `Create cancelled invoice failed: ${cancelledInvoiceResponse.text}`,
    );
    const cancelledInvoice = cancelledInvoiceResponse.json as InvoiceRecord;
    assert.equal(cancelledInvoice.status, "Cancelled");
    assert.equal(cancelledInvoice.amount, 990_000);
    assert.equal(cancelledInvoice.downPaymentIdr, 120_000);

    const invalidClientInvoiceResponse = await postJson("/api/invoices", {
      agentId: "agent_gtt_direct",
      clientId: "unknown-client-id",
      issuedDate: todayIso,
      dueDate: addUtcDays(todayIso, 1),
      amount: 10_000,
    });
    assert.equal(invalidClientInvoiceResponse.status, 404, "Unknown client should return 404.");

    const missingClientInvoiceResponse = await postJson("/api/invoices", {
      agentId: "agent_gtt_direct",
      issuedDate: todayIso,
      dueDate: addUtcDays(todayIso, 1),
      amount: 10_000,
    });
    assert.equal(missingClientInvoiceResponse.status, 400, "Missing client should return 400.");

    const cancelledUpdateResponse = await patchJson(`/api/invoices/${cancelledInvoice.id ?? ""}`, {
      amount: 123_456,
      downPaymentIdr: 50_000,
      status: "CANCELLED",
      version: (cancelledInvoice as { version?: number }).version ?? 0,
    });
    assert.equal(cancelledUpdateResponse.status, 200, `Update cancelled invoice failed: ${cancelledUpdateResponse.text}`);
    assert.equal((cancelledUpdateResponse.json as InvoiceRecord).amount, 123_456);
    assert.equal((cancelledUpdateResponse.json as InvoiceRecord).downPaymentIdr, 50_000);

    const allInvoicesBefore = ensureArray<InvoiceRecord>(
      (await requestJson(server.baseUrl, "/api/invoices")).json,
      "Invoice list payload should be array.",
    );
    const statusSetBefore = new Set(allInvoicesBefore.map((invoice) => invoice.status));
    assert.equal(statusSetBefore.has("Partially Paid"), true);
    assert.equal(statusSetBefore.has("Overdue"), true);
    assert.equal(statusSetBefore.has("Paid"), true);

    const invoiceDeleteResponse = await requestJson(
      server.baseUrl,
      `/api/invoices/${pendingInvoice.id ?? ""}`,
      { method: "DELETE" },
    );
    assert.equal(invoiceDeleteResponse.status, 200, "Delete invoice failed.");

    const allInvoicesAfter = ensureArray<InvoiceRecord>(
      (await requestJson(server.baseUrl, "/api/invoices")).json,
      "Invoice list payload should be array.",
    );
    const statusSetAfter = new Set(allInvoicesAfter.map((invoice) => invoice.status));
    assert.equal(statusSetAfter.has("Partially Paid"), false, "Partially Paid invoice should be deleted.");
    assert.equal(statusSetAfter.has("Overdue"), true);
    assert.equal(statusSetAfter.has("Paid"), true);
    // Test oversized payload returns 413
    const oversizedPayload = "a".repeat(1.1 * 1024 * 1024); // 1.1 MB
    const oversizedResponse = await requestJson(
      server.baseUrl,
      "/api/invoices",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: oversizedPayload }),
      }
    );
    assert.equal(oversizedResponse.status, 413, `Oversized payload should return 413, got ${oversizedResponse.status}`);

    await cleanupAllGroups(server.baseUrl);
  } finally {
    activeAuthCookie = null;
    await server.shutdown();
  }
}

async function testAgentAuthBoundaryAndMutationFirewall(): Promise<void> {
  const server = await startBackendServer();
  try {
    await authenticateDevSession(server.baseUrl);
    const internalCookie = activeAuthCookie;
    assert.ok(internalCookie, "Internal authentication cookie should be available.");

    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const agentResponse = await requestJson(server.baseUrl, "/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: `PORTAL-${uniqueSuffix}`,
        name: `Portal Partner ${uniqueSuffix}`,
        type: "PARTNER",
      }),
    });
    assert.equal(agentResponse.status, 201, `Partner creation failed: ${agentResponse.text}`);
    const agentId = (agentResponse.json as { id?: string }).id;
    assert.ok(agentId, "Partner creation should return an id.");

    const identifier = `portal-${uniqueSuffix}@example.com`;
    const password = "PortalBoundary#2026";
    const accountResponse = await requestJson(server.baseUrl, "/api/agent-portal-accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId,
        displayName: "Portal Boundary Operator",
        email: identifier,
        password,
      }),
    });
    assert.equal(accountResponse.status, 201, `Portal account creation failed: ${accountResponse.text}`);
    assert.equal(
      Object.prototype.hasOwnProperty.call(accountResponse.json as object, "passwordHash"),
      false,
      "Provisioning response must not expose passwordHash.",
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(accountResponse.json as object, "tokenVersion"),
      false,
      "Provisioning response must not expose tokenVersion.",
    );

    const agentLogin = await requestJson(server.baseUrl, "/api/agent/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "" },
      body: JSON.stringify({ identifier, password }),
    });
    assert.equal(agentLogin.status, 200, `Agent login failed: ${agentLogin.text}`);
    const agentCookie = (agentLogin.headers.get("set-cookie") ?? "").split(";")[0]?.trim();
    assert.ok(agentCookie?.startsWith("gtt_agent_session="), "Agent login should set its dedicated cookie.");
    assert.equal(
      (agentLogin.headers.get("set-cookie") ?? "").includes("Path=/api/agent"),
      true,
      "Agent cookie should be scoped to /api/agent.",
    );

    const agentSession = await requestJson(server.baseUrl, "/api/agent/auth/session", {
      headers: { cookie: agentCookie },
    });
    assert.equal(agentSession.status, 200, `Agent session failed: ${agentSession.text}`);
    assert.equal(
      (agentSession.json as { user?: { agentId?: string } }).user?.agentId,
      agentId,
      "Agent session should derive the provisioned tenant.",
    );

    const foreignAgentResponse = await requestJson(server.baseUrl, "/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: internalCookie },
      body: JSON.stringify({
        code: `FOREIGN-${uniqueSuffix}`,
        name: `Foreign Partner ${uniqueSuffix}`,
        type: "PARTNER",
      }),
    });
    assert.equal(foreignAgentResponse.status, 201, `Foreign Partner creation failed: ${foreignAgentResponse.text}`);
    const foreignAgentId = (foreignAgentResponse.json as { id?: string }).id;
    assert.ok(foreignAgentId, "Foreign Partner creation should return an id.");

    const ownGroupCode = `OWN-${uniqueSuffix}`;
    const foreignGroupCode = `OTHER-${uniqueSuffix}`;
    for (const groupPayload of [
      {
        ...createGroupPayload(ownGroupCode),
        agentId,
        name: "Owned Portal Group",
        notes: [{ sortOrder: 0, text: "OWN PRIVATE NOTE", pinned: true }],
      },
      {
        ...createGroupPayload(foreignGroupCode),
        agentId: foreignAgentId,
        name: "Foreign Portal Group",
        pax: 999,
        notes: [{ sortOrder: 0, text: "FOREIGN PRIVATE NOTE", pinned: true }],
      },
    ]) {
      const groupResponse = await requestJson(server.baseUrl, "/api/groups", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: internalCookie },
        body: JSON.stringify(groupPayload),
      });
      assert.equal(groupResponse.status, 201, `Portal boundary group creation failed: ${groupResponse.text}`);
    }

    const invoiceDate = toIsoDateOnly(new Date());
    const invoiceDueDate = addUtcDays(invoiceDate, 14);
    let ownInvoiceId = "";
    let foreignInvoiceId = "";
    for (const invoicePayload of [
      {
        agentId,
        groupCode: ownGroupCode,
        clientName: `Owned Portal Client ${uniqueSuffix}`,
        amount: 88_000_000,
        notes: "OWN PRIVATE INVOICE NOTE",
        description: "OWN PRIVATE DESCRIPTION",
        recipientName: "OWN PRIVATE RECIPIENT",
      },
      {
        agentId: foreignAgentId,
        groupCode: foreignGroupCode,
        clientName: `Foreign Portal Client ${uniqueSuffix}`,
        amount: 999_000_000,
        notes: "FOREIGN PRIVATE INVOICE NOTE",
      },
    ]) {
      const invoiceResponse = await requestJson(server.baseUrl, "/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: internalCookie },
        body: JSON.stringify({ ...invoicePayload, issuedDate: invoiceDate, dueDate: invoiceDueDate }),
      });
      assert.equal(invoiceResponse.status, 201, `Portal boundary invoice creation failed: ${invoiceResponse.text}`);
      const createdId = (invoiceResponse.json as { id?: string }).id ?? "";
      assert.notEqual(createdId, "", "Portal boundary invoice should return an id.");
      if (invoicePayload.agentId === agentId) ownInvoiceId = createdId;
      else foreignInvoiceId = createdId;
    }

    const profileResponse = await requestJson(server.baseUrl, "/api/agent/profile", {
      headers: { cookie: agentCookie },
    });
    assert.equal(profileResponse.status, 200, `Agent profile failed: ${profileResponse.text}`);
    assert.deepEqual(profileResponse.json, {
      account: { displayName: "Portal Boundary Operator" },
      agent: { code: `PORTAL-${uniqueSuffix}`, name: `Portal Partner ${uniqueSuffix}` },
    });
    assert.equal(profileResponse.headers.get("cache-control"), "private, no-store");

    const dashboardResponse = await requestJson(server.baseUrl, "/api/agent/dashboard", {
      headers: { cookie: agentCookie },
    });
    assert.equal(dashboardResponse.status, 200, `Agent dashboard failed: ${dashboardResponse.text}`);
    const dashboard = dashboardResponse.json as {
      groups?: { total?: number; totalPax?: number };
      upcomingGroups?: Array<{ code?: string }>;
    };
    assert.equal(dashboard.groups?.total, 1, "Dashboard total must include only the session Agent.");
    assert.equal(dashboard.groups?.totalPax, 25, "Dashboard pax must exclude the foreign Agent.");
    assert.deepEqual(dashboard.upcomingGroups?.map((group) => group.code), [ownGroupCode]);
    assert.equal(dashboardResponse.text.includes(foreignGroupCode), false, "Dashboard must not expose another Agent's group.");
    assert.equal(dashboardResponse.text.includes("PRIVATE NOTE"), false, "Dashboard must not expose internal notes.");
    assert.equal(dashboardResponse.headers.get("cache-control"), "private, no-store");

    const portalGroupsResponse = await requestJson(
      server.baseUrl,
      "/api/agent/groups?q=Owned&page=1&pageSize=10&sortBy=code&sortDirection=asc",
      { headers: { cookie: agentCookie } },
    );
    assert.equal(portalGroupsResponse.status, 200, `Agent group list failed: ${portalGroupsResponse.text}`);
    const portalGroups = portalGroupsResponse.json as { items?: Array<{ code?: string }>; total?: number };
    assert.equal(portalGroups.total, 1, "Agent group result count must remain tenant-scoped.");
    assert.deepEqual(portalGroups.items?.map((group) => group.code), [ownGroupCode]);
    assert.equal(portalGroupsResponse.text.includes(foreignGroupCode), false);
    assert.equal(portalGroupsResponse.text.includes("PRIVATE NOTE"), false);

    const ownDetailResponse = await requestJson(
      server.baseUrl,
      `/api/agent/groups/${encodeURIComponent(ownGroupCode)}`,
      { headers: { cookie: agentCookie } },
    );
    assert.equal(ownDetailResponse.status, 200, `Agent group detail failed: ${ownDetailResponse.text}`);
    assert.equal((ownDetailResponse.json as { code?: string }).code, ownGroupCode);
    assert.equal(ownDetailResponse.text.includes("PRIVATE NOTE"), false);

    const foreignDetailResponse = await requestJson(
      server.baseUrl,
      `/api/agent/groups/${encodeURIComponent(foreignGroupCode)}`,
      { headers: { cookie: agentCookie } },
    );
    const missingDetailResponse = await requestJson(server.baseUrl, "/api/agent/groups/MISSING-PORTAL-GROUP", {
      headers: { cookie: agentCookie },
    });
    assert.equal(foreignDetailResponse.status, 404);
    assert.equal(missingDetailResponse.status, 404);
    assert.deepEqual(foreignDetailResponse.json, missingDetailResponse.json, "Cross-tenant and missing groups must be indistinguishable.");

    for (const facet of ["itinerary", "timeline", "visa", "hotel-agreements", "transportation"]) {
      const facetResponse = await requestJson(
        server.baseUrl,
        `/api/agent/groups/${encodeURIComponent(ownGroupCode)}/${facet}`,
        { headers: { cookie: agentCookie } },
      );
      assert.equal(facetResponse.status, 200, `Agent group ${facet} failed: ${facetResponse.text}`);
      assert.equal(facetResponse.text.includes("PRIVATE NOTE"), false, `${facet} must not expose internal notes.`);
    }

    const unknownGroupQuery = await requestJson(server.baseUrl, "/api/agent/groups?debug=1", {
      headers: { cookie: agentCookie },
    });
    assert.equal(unknownGroupQuery.status, 400, "Unknown Agent group query fields must be rejected.");

    const portalInvoicesResponse = await requestJson(
      server.baseUrl,
      "/api/agent/invoices?page=1&pageSize=10&sortBy=dueDate&sortDirection=desc",
      { headers: { cookie: agentCookie } },
    );
    assert.equal(portalInvoicesResponse.status, 200, `Agent invoice list failed: ${portalInvoicesResponse.text}`);
    const portalInvoices = portalInvoicesResponse.json as { items?: Array<{ id?: string }>; total?: number };
    assert.equal(portalInvoices.total, 1, "Agent invoice count must remain tenant-scoped.");
    assert.deepEqual(portalInvoices.items?.map((invoice) => invoice.id), [ownInvoiceId]);
    assert.equal(portalInvoicesResponse.text.includes(foreignInvoiceId), false);
    assert.equal(portalInvoicesResponse.text.includes("PRIVATE"), false);
    assert.equal(portalInvoicesResponse.text.includes("88000000"), false);

    const ownInvoiceResponse = await requestJson(
      server.baseUrl,
      `/api/agent/invoices/${encodeURIComponent(ownInvoiceId)}`,
      { headers: { cookie: agentCookie } },
    );
    assert.equal(ownInvoiceResponse.status, 200, `Agent invoice detail failed: ${ownInvoiceResponse.text}`);
    assert.equal((ownInvoiceResponse.json as { id?: string }).id, ownInvoiceId);
    assert.equal(ownInvoiceResponse.text.includes("PRIVATE"), false);
    assert.equal(ownInvoiceResponse.text.includes("88000000"), false);

    const foreignInvoiceResponse = await requestJson(
      server.baseUrl,
      `/api/agent/invoices/${encodeURIComponent(foreignInvoiceId)}`,
      { headers: { cookie: agentCookie } },
    );
    const missingInvoiceResponse = await requestJson(server.baseUrl, "/api/agent/invoices/MISSING-INVOICE", {
      headers: { cookie: agentCookie },
    });
    assert.equal(foreignInvoiceResponse.status, 404);
    assert.equal(missingInvoiceResponse.status, 404);
    assert.deepEqual(foreignInvoiceResponse.json, missingInvoiceResponse.json);

    const invoiceTenantSubstitution = await requestJson(
      server.baseUrl,
      `/api/agent/invoices?agentId=${encodeURIComponent(foreignAgentId)}`,
      { headers: { cookie: agentCookie } },
    );
    assert.equal(invoiceTenantSubstitution.status, 400, "Invoice tenant substitution must be rejected.");

    const querySubstitution = await requestJson(
      server.baseUrl,
      `/api/agent/dashboard?agentId=${encodeURIComponent(foreignAgentId)}`,
      { headers: { cookie: agentCookie } },
    );
    assert.equal(querySubstitution.status, 400, "Agent Portal must reject query tenant substitution.");
    const headerSubstitution = await requestJson(server.baseUrl, "/api/agent/profile", {
      headers: { cookie: agentCookie, "x-agent-id": foreignAgentId },
    });
    assert.equal(headerSubstitution.status, 400, "Agent Portal must reject header tenant substitution.");

    const internalCookieOnAgentRoute = await requestJson(server.baseUrl, "/api/agent/auth/session", {
      headers: { cookie: internalCookie },
    });
    assert.equal(internalCookieOnAgentRoute.status, 401, "Internal cookie must not authenticate an Agent route.");

    const groupsBefore = ensureArray<GroupRecord>(
      (await requestJson(server.baseUrl, "/api/groups", { headers: { cookie: internalCookie } })).json,
      "Internal group list should be an array.",
    );
    const agentsBefore = ensureArray<unknown>(
      (await requestJson(server.baseUrl, "/api/agents", { headers: { cookie: internalCookie } })).json,
      "Internal Agent list should be an array.",
    );

    const deniedMutations: Array<{ method: string; path: string }> = [
      { method: "POST", path: "/api/agents" },
      { method: "PATCH", path: `/api/agents/${agentId}` },
      { method: "PATCH", path: `/api/agents/${agentId}/status` },
      { method: "POST", path: "/api/agent-portal-accounts" },
      { method: "PATCH", path: "/api/agent-portal-accounts/account/status" },
      { method: "PUT", path: "/api/agent-portal-accounts/account/password" },
      { method: "POST", path: "/api/agent-portal-accounts/account/revoke" },
      { method: "POST", path: "/api/master-data/options" },
      { method: "PATCH", path: "/api/master-data/options/option" },
      { method: "POST", path: "/api/auth/users" },
      { method: "PATCH", path: "/api/auth/users/user" },
      { method: "PUT", path: "/api/auth/users/user/password" },
      { method: "DELETE", path: "/api/auth/users/user" },
      { method: "POST", path: "/api/groups" },
      { method: "POST", path: "/api/groups/identity" },
      { method: "PUT", path: "/api/groups/UNKNOWN" },
      { method: "PATCH", path: "/api/groups/UNKNOWN" },
      { method: "POST", path: "/api/groups/UNKNOWN/reassign-agent" },
      { method: "POST", path: "/api/groups/UNKNOWN/itinerary" },
      { method: "PATCH", path: "/api/groups/UNKNOWN/itinerary/item" },
      { method: "DELETE", path: "/api/groups/UNKNOWN/itinerary/item" },
      { method: "POST", path: "/api/groups/UNKNOWN/checklist/confirm-driver" },
      { method: "POST", path: "/api/groups/UNKNOWN/checklist/reset-driver" },
      { method: "POST", path: "/api/groups/UNKNOWN/visa/hotels" },
      { method: "PATCH", path: "/api/groups/UNKNOWN/visa/hotels/hotel" },
      { method: "DELETE", path: "/api/groups/UNKNOWN/visa/hotels/hotel" },
      { method: "PUT", path: "/api/groups/UNKNOWN/visa/raudhah" },
      { method: "DELETE", path: "/api/groups/UNKNOWN" },
      { method: "POST", path: "/api/visa/agreement-drafts" },
      { method: "PATCH", path: "/api/visa/agreement-drafts/draft" },
      { method: "DELETE", path: "/api/visa/agreement-drafts/draft" },
      { method: "POST", path: "/api/visa/agreement-drafts/draft/assign" },
      { method: "POST", path: "/api/visa/agreement-drafts/draft/unassign" },
      { method: "POST", path: "/api/invoices" },
      { method: "PATCH", path: "/api/invoices/invoice" },
      { method: "DELETE", path: "/api/invoices/invoice" },
    ];
    for (const mutation of deniedMutations) {
      const denied = await requestJson(server.baseUrl, mutation.path, {
        method: mutation.method,
        headers: {
          cookie: agentCookie,
          origin: server.baseUrl,
          "content-type": "application/json",
        },
        body: mutation.method === "DELETE" ? undefined : "{}",
      });
      assert.equal(
        denied.status,
        401,
        `Agent cookie should be rejected before internal mutation ${mutation.method} ${mutation.path}: ${denied.text}`,
      );
    }

    const groupsAfter = ensureArray<GroupRecord>(
      (await requestJson(server.baseUrl, "/api/groups", { headers: { cookie: internalCookie } })).json,
      "Internal group list should be an array.",
    );
    const agentsAfter = ensureArray<unknown>(
      (await requestJson(server.baseUrl, "/api/agents", { headers: { cookie: internalCookie } })).json,
      "Internal Agent list should be an array.",
    );
    assert.equal(groupsAfter.length, groupsBefore.length, "Denied Agent mutations must not create groups.");
    assert.equal(agentsAfter.length, agentsBefore.length, "Denied Agent mutations must not create Agents.");
  } finally {
    activeAuthCookie = null;
    await server.shutdown();
  }
}

describe("backend api e2e tests", () => {
  it("should run backend api e2e flow", async () => {
    await testBackendApiFlow();
  });

  it("should run backend managed user password http flow", async () => {
    await testManagedUserPasswordHttpFlow();
  });

  it("should run backend comprehensive add-group overview invoice raudhah flow", async () => {
    await testComprehensiveAddGroupOverviewInvoiceAndRaudhahFlow();
  });

  it("should isolate Agent auth and reject all internal mutations", async () => {
    await testAgentAuthBoundaryAndMutationFirewall();
  });
});
