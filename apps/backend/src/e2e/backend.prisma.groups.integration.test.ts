import "dotenv/config";
import "reflect-metadata";
import assert from "node:assert/strict";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";

type StartedServer = {
  baseUrl: string;
  shutdown: () => Promise<void>;
};

type RequestResult = {
  status: number;
  json: unknown;
  text: string;
  headers: Headers;
};

type GroupPayload = {
  id?: string;
  code?: string;
  name?: string;
  pax?: number;
  itinerary?: Array<{ id?: string; sortOrder?: number; title?: string }>;
  visaSetup?: {
    hotelAgreements?: Array<{ id?: string; status?: string; city?: string }>;
    raudhahAppointments?: Array<{ status?: string; date?: string; tasrehPrinted?: boolean }>;
  };
  checklistAssignments?: Array<{
    id?: string;
    itineraryItemId?: string | null;
    status?: string;
    drivers?: Array<{ slotNumber?: number; isVerified?: boolean }>;
  }>;
};

const DEV_AUTH_IDENTIFIER = process.env.DEV_AUTH_IDENTIFIER?.trim() || "dev.superadmin";
const DEV_AUTH_PASSWORD =
  process.env.DEV_AUTH_SUPERADMIN_PASSWORD?.trim() || "DevSuperAdmin#2026";
const DEV_AUTH_ADMIN_PASSWORD =
  process.env.DEV_AUTH_ADMIN_PASSWORD?.trim() || "DevAdmin#2026";
const prisma = new PrismaClient();
let activeAuthCookie: string | null = null;

function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => {
    console.log(`PASS ${name}`);
  });
}

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(baseIsoDate: string, dayOffset: number): string {
  const nextDate = new Date(`${baseIsoDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
  return toIsoDateOnly(nextDate);
}

function buildUniqueCode(prefix = "PRS-GRP"): string {
  const timeFragment = Date.now().toString().slice(-8);
  const randomFragment = Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0");
  return `${prefix}-${timeFragment}${randomFragment}`;
}

function restoreEnvVar(key: string, previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = previousValue;
}

function ensureConfiguredDatabaseUrl(): void {
  const resolvedDatabaseUrl = process.env.TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!resolvedDatabaseUrl) {
    throw new Error(
      "DATABASE_URL (or TEST_DATABASE_URL) is required for Prisma integration tests.",
    );
  }
}

async function startBackendServerWithPrisma(): Promise<StartedServer> {
  ensureConfiguredDatabaseUrl();

  const port = 4700 + Math.floor(Math.random() * 250);
  const baseUrl = `http://127.0.0.1:${port}`;
  const previousPort = process.env.PORT;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousBootstrapDefaultUsers = process.env.AUTH_BOOTSTRAP_DEFAULT_USERS;
  const previousDevSuperAdminPassword = process.env.DEV_AUTH_SUPERADMIN_PASSWORD;
  const previousDevAdminPassword = process.env.DEV_AUTH_ADMIN_PASSWORD;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
  }
  process.env.PORT = String(port);
  process.env.DATA_SOURCE = "prisma";
  process.env.AUTH_BOOTSTRAP_DEFAULT_USERS = "true";
  process.env.DEV_AUTH_SUPERADMIN_PASSWORD = DEV_AUTH_PASSWORD;
  process.env.DEV_AUTH_ADMIN_PASSWORD = DEV_AUTH_ADMIN_PASSWORD;

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
    restoreEnvVar("DATABASE_URL", previousDatabaseUrl);
    restoreEnvVar("AUTH_BOOTSTRAP_DEFAULT_USERS", previousBootstrapDefaultUsers);
    restoreEnvVar("DEV_AUTH_SUPERADMIN_PASSWORD", previousDevSuperAdminPassword);
    restoreEnvVar("DEV_AUTH_ADMIN_PASSWORD", previousDevAdminPassword);
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
      restoreEnvVar("DATABASE_URL", previousDatabaseUrl);
      restoreEnvVar("AUTH_BOOTSTRAP_DEFAULT_USERS", previousBootstrapDefaultUsers);
      restoreEnvVar("DEV_AUTH_SUPERADMIN_PASSWORD", previousDevSuperAdminPassword);
      restoreEnvVar("DEV_AUTH_ADMIN_PASSWORD", previousDevAdminPassword);
    },
  };
}

