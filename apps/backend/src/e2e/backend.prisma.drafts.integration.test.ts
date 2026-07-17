import "dotenv/config";
import "reflect-metadata";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient, AgreementCity, AgreementApprovalStatus } from "@prisma/client";

type StartedServer = {
  baseUrl: string;
  shutdown: () => Promise<void>;
};

type RequestResult = {
  status: number;
  json: any;
  text: string;
  headers: Headers;
};

const DEV_AUTH_IDENTIFIER = process.env.DEV_AUTH_IDENTIFIER?.trim() || "dev.superadmin";
const DEV_AUTH_PASSWORD = process.env.DEV_AUTH_SUPERADMIN_PASSWORD?.trim() || "DevSuperAdmin#2026";
const prisma = new PrismaClient();
let activeAuthCookie: string | null = null;

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

  const port = 4900 + Math.floor(Math.random() * 200);
  const baseUrl = `http://127.0.0.1:${port}`;
  const previousPort = process.env.PORT;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousBootstrapDefaultUsers = process.env.AUTH_BOOTSTRAP_DEFAULT_USERS;
  const previousDevSuperAdminPassword = process.env.DEV_AUTH_SUPERADMIN_PASSWORD;

  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
  }
  process.env.PORT = String(port);
  process.env.DATA_SOURCE = "prisma";
  process.env.AUTH_BOOTSTRAP_DEFAULT_USERS = "true";
  process.env.DEV_AUTH_SUPERADMIN_PASSWORD = DEV_AUTH_PASSWORD;

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
    },
  };
}

