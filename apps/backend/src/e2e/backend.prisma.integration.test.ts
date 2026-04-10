import "dotenv/config";
import "reflect-metadata";
import assert from "node:assert/strict";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import { AppModule } from "../app.module";

type StartedServer = {
  baseUrl: string;
  shutdown: () => Promise<void>;
};

const DEV_AUTH_IDENTIFIER = process.env.DEV_AUTH_IDENTIFIER?.trim() || "dev.superadmin";
const DEV_AUTH_PASSWORD =
  process.env.DEV_AUTH_SUPERADMIN_PASSWORD?.trim() || "DevSuperAdmin#2026";
const prisma = new PrismaClient();
let activeAuthCookie: string | null = null;

function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => {
    console.log(`PASS ${name}`);
  });
}

function restoreEnvVar(
  key: "PORT" | "DATA_SOURCE" | "DATABASE_URL",
  previousValue: string | undefined,
): void {
  if (previousValue === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = previousValue;
}

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(baseIsoDate: string, dayOffset: number): string {
  const nextDate = new Date(`${baseIsoDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
  return toIsoDateOnly(nextDate);
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

  const port = 4400 + Math.floor(Math.random() * 400);
  const baseUrl = `http://127.0.0.1:${port}`;
  const previousPort = process.env.PORT;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testDatabaseUrl) {
    process.env.DATABASE_URL = testDatabaseUrl;
  }
  process.env.PORT = String(port);
  process.env.DATA_SOURCE = "prisma";

  let app: INestApplication | null = null;

  try {
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

async function cleanupCreatedRecords(clientName: string): Promise<void> {
  await prisma.invoice.deleteMany({
    where: {
      client: {
        name: clientName,
      },
    },
  });

  await prisma.invoiceClient.deleteMany({
    where: {
      name: clientName,
    },
  });
}

async function cleanupCreatedRecordsByPrefix(clientNamePrefix: string): Promise<void> {
  await prisma.invoice.deleteMany({
    where: {
      client: {
        name: {
          startsWith: clientNamePrefix,
        },
      },
    },
  });

  await prisma.invoiceClient.deleteMany({
    where: {
      name: {
        startsWith: clientNamePrefix,
      },
    },
  });
}

async function testPrismaIntegrationFlow(): Promise<void> {
  const server = await startBackendServerWithPrisma();
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;
  const testClientName = `Prisma Integration Client ${uniqueSuffix}`;
  const todayIso = toIsoDateOnly(new Date());
  const dueDateIso = addUtcDays(todayIso, 7);
  let createdInvoiceId = "";

  try {
    const healthResponse = await requestJson(server.baseUrl, "/api/health");
    assert.equal(healthResponse.status, 200, `Health check failed: ${healthResponse.text}`);
    assert.equal(
      (healthResponse.json as { dataSource?: string }).dataSource,
      "prisma",
      `Expected prisma dataSource, got: ${healthResponse.text}`,
    );

    await authenticateDevSession(server.baseUrl);

    const createResponse = await requestJson(server.baseUrl, "/api/invoices", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        clientName: testClientName,
        issuedDate: todayIso,
        dueDate: dueDateIso,
        amount: 777000,
      }),
    });
    assert.equal(createResponse.status, 201, `Create invoice failed: ${createResponse.text}`);
    const createdInvoice = createResponse.json as {
      id?: string;
      clientId?: string;
      clientName?: string;
      amount?: number;
      status?: string;
    };
    assert.equal(typeof createdInvoice.id, "string", "Created invoice should include id.");
    assert.equal(typeof createdInvoice.clientId, "string", "Created invoice should include clientId.");
    assert.equal(createdInvoice.clientName, testClientName);
    assert.equal(createdInvoice.amount, 777000);
    assert.equal(createdInvoice.status, "Pending");
    createdInvoiceId = createdInvoice.id ?? "";

    const clientsResponse = await requestJson(server.baseUrl, "/api/invoices/clients");
    assert.equal(clientsResponse.status, 200, `List clients failed: ${clientsResponse.text}`);
    const clients = clientsResponse.json as Array<{ id?: string; name?: string; label?: string }>;
    assert.equal(Array.isArray(clients), true, "Client list payload should be an array.");
    const createdClient = clients.find((item) => item.name === testClientName);
    assert.equal(Boolean(createdClient), true, "Expected created client in /api/invoices/clients.");
    assert.equal(typeof createdClient?.label, "string", "Created client should include formatted label.");

    const updateResponse = await requestJson(server.baseUrl, `/api/invoices/${createdInvoiceId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        amount: 888000,
        status: "PAID",
      }),
    });
    assert.equal(updateResponse.status, 200, `Update invoice failed: ${updateResponse.text}`);
    const updatedInvoice = updateResponse.json as { amount?: number; status?: string };
    assert.equal(updatedInvoice.amount, 888000);
    assert.equal(updatedInvoice.status, "Paid");

    const listResponse = await requestJson(server.baseUrl, "/api/invoices");
    assert.equal(listResponse.status, 200, `List invoices failed: ${listResponse.text}`);
    const invoices = listResponse.json as Array<{ id?: string; amount?: number; status?: string }>;
    assert.equal(Array.isArray(invoices), true, "Invoice list payload should be an array.");
    const matched = invoices.find((invoice) => invoice.id === createdInvoiceId);
    assert.equal(Boolean(matched), true, "Expected created invoice in /api/invoices.");
    assert.equal(matched?.amount, 888000);
    assert.equal(matched?.status, "Paid");
  } finally {
    activeAuthCookie = null;
    await cleanupCreatedRecords(testClientName);
    await server.shutdown();
  }
}

async function testPrismaConcurrentInvoiceCreateFlow(): Promise<void> {
  const server = await startBackendServerWithPrisma();
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)
    .toString()
    .padStart(4, "0")}`;
  const testClientPrefix = `Prisma Concurrent Client ${uniqueSuffix}`;
  const totalRequests = 12;

  try {
    await authenticateDevSession(server.baseUrl);

    const createResponses: Array<{ status: number; json: unknown; text: string }> = [];
    for (let pairIndex = 0; pairIndex < totalRequests / 2; pairIndex += 1) {
      const leftIndex = pairIndex * 2;
      const rightIndex = leftIndex + 1;
      const pairResponses = await Promise.all([
        requestJson(server.baseUrl, "/api/invoices", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            clientName: `${testClientPrefix}-${leftIndex + 1}`,
            issuedDate: "2026-01-15",
            dueDate: `${2030 + leftIndex}-01-15`,
            amount: 500000 + leftIndex * 1000,
          }),
        }),
        requestJson(server.baseUrl, "/api/invoices", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            clientName: `${testClientPrefix}-${rightIndex + 1}`,
            issuedDate: "2026-01-15",
            dueDate: `${2030 + rightIndex}-01-15`,
            amount: 500000 + rightIndex * 1000,
          }),
        }),
      ]);

      createResponses.push(...pairResponses);
    }

    const failedResponses = createResponses.filter((response) => response.status !== 201);
    assert.equal(
      failedResponses.length,
      0,
      `Concurrent create should succeed for all requests: ${failedResponses.map((item) => item.text).join(" | ")}`,
    );

    const createdInvoices = createResponses.map(
      (response) =>
        response.json as {
          id?: string;
          invoiceNumber?: string;
          clientId?: string;
          clientName?: string;
          status?: string;
        },
    );
    assert.equal(createdInvoices.length, totalRequests);
    assert.equal(
      createdInvoices.every((invoice) => typeof invoice.id === "string"),
      true,
      "Every created invoice should include id.",
    );
    assert.equal(
      createdInvoices.every((invoice) => typeof invoice.invoiceNumber === "string"),
      true,
      "Every created invoice should include invoiceNumber.",
    );
    assert.equal(
      createdInvoices.every((invoice) => invoice.status === "Pending"),
      true,
      "Every concurrent invoice should start with Pending status.",
    );

    const invoiceNumbers = createdInvoices.map((invoice) => invoice.invoiceNumber ?? "");
    assert.equal(
      new Set(invoiceNumbers).size,
      totalRequests,
      "Concurrent create should still produce unique invoice numbers.",
    );

    const clientsResponse = await requestJson(server.baseUrl, "/api/invoices/clients");
    assert.equal(clientsResponse.status, 200, `List clients failed: ${clientsResponse.text}`);
    const clients = clientsResponse.json as Array<{
      id?: string;
      name?: string;
      sortOrder?: number;
      label?: string;
    }>;
    const createdClients = clients.filter((client) =>
      (client.name ?? "").startsWith(testClientPrefix),
    );
    assert.equal(
      createdClients.length,
      totalRequests,
      "Expected all concurrently-created clients to be persisted.",
    );
    assert.equal(
      createdClients.every((client) => typeof client.label === "string" && client.label.length > 0),
      true,
      "Concurrent clients should include display labels.",
    );

    const sortOrders = createdClients.map((client) => client.sortOrder ?? -1);
    assert.equal(
      new Set(sortOrders).size,
      totalRequests,
      "Concurrent client creation should keep unique sort orders.",
    );
  } finally {
    activeAuthCookie = null;
    await cleanupCreatedRecordsByPrefix(testClientPrefix);
    await server.shutdown();
  }
}

async function main(): Promise<void> {
  await runCase("backend prisma integration flow", testPrismaIntegrationFlow);
  await runCase(
    "backend prisma concurrent invoice create flow",
    testPrismaConcurrentInvoiceCreateFlow,
  );
}

void main()
  .catch((error: unknown) => {
    console.error("Backend Prisma integration test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