async function requestJson(baseUrl: string, path: string, init?: RequestInit): Promise<RequestResult> {
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

function postJson(baseUrl: string, path: string, payload: unknown): Promise<RequestResult> {
  return requestJson(baseUrl, path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function patchJson(baseUrl: string, path: string, payload: unknown): Promise<RequestResult> {
  return requestJson(baseUrl, path, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function putJson(baseUrl: string, path: string, payload: unknown): Promise<RequestResult> {
  return requestJson(baseUrl, path, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

async function authenticateDevSession(baseUrl: string): Promise<void> {
  const loginResponse = await postJson(baseUrl, "/api/auth/login", {
    identifier: DEV_AUTH_IDENTIFIER,
    password: DEV_AUTH_PASSWORD,
    rememberSession: false,
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

function createBaseGroupPayload(groupCode: string, groupName: string): Record<string, unknown> {
  const todayIso = toIsoDateOnly(new Date());
  const arrivalIso = addUtcDays(todayIso, 2);
  const returnIso = addUtcDays(arrivalIso, 7);

  return {
    code: groupCode,
    name: groupName,
    status: "Active",
    arrivalDate: arrivalIso,
    returnDate: returnIso,
    tone: "ACTIVE",
    pax: 30,
    totalBuses: 1,
    packageName: "Prisma Integration Package",
    durationDays: 8,
    timeline: [
      {
        sortOrder: 0,
        dateLabel: "2 Apr",
        title: "Arrival",
        isCurrent: true,
        nextActivity: "Arrival to Makkah",
      },
    ],
    itinerary: [
      {
        sortOrder: 0,
        dateLabel: "2 Apr",
        yearLabel: "2026",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Arrival to Makkah",
        meta: "08:00 | JED -> Makkah",
        icon: "flight_land",
        isoDate: arrivalIso,
        time: "08:00",
        fromLocation: "JED Airport",
        toLocation: "Makkah Hotel",
        requiresBus: true,
      },
    ],
    notes: [
      {
        sortOrder: 0,
        text: "Created by Prisma integration test.",
        pinned: true,
      },
    ],
    checklistAssignments: [],
  };
}

async function cleanupGroupsByCode(codes: string[]): Promise<void> {
  if (codes.length === 0) {
    return;
  }

  await prisma.group.deleteMany({
    where: {
      code: {
        in: codes,
      },
    },
  });
}

async function testPrismaGroupsMainFlow(): Promise<void> {
  const server = await startBackendServerWithPrisma();
  const createdCodes: string[] = [];
  const initialCode = buildUniqueCode("PRS-GRP");
  const replacedCode = `${initialCode}-REP`;
  createdCodes.push(initialCode, replacedCode);

  try {
    const healthResponse = await requestJson(server.baseUrl, "/api/health");
    assert.equal(healthResponse.status, 200, `Health check failed: ${healthResponse.text}`);
    assert.equal((healthResponse.json as { dataSource?: string }).dataSource, "prisma");

    await authenticateDevSession(server.baseUrl);

    const createResponse = await postJson(
      server.baseUrl,
      "/api/groups",
      createBaseGroupPayload(initialCode, "Prisma Main Flow Group"),
    );
    assert.equal(createResponse.status, 201, `Create group failed: ${createResponse.text}`);
    const createdGroup = createResponse.json as GroupPayload;
    assert.equal(createdGroup.code, initialCode);
    assert.equal((createdGroup.itinerary ?? []).length, 1);

    const findResponse = await requestJson(server.baseUrl, `/api/groups/${encodeURIComponent(initialCode)}`);
    assert.equal(findResponse.status, 200, `Find group failed: ${findResponse.text}`);
    const foundGroup = findResponse.json as GroupPayload;
    assert.equal(foundGroup.code, initialCode);
    const originalItineraryId = (foundGroup.itinerary ?? [])[0]?.id ?? "";
    assert.notEqual(originalItineraryId, "", "Expected existing itinerary id for replace flow.");

    const replacePayload = createBaseGroupPayload(replacedCode, "Prisma Replaced Group");
    (replacePayload.checklistAssignments as unknown[]) = [
      {
        itineraryItemId: originalItineraryId,
        tripDate: addUtcDays(toIsoDateOnly(new Date()), 3),
        activity: "Departure",
        tripLabel: "Departure to airport",
        requiredBusCount: 1,
        scheduledTime: "18:30",
      },
    ];
    const replaceResponse = await putJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(initialCode)}`,
      replacePayload,
    );
    assert.equal(replaceResponse.status, 200, `Replace group failed: ${replaceResponse.text}`);
    const replacedGroup = replaceResponse.json as GroupPayload;
    assert.equal(replacedGroup.code, replacedCode);

    const replacedItineraryId = (replacedGroup.itinerary ?? [])[0]?.id ?? "";
    assert.notEqual(replacedItineraryId, "", "Expected itinerary id after replace.");
    assert.notEqual(
      replacedItineraryId,
      originalItineraryId,
      "Replace flow should create a fresh itinerary record.",
    );
    assert.equal(
      (replacedGroup.checklistAssignments ?? [])[0]?.itineraryItemId,
      replacedItineraryId,
      "Checklist assignment should be relinked to replaced itinerary item by sort order.",
    );

    const listPaginatedResponse = await requestJson(
      server.baseUrl,
      "/api/groups?page=1&pageSize=5&filter=not-issued",
    );
    assert.equal(
      listPaginatedResponse.status,
      200,
      `Paginated/filter list failed: ${listPaginatedResponse.text}`,
    );
    const paginatedPayload = listPaginatedResponse.json as {
      items?: Array<{ code?: string }>;
      total?: number;
      page?: number;
      pageSize?: number;
    };
    assert.equal(Array.isArray(paginatedPayload.items), true);
    assert.equal(paginatedPayload.page, 1);
    assert.equal(paginatedPayload.pageSize, 5);
    assert.equal(
      (paginatedPayload.items ?? []).some((item) => item.code === replacedCode),
      true,
      "Expected replaced group to appear in filtered list.",
    );

    const patchGroupResponse = await patchJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}`,
      {
        name: "Prisma Replaced Group Updated",
        pax: 34,
      },
    );
    assert.equal(patchGroupResponse.status, 200, `Patch group failed: ${patchGroupResponse.text}`);
    const patchedGroup = patchGroupResponse.json as GroupPayload;
    assert.equal(patchedGroup.name, "Prisma Replaced Group Updated");
    assert.equal(patchedGroup.pax, 34);

    const addItineraryResponse = await postJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/itinerary`,
      {
        sortOrder: 1,
        dateLabel: "3 Apr",
        yearLabel: "2026",
        category: "Transfer",
        categoryKey: "transfer",
        title: "Transfer to Madinah",
        meta: "09:00 | Makkah -> Madinah",
        icon: "airport_shuttle",
        isoDate: addUtcDays(toIsoDateOnly(new Date()), 4),
        time: "09:00",
        fromLocation: "Makkah Hotel",
        toLocation: "Madinah Hotel",
        requiresBus: true,
      },
    );
    assert.equal(addItineraryResponse.status, 201, `Add itinerary failed: ${addItineraryResponse.text}`);
    const withAddedItinerary = addItineraryResponse.json as GroupPayload;
    const addedItinerary = (withAddedItinerary.itinerary ?? []).find((item) => item.sortOrder === 1);
    assert.notEqual(addedItinerary?.id ?? "", "", "Expected newly added itinerary item.");

    const addedItineraryId = addedItinerary?.id ?? "";
    const updateItineraryResponse = await patchJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/itinerary/${encodeURIComponent(addedItineraryId)}`,
      {
        sortOrder: 1,
        dateLabel: "3 Apr",
        yearLabel: "2026",
        category: "Transfer",
        categoryKey: "transfer",
        title: "Transfer to Madinah Updated",
        meta: "10:00 | Makkah -> Madinah",
        icon: "airport_shuttle",
        isoDate: addUtcDays(toIsoDateOnly(new Date()), 4),
        time: "10:00",
        fromLocation: "Makkah Hotel",
        toLocation: "Madinah Hotel",
        requiresBus: true,
      },
    );
    assert.equal(
      updateItineraryResponse.status,
      200,
      `Update itinerary failed: ${updateItineraryResponse.text}`,
    );
    const withUpdatedItinerary = updateItineraryResponse.json as GroupPayload;
    assert.equal(
      (withUpdatedItinerary.itinerary ?? []).some((item) => item.title === "Transfer to Madinah Updated"),
      true,
      "Expected updated itinerary title.",
    );

    const removeItineraryResponse = await requestJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/itinerary/${encodeURIComponent(addedItineraryId)}`,
      { method: "DELETE" },
    );
    assert.equal(
      removeItineraryResponse.status,
      200,
      `Remove itinerary failed: ${removeItineraryResponse.text}`,
    );

    const confirmChecklistResponse = await postJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/checklist/confirm-driver`,
      {
        tripDate: addUtcDays(toIsoDateOnly(new Date()), 3),
        activity: "Departure",
        tripLabel: "Departure to airport",
        requiredBusCount: 1,
        scheduledTime: "18:30",
        driver: {
          name: "Driver Prisma",
          phone: "+966 50 777 7777",
          plateNumber: "B 7777 PRS",
        },
      },
    );
    assert.equal(
      confirmChecklistResponse.status,
      201,
      `Confirm checklist driver failed: ${confirmChecklistResponse.text}`,
    );
    const confirmedChecklist = confirmChecklistResponse.json as {
      status?: string;
      drivers?: Array<{ slotNumber?: number; isVerified?: boolean }>;
    };
    assert.equal(confirmedChecklist.status, "ASSIGNED");
    assert.equal((confirmedChecklist.drivers ?? []).length, 1);
    assert.equal((confirmedChecklist.drivers ?? [])[0]?.slotNumber, 1);
    assert.equal((confirmedChecklist.drivers ?? [])[0]?.isVerified, true);

    const resetChecklistResponse = await postJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/checklist/reset-driver`,
      {
        tripDate: addUtcDays(toIsoDateOnly(new Date()), 3),
        scheduledTime: "18:30",
        activity: "Departure",
      },
    );
    assert.equal(
      resetChecklistResponse.status,
      201,
      `Reset checklist driver failed: ${resetChecklistResponse.text}`,
    );
    const resetChecklist = resetChecklistResponse.json as {
      status?: string;
      drivers?: unknown[];
    };
    assert.equal(resetChecklist.status, "NOT_COMPLETE");
    assert.equal((resetChecklist.drivers ?? []).length, 0);

    const addHotelResponse = await postJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/visa/hotels`,
      {
        city: "MAKKAH",
        hotelName: "Prisma Dynamic Makkah",
        agreementNumber: `${replacedCode}-H-01`,
        pax: 34,
        status: "WAITING",
        stayStart: addUtcDays(toIsoDateOnly(new Date()), 4),
        stayEnd: addUtcDays(toIsoDateOnly(new Date()), 6),
      },
    );
    assert.equal(addHotelResponse.status, 201, `Add visa hotel failed: ${addHotelResponse.text}`);
    const groupWithHotel = addHotelResponse.json as GroupPayload;
    const addedHotelId = groupWithHotel.visaSetup?.hotelAgreements?.[0]?.id ?? "";
    assert.notEqual(addedHotelId, "", "Expected created visa hotel agreement id.");

    const updateHotelResponse = await patchJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/visa/hotels/${encodeURIComponent(addedHotelId)}`,
      {
        city: "MAKKAH",
        hotelName: "Prisma Dynamic Makkah Updated",
        agreementNumber: `${replacedCode}-H-01`,
        pax: 34,
        status: "APPROVED",
        stayStart: addUtcDays(toIsoDateOnly(new Date()), 4),
        stayEnd: addUtcDays(toIsoDateOnly(new Date()), 6),
      },
    );
    assert.equal(
      updateHotelResponse.status,
      200,
      `Update visa hotel failed: ${updateHotelResponse.text}`,
    );
    const groupWithUpdatedHotel = updateHotelResponse.json as GroupPayload;
    assert.equal(groupWithUpdatedHotel.visaSetup?.hotelAgreements?.[0]?.status, "APPROVED");

    const removeHotelResponse = await requestJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/visa/hotels/${encodeURIComponent(addedHotelId)}`,
      {
        method: "DELETE",
      },
    );
    assert.equal(
      removeHotelResponse.status,
      200,
      `Remove visa hotel failed: ${removeHotelResponse.text}`,
    );

    const upsertRaudhahCreateResponse = await putJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/visa/raudhah`,
      {
        date: addUtcDays(toIsoDateOnly(new Date()), 5),
        status: "FREE",
        tasrehPrinted: false,
      },
    );
    assert.equal(
      upsertRaudhahCreateResponse.status,
      200,
      `Create raudhah appointment failed: ${upsertRaudhahCreateResponse.text}`,
    );
    assert.equal(
      (upsertRaudhahCreateResponse.json as GroupPayload).visaSetup?.raudhahAppointments?.[0]?.status,
      "FREE",
    );

    const upsertRaudhahUpdateResponse = await putJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}/visa/raudhah`,
      {
        date: addUtcDays(toIsoDateOnly(new Date()), 5),
        status: "BEFORE",
        tasrehPrinted: true,
      },
    );
    assert.equal(
      upsertRaudhahUpdateResponse.status,
      200,
      `Update raudhah appointment failed: ${upsertRaudhahUpdateResponse.text}`,
    );
    const raudhahAfterUpdate = (upsertRaudhahUpdateResponse.json as GroupPayload).visaSetup
      ?.raudhahAppointments?.[0];
    assert.equal(raudhahAfterUpdate?.status, "BEFORE");
    assert.equal(raudhahAfterUpdate?.tasrehPrinted, true);

    const deleteGroupResponse = await requestJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}`,
      { method: "DELETE" },
    );
    assert.equal(deleteGroupResponse.status, 204, `Delete group failed: ${deleteGroupResponse.text}`);

    const afterDeleteResponse = await requestJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(replacedCode)}`,
    );
    assert.equal(afterDeleteResponse.status, 404, "Deleted group should return 404.");
  } finally {
    activeAuthCookie = null;
    await cleanupGroupsByCode(createdCodes);
    await server.shutdown();
  }
}

async function testPrismaGroupsErrorFlow(): Promise<void> {
  const server = await startBackendServerWithPrisma();
  const createdCodes: string[] = [];
  const baseCode = buildUniqueCode("PRS-ERR");
  createdCodes.push(baseCode);

  try {
    await authenticateDevSession(server.baseUrl);

    const invalidDateCreateResponse = await postJson(server.baseUrl, "/api/groups", {
      ...createBaseGroupPayload(baseCode, "Prisma Error Group"),
      arrivalDate: "2026-05-10",
      returnDate: "2026-05-01",
    });
    assert.equal(invalidDateCreateResponse.status, 400, "Invalid travel date range should return 400.");

    const createResponse = await postJson(
      server.baseUrl,
      "/api/groups",
      createBaseGroupPayload(baseCode, "Prisma Error Group"),
    );
    assert.equal(createResponse.status, 201, `Create group failed: ${createResponse.text}`);

    const duplicateCreateResponse = await postJson(
      server.baseUrl,
      "/api/groups",
      createBaseGroupPayload(baseCode, "Prisma Error Group Duplicate"),
    );
    assert.equal(duplicateCreateResponse.status, 409, "Duplicate group code should return 409.");

    const duplicateSortOrderResponse = await postJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(baseCode)}/itinerary`,
      {
        sortOrder: 0,
        dateLabel: "4 Apr",
        yearLabel: "2026",
        category: "Transfer",
        categoryKey: "transfer",
        title: "Duplicate Sort Transfer",
        meta: "09:00 | Makkah -> Madinah",
        icon: "airport_shuttle",
        isoDate: "2026-04-04",
        time: "09:00",
        fromLocation: "Makkah Hotel",
        toLocation: "Madinah Hotel",
      },
    );
    assert.equal(duplicateSortOrderResponse.status, 409, "Duplicate itinerary sort order should return 409.");

    const invalidHotelSequenceResponse = await postJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(baseCode)}/visa/hotels`,
      {
        city: "MAKKAH",
        hotelName: "Invalid Date Sequence",
        agreementNumber: `${baseCode}-BAD-DATES`,
        pax: 10,
        status: "WAITING",
        stayStart: "2026-04-12",
        stayEnd: "2026-04-10",
      },
    );
    assert.equal(
      invalidHotelSequenceResponse.status,
      400,
      "Hotel stayEnd before stayStart should be blocked.",
    );

    const missingChecklistResetResponse = await postJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(baseCode)}/checklist/reset-driver`,
      {
        tripDate: "2026-04-15",
        scheduledTime: "20:00",
        activity: "Departure",
      },
    );
    assert.equal(
      missingChecklistResetResponse.status,
      404,
      "Reset on unknown checklist assignment should return 404.",
    );

    const deleteUnknownResponse = await requestJson(
      server.baseUrl,
      `/api/groups/${encodeURIComponent(`${baseCode}-UNKNOWN`)}`,
      { method: "DELETE" },
    );
    assert.equal(deleteUnknownResponse.status, 404, "Deleting unknown group should return 404.");
  } finally {
    activeAuthCookie = null;
    await cleanupGroupsByCode(createdCodes);
    await server.shutdown();
  }
}

async function main(): Promise<void> {
  await runCase("backend prisma groups main flow", testPrismaGroupsMainFlow);
  await runCase("backend prisma groups error flow", testPrismaGroupsErrorFlow);
}

void main()
  .catch((error: unknown) => {
    console.error("Backend Prisma groups integration test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