async function requestJson(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<RequestResult> {
  const headers = new Headers(init?.headers);
  const method = init?.method?.trim().toUpperCase() ?? "GET";
  if (activeAuthCookie && !headers.has("cookie")) {
    headers.set("cookie", activeAuthCookie);
  }
  if (activeAuthCookie && method !== "GET" && method !== "HEAD" && !headers.has("origin")) {
    headers.set("origin", baseUrl);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();

  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
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

  if (loginResponse.status !== 200) {
    throw new Error(`Auth login failed: ${loginResponse.text}`);
  }

  const setCookie = loginResponse.headers.get("set-cookie") ?? "";
  const cookieHeader = setCookie.split(";")[0]?.trim() ?? "";
  if (!cookieHeader) {
    throw new Error("Auth login should return a session cookie.");
  }
  activeAuthCookie = cookieHeader;
}

async function cleanupOwnedDraftFixtures(): Promise<void> {
  await prisma.visaHotelAgreement.deleteMany({
    where: {
      visaSetup: {
        group: { code: { startsWith: "GRP-DRAFT-" } },
      },
    },
  });
  await prisma.group.deleteMany({
    where: { code: { startsWith: "GRP-DRAFT-" } },
  });
  await prisma.hotelAgreementDraft.deleteMany({
    where: {
      OR: [
        { agreementNumber: { startsWith: "AGR-E2E-" } },
        { agreementNumber: { startsWith: "AGR-ASSIGN-" } },
      ],
    },
  });
}

describe("backend prisma hotel agreement drafts integration tests", () => {
  let server: StartedServer;

  beforeAll(async () => {
    await cleanupOwnedDraftFixtures();
    server = await startBackendServerWithPrisma();
    await authenticateDevSession(server.baseUrl);
  });

  afterEach(async () => {
    await cleanupOwnedDraftFixtures();
  });

  afterAll(async () => {
    activeAuthCookie = null;
    await server.shutdown();
    await prisma.$disconnect();
  });

  it("should perform hotel agreement draft CRUD", async () => {
    const agreementNumber = `AGR-E2E-${Date.now()}`;
    const payload = {
      city: "MAKKAH",
      hotelName: "Swissotel E2E",
      agreementNumber: agreementNumber,
      pax: 50,
      stayStart: "2026-08-01",
      stayEnd: "2026-08-05",
      notes: "E2E test draft notes",
    };

    // Create
    const createRes = await requestJson(server.baseUrl, "/api/visa/agreement-drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(createRes.status).toBe(201);
    expect(createRes.json.agreementNumber).toBe(agreementNumber);
    expect(createRes.json.remainingPax).toBe(50);
    const draftId = createRes.json.id;

    // Read (findAll)
    const listRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts?query=${agreementNumber}`);
    expect(listRes.status).toBe(200);
    expect(listRes.json).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draftId, agreementNumber })]),
    );

    // Update
    const patchRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        pax: 60,
        hotelName: "Swissotel E2E Updated",
      }),
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.json.pax).toBe(60);
    expect(patchRes.json.hotelName).toBe("Swissotel E2E Updated");

    // Delete
    const deleteRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts/${draftId}`, {
      method: "DELETE",
    });
    expect(deleteRes.status).toBe(204);

    // Verify deletion
    const verifyRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts?query=${agreementNumber}`);
    expect(verifyRes.json).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draftId })]),
    );
  });

  it("should perform hotel agreement draft assignment and unassignment", async () => {
    // 1. Create a group
    const uniqueGroupCode = `GRP-DRAFT-${Date.now()}`;
    const groupPayload = {
      code: uniqueGroupCode,
      name: "E2E Draft Group",
      status: "Active",
      arrivalDate: "2026-08-01",
      returnDate: "2026-08-08",
      tone: "ACTIVE",
      pax: 30,
      packageName: "Prisma Integration Package",
      durationDays: 8,
      timeline: [],
      itinerary: [],
    };
    const createGroupRes = await requestJson(server.baseUrl, "/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(groupPayload),
    });
    expect(createGroupRes.status).toBe(201);

    // 2. Create a draft agreement
    const agreementNumber = `AGR-ASSIGN-${Date.now()}`;
    const draftPayload = {
      city: "MAKKAH",
      hotelName: "Swissotel Assign E2E",
      agreementNumber: agreementNumber,
      pax: 40, // Capacity is 40
      stayStart: "2026-08-01",
      stayEnd: "2026-08-05",
    };
    const createDraftRes = await requestJson(server.baseUrl, "/api/visa/agreement-drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draftPayload),
    });
    expect(createDraftRes.status).toBe(201);
    const draftId = createDraftRes.json.id;

    // 3. Assign draft to group (Group pax is 30, draft capacity is 40. Remaining capacity should become 10)
    const assignRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts/${draftId}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupCode: uniqueGroupCode }),
    });
    expect(assignRes.status).toBe(201);
    expect(assignRes.json.remainingPax).toBe(10);
    expect(assignRes.json.assignedGroups).toEqual(
      expect.arrayContaining([expect.objectContaining({ groupCode: uniqueGroupCode, pax: 30 })]),
    );

    // 4. Verify group got the visa hotel agreement assigned
    const groupRes = await requestJson(server.baseUrl, `/api/groups/${uniqueGroupCode}`);
    expect(groupRes.status).toBe(200);
    const agreements = groupRes.json.visaSetup?.hotelAgreements ?? [];
    expect(agreements).toHaveLength(1);
    expect(agreements[0].agreementNumber).toBe(agreementNumber);
    expect(agreements[0].pax).toBe(30);

    // 5. Test validation failure: Assigning to the same group should throw ConflictException (409)
    const assignAgainRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts/${draftId}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupCode: uniqueGroupCode }),
    });
    expect(assignAgainRes.status).toBe(409);

    // 6. Test database constraint: Try to assign a WAITING draft older than 24 hours
    // We update the updatedAt manually using Prisma client to be 2 days ago
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await prisma.hotelAgreementDraft.update({
      where: { id: draftId },
      data: { updatedAt: twoDaysAgo },
    });

    // Create another group to assign
    const secondGroupCode = `GRP-DRAFT-2-${Date.now()}`;
    await requestJson(server.baseUrl, "/api/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...groupPayload,
        code: secondGroupCode,
        pax: 5,
      }),
    });

    // Assigning old draft should reject it (cutoff 24h WAITING check) and mark it REJECTED
    const assignOldRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts/${draftId}/assign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupCode: secondGroupCode }),
    });
    expect(assignOldRes.status).toBe(400);
    expect(assignOldRes.json.message).toMatch(/24 jam/u);
    await expect(prisma.hotelAgreementDraft.findUnique({ where: { id: draftId } }))
      .resolves.toMatchObject({ status: "REJECTED" });

    // 7. Unassign draft from the group
    const unassignRes = await requestJson(server.baseUrl, `/api/visa/agreement-drafts/${draftId}/unassign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ groupCode: uniqueGroupCode }),
    });
    expect(unassignRes.status).toBe(201);
    expect(unassignRes.json.assignedGroups).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ groupCode: uniqueGroupCode })]),
    );

  });
});
