import assert from "node:assert/strict";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { InvoicesService } from "./invoices.service";

type InvoiceListItem = Awaited<ReturnType<InvoicesService["findAll"]>>[number];
type InvoiceClient = Awaited<ReturnType<InvoicesService["listClients"]>>[number];

function createMemoryInvoicesService(): { service: InvoicesService; restore: () => void } {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "memory";
  const service = new InvoicesService({} as PrismaService);

  return {
    service,
    restore: () => {
      if (previousDataSource === undefined) {
        delete process.env.DATA_SOURCE;
      } else {
        process.env.DATA_SOURCE = previousDataSource;
      }
    },
  };
}

function createPrismaInvoicesService(prismaMock: PrismaService): { service: InvoicesService; restore: () => void } {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "prisma";
  const service = new InvoicesService(prismaMock);

  return {
    service,
    restore: () => {
      if (previousDataSource === undefined) {
        delete process.env.DATA_SOURCE;
      } else {
        process.env.DATA_SOURCE = previousDataSource;
      }
    },
  };
}

function createPrismaKnownRequestError(code: string, message = `prisma error ${code}`): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: code as Prisma.PrismaClientKnownRequestError["code"],
    clientVersion: "unit-test",
  });
}

function withPrismaTransactionMocks<T extends Record<string, any>>(
  mock: T,
  onExecuteRaw?: () => void,
): any {
  const executeRaw = async (..._args: unknown[]): Promise<number> => {
    onExecuteRaw?.();
    return 1;
  };

  let lastUpdatedRecord: any = null;

  const enhancedMock = {
    ...mock,
    invoice: {
      updateMany: async (args: any) => {
        if (typeof mock.invoice?.update === "function") {
          lastUpdatedRecord = await mock.invoice.update(args);
        }
        return { count: 1 };
      },
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
      ...mock.invoice,
      findUnique: async (args: any) => {
        if (lastUpdatedRecord !== null) {
          return lastUpdatedRecord;
        }
        if (typeof mock.invoice?.findUnique === "function") {
          return mock.invoice.findUnique(args);
        }
        return null;
      },
    },
    invoiceItem: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async () => ({ count: 0 }),
      ...mock.invoiceItem,
    },
  };

  return {
    ...enhancedMock,
    $executeRaw: executeRaw,
    $transaction: async <R>(
      callback: (tx: any) => Promise<R>,
    ): Promise<R> =>
      callback({
        ...enhancedMock,
        $executeRaw: executeRaw,
      }),
  };
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

function findClientByName(clients: InvoiceClient[], name: string): InvoiceClient {
  const matched = clients.find((entry) => entry.name === name);
  assert.ok(matched, `Expected client '${name}' to exist.`);
  return matched;
}

function assertInvoiceNumberPattern(invoiceNumber: string, year: string, serial: string): void {
  assert.equal(invoiceNumber, `GTT/INV/${year}/${serial}`);
}

async function testListClientsReturnsSeededSortedLabels(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    const clients = await service.listClients();
    assert.equal(clients.length, 3);
    assert.deepEqual(
      clients.map((entry) => entry.name),
      ["Yassir", "Haris", "JSA"],
    );
    assert.deepEqual(
      clients.map((entry) => entry.label),
      ["01. Yassir", "02. Haris", "03. JSA"],
    );

    const yassir = findClientByName(clients, "Yassir");
    assert.equal(yassir.groupCode, "9017000001");
    assert.equal(yassir.groupName, "Dummy Trip Lengkap");
  } finally {
    restore();
  }
}

async function testCreateUsesExistingClientAndGeneratesSequentialNumbers(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    const clients = await service.listClients();
    const yassir = findClientByName(clients, "Yassir");

    const createdOne = await service.create({
      clientId: yassir.id,
      issuedDate: "2099-01-01",
      dueDate: "2099-02-01",
      amount: 1_500_000.4,
    });
    assertInvoiceNumberPattern(createdOne.invoiceNumber, "2099", "0001");
    assert.equal(createdOne.clientName, "Yassir");
    assert.equal(createdOne.clientInitials, "Y");
    assert.equal(createdOne.status, "Pending");
    assert.equal(createdOne.amount, 1_500_000);
    assert.equal(createdOne.downPaymentIdr, 0);
    assert.equal(createdOne.groupCode, "9017000001");
    assert.equal(createdOne.monthKey, "2099-02");

    const createdTwo = await service.create({
      clientId: yassir.id,
      issuedDate: "2099-01-03",
      dueDate: "2099-02-01",
      amount: 250_100,
    });
    assertInvoiceNumberPattern(createdTwo.invoiceNumber, "2099", "0002");

    const listed = await service.findAll();
    assert.equal(listed.length, 2);
    assert.equal(listed[0].invoiceNumber, "GTT/INV/2099/0002");
    assert.equal(listed[1].invoiceNumber, "GTT/INV/2099/0001");
  } finally {
    restore();
  }
}

async function testCreateCanCreateNewClientAndResolvesStatusRules(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    const createdOverdue = await service.create({
      clientName: "Manual New Client",
      issuedDate: "1999-12-20",
      dueDate: "2000-01-01",
      amount: 123_450,
    });
    assert.equal(createdOverdue.clientName, "Manual New Client");
    assert.equal(createdOverdue.clientLabel, "04. Manual New Client");
    assert.equal(createdOverdue.status, "Overdue");

    const createdCancelled = await service.create({
      clientName: "Another Manual Client",
      issuedDate: "2099-01-10",
      dueDate: "2099-01-20",
      amount: 999_999,
      status: InvoiceStatus.CANCELLED,
    });
    assert.equal(createdCancelled.clientLabel, "05. Another Manual Client");
    assert.equal(createdCancelled.status, "Cancelled");
    assert.equal(createdCancelled.amount, 999_999);

    const clients = await service.listClients();
    assert.equal(clients.length, 5);
    assert.equal(clients[3].name, "Manual New Client");
    assert.equal(clients[4].name, "Another Manual Client");
  } finally {
    restore();
  }
}

async function testCreateReusesExistingClientCaseInsensitively(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    const created = await service.create({
      clientName: "  yAsSiR  ",
      issuedDate: "2099-08-01",
      dueDate: "2099-08-10",
      amount: 200_000,
    });

    assert.equal(created.clientName, "Yassir");
    assert.equal(created.clientLabel, "01. Yassir");

    const clients = await service.listClients();
    assert.equal(clients.length, 3);
  } finally {
    restore();
  }
}

async function testCreateAndUpdatePersistInvoiceItems(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    const created = await service.create({
      clientName: "Item Persistence Client",
      issuedDate: "2099-06-01",
      dueDate: "2099-06-10",
      amount: 750_000,
      downPaymentIdr: 300_000,
      items: [
        {
          description: "Umrah Package",
          pax: 2,
          currency: "USD",
          unitPrice: 1_250,
          totalPrice: 2_500,
          totalPriceIdr: 39_500_000,
        },
        {
          description: "Airport Transfer",
          pax: 1,
          currency: "IDR",
          unitPrice: 250_000,
          totalPrice: 250_000,
          totalPriceIdr: 250_000,
        },
      ],
    });
    assert.equal(created.items?.length, 2);
    assert.equal(created.items?.[0].description, "Umrah Package");
    assert.equal(created.items?.[1].currency, "IDR");
    assert.equal(created.amount, 39_750_000);
    assert.equal(created.downPaymentIdr, 300_000);

    const updated = await service.update(created.id, {
      version: 0,
      downPaymentIdr: 120_000,
      items: [
        {
          description: "Updated Package",
          pax: 3,
          currency: "SAR",
          unitPrice: 1_500,
          totalPrice: 4_500,
          totalPriceIdr: 18_000_000,
        },
      ],
    });
    assert.equal(updated.items?.length, 1);
    assert.equal(updated.items?.[0].description, "Updated Package");
    assert.equal(updated.amount, 18_000_000);
    assert.equal(updated.downPaymentIdr, 120_000);

    const manuallyAdjusted = await service.update(created.id, {
      version: 0,
      amount: 8_880_000,
      downPaymentIdr: 120_000,
      status: InvoiceStatus.PAID,
    });
    assert.equal(manuallyAdjusted.amount, 8_880_000);
    assert.equal(manuallyAdjusted.downPaymentIdr, 120_000);
    assert.equal(manuallyAdjusted.items?.length, 1);

    const listed = await service.findAll();
    assert.equal(listed[0].items?.length, 1);
    assert.equal(listed[0].items?.[0].currency, "SAR");
    assert.equal(listed[0].amount, 8_880_000);
    assert.equal(listed[0].downPaymentIdr, 120_000);
  } finally {
    restore();
  }
}

async function testCreateValidationErrors(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    await assert.rejects(
      () =>
        service.create({
          issuedDate: "2099-01-01",
          dueDate: "2099-01-02",
          amount: 1000,
        } as any),
      (error: unknown) => {
        assert.equal(error instanceof BadRequestException, true);
        assert.match((error as Error).message, /Either clientId or clientName is required/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        service.create({
          clientName: "Invalid Date Client",
          issuedDate: "not-a-date",
          dueDate: "2099-01-02",
          amount: 1000,
        }),
      (error: unknown) => {
        assert.equal(error instanceof BadRequestException, true);
        assert.match((error as Error).message, /Invalid issuedDate value/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        service.create({
          clientId: "missing-client-id",
          issuedDate: "2099-01-01",
          dueDate: "2099-01-02",
          amount: 1000,
        }),
      (error: unknown) => {
        assert.equal(error instanceof NotFoundException, true);
        assert.match((error as Error).message, /Invoice client 'missing-client-id' not found/i);
        return true;
      },
    );
  } finally {
    restore();
  }
}

async function testUpdateSupportsClientSwitchStatusAndGroupRules(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    const created = await service.create({
      clientName: "Update Target Client",
      issuedDate: "2099-03-01",
      dueDate: "2099-03-10",
      amount: 1_000_000,
      groupCode: "grp-001",
      notes: "Initial invoice",
    });

    const cancelled = await service.update(created.id, {
      version: 0,
      amount: 2_500_000,
      status: InvoiceStatus.CANCELLED,
      notes: "Cancelled by operator",
    });
    assert.equal(cancelled.status, "Cancelled");
    assert.equal(cancelled.amount, 2_500_000);
    assert.equal(cancelled.groupCode, "GRP-001");

    const switched = await service.update(created.id, {
      version: 1,
      clientName: "Switched Client",
      dueDate: "2099-03-20",
      groupCode: "  ",
      status: InvoiceStatus.PENDING,
      amount: 2_500_000,
      notes: "Reopened",
    });
    assert.equal(switched.clientName, "Switched Client");
    assert.equal(switched.clientLabel, "05. Switched Client");
    assert.equal(switched.status, "Pending");
    assert.equal(switched.amount, 2_500_000);
    assert.equal(switched.groupCode, undefined);
    assert.equal(switched.groupName, undefined);
  } finally {
    restore();
  }
}

async function testUpdateValidationErrors(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    await assert.rejects(
      () => service.update("missing-invoice-id", { version: 0, notes: "noop" }),
      (error: unknown) => {
        assert.equal(error instanceof NotFoundException, true);
        assert.match((error as Error).message, /Invoice 'missing-invoice-id' not found/i);
        return true;
      },
    );

    const created = await service.create({
      clientName: "Client To Update",
      issuedDate: "2099-05-01",
      dueDate: "2099-05-03",
      amount: 450_000,
    });

    await assert.rejects(
      () =>
        service.update(created.id, {
          version: 0,
          clientId: "missing-client-id",
        }),
      (error: unknown) => {
        assert.equal(error instanceof NotFoundException, true);
        assert.match((error as Error).message, /Invoice client 'missing-client-id' not found/i);
        return true;
      },
    );
  } finally {
    restore();
  }
}

async function testFindAllThrowsWhenInvoiceClientIsMissing(): Promise<void> {
  const { service, restore } = createMemoryInvoicesService();
  try {
    const seededClients = await service.listClients();
    const yassir = findClientByName(seededClients, "Yassir");
    const created = (await service.create({
      clientId: yassir.id,
      issuedDate: "2099-07-01",
      dueDate: "2099-07-02",
      amount: 100_000,
    })) as InvoiceListItem;

    const mutableService = service as unknown as {
      memoryInvoiceClients: Array<{ id: string }>;
      memoryInvoices: Array<{ id: string; clientId: string }>;
    };
    mutableService.memoryInvoiceClients.splice(
      mutableService.memoryInvoiceClients.findIndex((entry) => entry.id === yassir.id),
      1,
    );

    await assert.rejects(
      () => service.findAll(),
      (error: unknown) => {
        assert.equal(error instanceof NotFoundException, true);
        assert.match((error as Error).message, new RegExp(`Invoice client '${created.clientId}' not found`, "i"));
        return true;
      },
    );
  } finally {
    restore();
  }
}

async function testPrismaListAndFindAllMapping(): Promise<void> {
  const prismaMock = {
    invoiceClient: {
      findMany: async () => [
        {
          id: "cli-2",
          name: "Beta Client",
          sortOrder: 2,
          group: null,
        },
        {
          id: "cli-1",
          name: "Alpha Client",
          sortOrder: 1,
          group: {
            code: "G-100",
            name: "Alpha Group",
          },
        },
      ],
    },
    invoice: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [
        {
          id: "inv-1",
          invoiceNumber: "GTT/INV/2099/0001",
          clientId: "cli-1",
          client: {
            name: "Alpha Client",
            sortOrder: 1,
          },
          group: {
            code: "G-100",
            name: "Alpha Group",
          },
          issuedDate: new Date("2099-01-01T00:00:00.000Z"),
          dueDate: new Date("2099-01-10T00:00:00.000Z"),
          amount: 125_500,
          downPaymentIdr: 50_000,
          status: InvoiceStatus.PENDING,
          items: [
            {
              description: "Alpha Package",
              pax: 2,
              currency: "IDR",
              unitPrice: 62_750,
              totalPrice: 125_500,
              totalPriceIdr: 125_500,
            },
          ],
        },
        {
          id: "inv-2",
          invoiceNumber: "GTT/INV/2099/0002",
          clientId: "cli-2",
          client: {
            name: "Beta Client",
            sortOrder: 2,
          },
          group: null,
          issuedDate: new Date("2099-01-02T00:00:00.000Z"),
          dueDate: new Date("2099-01-11T00:00:00.000Z"),
          amount: 900_000,
          status: InvoiceStatus.CANCELLED,
          items: [],
        },
      ],
    },
  } as unknown as PrismaService;

  const { service, restore } = createPrismaInvoicesService(prismaMock);
  try {
    const clients = await service.listClients();
    assert.equal(clients.length, 2);
    assert.equal(clients[0].label, "02. Beta Client");
    assert.equal(clients[1].label, "01. Alpha Client");
    assert.equal(clients[1].groupCode, "G-100");

    const invoices = await service.findAll();
    assert.equal(invoices.length, 2);
    assert.equal(invoices[0].status, "Partially Paid");
    assert.equal(invoices[0].clientInitials, "AC");
    assert.equal(invoices[0].items?.length, 1);
    assert.equal(invoices[0].downPaymentIdr, 50_000);
    assert.equal(invoices[1].status, "Cancelled");
    assert.equal(invoices[1].amount, 900_000);
    assert.equal(invoices[1].items, undefined);
  } finally {
    restore();
  }
}

async function testPrismaListClientsAllowsDuplicateSortOrder(): Promise<void> {
  let findManyArgs: Record<string, unknown> | null = null;
  const prismaMock = {
    invoiceClient: {
      findMany: async (args: Record<string, unknown>) => {
        findManyArgs = args;
        return [
          {
            id: "cli-earlier",
            name: "Earlier Client",
            sortOrder: 4,
            group: null,
          },
          {
            id: "cli-later",
            name: "Later Client",
            sortOrder: 4,
            group: null,
          },
        ];
      },
    },
  } as unknown as PrismaService;

  const { service, restore } = createPrismaInvoicesService(prismaMock);
  try {
    const clients = await service.listClients();
    const orderBy = (findManyArgs as Record<string, unknown> | null)?.orderBy;
    assert.deepEqual(orderBy, [{ sortOrder: "asc" }, { createdAt: "asc" }]);
    assert.equal(clients.length, 2);
    assert.deepEqual(
      clients.map((client) => client.label),
      ["04. Earlier Client", "04. Later Client"],
    );
  } finally {
    restore();
  }
}

async function testPrismaFindAllPrefersInlineDownPaymentColumn(): Promise<void> {
  let rawReadCalls = 0;
  let rawWriteCalls = 0;
  const prismaMock = {
    invoiceClient: {
      findMany: async () => [],
    },
    invoice: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [
        {
          id: "inv-inline",
          invoiceNumber: "GTT/INV/2099/0099",
          clientId: "cli-inline",
          client: {
            name: "Inline Client",
            sortOrder: 9,
          },
          group: null,
          issuedDate: new Date("2099-03-01T00:00:00.000Z"),
          dueDate: new Date("2099-03-10T00:00:00.000Z"),
          amount: 880_000,
          downPaymentIdr: 125_000,
          status: InvoiceStatus.PENDING,
          items: [],
        },
      ],
    },
    $queryRaw: async () => {
      rawReadCalls += 1;
      return [];
    },
    $executeRaw: async () => {
      rawWriteCalls += 1;
      return 0;
    },
  } as unknown as PrismaService;

  const { service, restore } = createPrismaInvoicesService(prismaMock);
  try {
    (service as unknown as { prismaInvoiceDownPaymentColumnState: boolean | null }).prismaInvoiceDownPaymentColumnState =
      true;

    const invoices = await service.findAll();
    assert.equal(invoices.length, 1);
    assert.equal(invoices[0].downPaymentIdr, 125_000);
    assert.equal(rawReadCalls, 0);
    assert.equal(rawWriteCalls, 0);
  } finally {
    restore();
  }
}

async function testPrismaCreateSupportsRetryAndFallbackSerialResolution(): Promise<void> {
  let createAttempt = 0;
  const createdPayloads: Array<Record<string, unknown>> = [];
  const prismaMock = withPrismaTransactionMocks({
    invoiceClient: {
      findFirst: async () => ({
        id: "cli-200",
        groupId: null,
      }),
    },
    group: {
      findUnique: async () => null,
    },
    invoice: {
      findFirst: async () => ({
        invoiceNumber: "GTT/INV/2099/INVALID",
      }),
      findMany: async () => [
        {
          invoiceNumber: "GTT/INV/2099/0002",
        },
        {
          invoiceNumber: "GTT/INV/2099/0010",
        },
      ],
      create: async (args: Record<string, unknown>) => {
        createAttempt += 1;
        createdPayloads.push(args);
        if (createAttempt === 1) {
          throw createPrismaKnownRequestError("P2002", "duplicate invoice number");
        }

        const data = args.data as {
          invoiceNumber: string;
          clientId: string;
          groupId: string | null;
          issuedDate: Date;
          dueDate: Date;
          amount: number;
          status: InvoiceStatus;
          notes: string | null;
        };

        return {
          id: "inv-created",
          invoiceNumber: data.invoiceNumber,
          clientId: data.clientId,
          client: {
            name: "Retry Client",
            sortOrder: 3,
          },
          group: null,
          issuedDate: data.issuedDate,
          dueDate: data.dueDate,
          amount: data.amount,
          status: data.status,
          notes: data.notes,
        };
      },
    },
  }) as unknown as PrismaService;

  const { service, restore } = createPrismaInvoicesService(prismaMock);
  try {
    const created = await service.create({
      clientName: "Retry Client",
      issuedDate: "2099-03-01",
      dueDate: "2099-03-20",
      amount: 890_000,
      notes: "Create with retry",
    });

    assert.equal(created.invoiceNumber, "GTT/INV/2099/0011");
    assert.equal(created.clientName, "Retry Client");
    assert.equal(created.status, "Pending");
    assert.equal(createAttempt, 2);
    assert.equal(
      (createdPayloads[1].data as { invoiceNumber: string }).invoiceNumber,
      "GTT/INV/2099/0011",
    );
  } finally {
    restore();
  }
}

async function testPrismaCreateReusesClientFoundInsideLockedTransaction(): Promise<void> {
  let clientLookupCount = 0;
  let aggregateCalls = 0;
  let clientCreateCalls = 0;
  let lockQueryCount = 0;

  const prismaMock = withPrismaTransactionMocks(
    {
      invoiceClient: {
        findFirst: async () => {
          clientLookupCount += 1;
          if (clientLookupCount === 1) {
            return null;
          }

          return {
            id: "cli-existing",
            groupId: "grp-existing",
          };
        },
        aggregate: async () => {
          aggregateCalls += 1;
          return {
            _max: {
              sortOrder: 7,
            },
          };
        },
        create: async () => {
          clientCreateCalls += 1;
          return {
            id: "cli-created",
            groupId: null,
          };
        },
      },
      group: {
        findUnique: async () => null,
      },
      invoice: {
        findFirst: async () => ({
          invoiceNumber: "GTT/INV/2099/0009",
        }),
        create: async (args: Record<string, unknown>) => {
          const data = args.data as {
            invoiceNumber: string;
            clientId: string;
            groupId: string | null;
            issuedDate: Date;
            dueDate: Date;
            amount: number;
            status: InvoiceStatus;
            notes: string | null;
          };

          assert.equal(data.clientId, "cli-existing");

          return {
            id: "inv-locked-existing",
            invoiceNumber: data.invoiceNumber,
            clientId: data.clientId,
            client: {
              name: "Locked Existing Client",
              sortOrder: 4,
            },
            group: null,
            issuedDate: data.issuedDate,
            dueDate: data.dueDate,
            amount: data.amount,
            status: data.status,
            notes: data.notes,
          };
        },
      },
    },
    () => {
      lockQueryCount += 1;
    },
  ) as unknown as PrismaService;

  const { service, restore } = createPrismaInvoicesService(prismaMock);
  try {
    const created = await service.create({
      clientName: "Locked Existing Client",
      issuedDate: "2099-05-01",
      dueDate: "2099-05-20",
      amount: 450_000,
    });

    assert.equal(created.clientName, "Locked Existing Client");
    assert.equal(created.clientId, "cli-existing");
    assert.equal(created.invoiceNumber, "GTT/INV/2099/0010");
    assert.equal(clientLookupCount, 2);
    assert.equal(aggregateCalls, 0);
    assert.equal(clientCreateCalls, 0);
    assert.equal(lockQueryCount, 2);
  } finally {
    restore();
  }
}

async function testPrismaClientLookupIsCaseInsensitive(): Promise<void> {
  let clientLookupCount = 0;
  let lastClientLookupArgs: Record<string, unknown> | null = null;

  const prismaMock = withPrismaTransactionMocks({
    invoiceClient: {
      findFirst: async (args: Record<string, unknown>) => {
        clientLookupCount += 1;
        lastClientLookupArgs = args;
        return {
          id: "cli-existing",
          groupId: null,
        };
      },
    },
    group: {
      findUnique: async () => null,
    },
    invoice: {
      findFirst: async () => ({
        invoiceNumber: "GTT/INV/2099/0009",
      }),
      create: async (args: Record<string, unknown>) => {
        const data = args.data as {
          invoiceNumber: string;
          clientId: string;
          issuedDate: Date;
          dueDate: Date;
          amount: number;
          status: InvoiceStatus;
          notes: string | null;
        };

        return {
          id: "inv-ci-existing",
          invoiceNumber: data.invoiceNumber,
          clientId: data.clientId,
          client: {
            name: "Existing Client",
            sortOrder: 6,
          },
          group: null,
          issuedDate: data.issuedDate,
          dueDate: data.dueDate,
          amount: data.amount,
          status: data.status,
          notes: data.notes,
        };
      },
    },
  }) as unknown as PrismaService;

  const { service, restore } = createPrismaInvoicesService(prismaMock);
  try {
    const created = await service.create({
      clientName: "  existing CLIENT ",
      issuedDate: "2099-09-01",
      dueDate: "2099-09-15",
      amount: 510_000,
    });

    assert.equal(created.clientId, "cli-existing");
    assert.equal(clientLookupCount >= 1, true);
    const lookupWhere = lastClientLookupArgs as { where?: { name?: { equals?: string; mode?: string } } } | null;
    assert.deepEqual(
      lookupWhere?.where?.name,
      {
        equals: "existing CLIENT",
        mode: "insensitive",
      },
    );
  } finally {
    restore();
  }
}

async function testPrismaCreateErrorMappings(): Promise<void> {
  const prismaMockUnknownGroup = {
    invoiceClient: {
      findUnique: async () => ({
        id: "cli-1",
        groupId: null,
      }),
    },
    group: {
      findUnique: async () => null,
    },
    invoice: {
      findFirst: async () => null,
      create: async () => {
        throw new Error("should not be called when group is missing");
      },
    },
  } as unknown as PrismaService;

  const prismaMockPersistentP2002 = withPrismaTransactionMocks({
    invoiceClient: {
      findUnique: async () => ({
        id: "cli-1",
        groupId: null,
      }),
    },
    group: {
      findUnique: async () => ({
        id: "grp-1",
      }),
    },
    invoice: {
      findFirst: async () => null,
      create: async () => {
        throw createPrismaKnownRequestError("P2002", "duplicate invoice number");
      },
    },
  }) as unknown as PrismaService;

  const prismaMockEnumMismatch = withPrismaTransactionMocks({
    invoiceClient: {
      findUnique: async () => ({
        id: "cli-1",
        groupId: null,
      }),
    },
    group: {
      findUnique: async () => ({
        id: "grp-1",
      }),
    },
    invoice: {
      findFirst: async () => null,
      create: async () => {
        throw new Error('invalid input value for enum "InvoiceStatus"');
      },
    },
  }) as unknown as PrismaService;

  {
    const { service, restore } = createPrismaInvoicesService(prismaMockUnknownGroup);
    try {
      await assert.rejects(
        () =>
          service.create({
            clientId: "cli-1",
            groupCode: "UNKNOWN",
            issuedDate: "2099-01-01",
            dueDate: "2099-01-10",
            amount: 100_000,
          }),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /Group 'UNKNOWN' not found/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }

  {
    const { service, restore } = createPrismaInvoicesService(prismaMockPersistentP2002);
    try {
      await assert.rejects(
        () =>
          service.create({
            clientId: "cli-1",
            groupCode: "GRP-1",
            issuedDate: "2099-01-01",
            dueDate: "2099-01-10",
            amount: 100_000,
          }),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /Failed to generate a unique invoice number/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }

  {
    const { service, restore } = createPrismaInvoicesService(prismaMockEnumMismatch);
    try {
      await assert.rejects(
        () =>
          service.create({
            clientId: "cli-1",
            groupCode: "GRP-1",
            issuedDate: "2099-01-01",
            dueDate: "2099-01-10",
            amount: 100_000,
            status: InvoiceStatus.CANCELLED,
          }),
        (error: unknown) => {
          assert.equal(error instanceof BadRequestException, true);
          assert.match((error as Error).message, /CANCELLED belum tersedia di database/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }
}

async function testPrismaUpdateSuccessAndErrorMappings(): Promise<void> {
  const updateCalls: Array<Record<string, unknown>> = [];
  const prismaMockSuccess = withPrismaTransactionMocks({
    invoice: {
      findUnique: async () => ({
        id: "inv-100",
        clientId: "cli-old",
        groupId: null,
        issuedDate: new Date("2099-04-01T00:00:00.000Z"),
        dueDate: new Date("2099-04-05T00:00:00.000Z"),
        amount: 990_000,
        status: InvoiceStatus.PENDING,
        notes: "old-note",
      }),
      update: async (args: Record<string, unknown>) => {
        updateCalls.push(args);
        return {
          id: "inv-100",
          invoiceNumber: "GTT/INV/2099/0025",
          clientId: "cli-new",
          client: {
            name: "Brand New Client",
            sortOrder: 5,
          },
          group: {
            code: "G-NEW",
            name: "New Group",
          },
          issuedDate: new Date("2099-04-02T00:00:00.000Z"),
          dueDate: new Date("2099-04-20T00:00:00.000Z"),
          amount: 700_000,
          status: InvoiceStatus.PENDING,
        };
      },
    },
    invoiceClient: {
      findFirst: async () => null,
      aggregate: async () => ({
        _max: {
          sortOrder: 4,
        },
      }),
      create: async () => ({
        id: "cli-new",
        groupId: "grp-new-client",
      }),
    },
    group: {
      findUnique: async () => ({
        id: "grp-new",
      }),
    },
  }) as unknown as PrismaService;

  const prismaMockError = withPrismaTransactionMocks({
    invoice: {
      findUnique: async () => ({
        id: "inv-101",
        clientId: "cli-old",
        groupId: null,
        issuedDate: new Date("2099-04-01T00:00:00.000Z"),
        dueDate: new Date("2099-04-05T00:00:00.000Z"),
        amount: 990_000,
        status: InvoiceStatus.PENDING,
        notes: null,
      }),
      update: async () => {
        throw createPrismaKnownRequestError("P2003", "foreign key failed");
      },
    },
    invoiceClient: {
      findUnique: async () => ({
        id: "cli-old",
        groupId: null,
      }),
    },
    group: {
      findUnique: async () => ({
        id: "grp-existing",
      }),
    },
  }) as unknown as PrismaService;

  {
    const { service, restore } = createPrismaInvoicesService(prismaMockSuccess);
    try {
      const updated = await service.update("inv-100", {
        version: 0,
        clientName: "Brand New Client",
        groupCode: "g-new",
        issuedDate: "2099-04-02",
        dueDate: "2099-04-20",
        amount: 700_000,
      });

      assert.equal(updated.clientName, "Brand New Client");
      assert.equal(updated.clientLabel, "05. Brand New Client");
      assert.equal(updated.groupCode, "G-NEW");
      assert.equal(updated.status, "Pending");
      assert.equal(
        ((updateCalls[0].data as { clientId: string; groupId: string }).clientId),
        "cli-new",
      );
      assert.equal(
        ((updateCalls[0].data as { clientId: string; groupId: string }).groupId),
        "grp-new",
      );
    } finally {
      restore();
    }
  }

  {
    const { service, restore } = createPrismaInvoicesService(prismaMockError);
    try {
      await assert.rejects(
        () =>
          service.update("inv-101", {
            version: 0,
            clientId: "cli-old",
            groupCode: "GRP-EXISTING",
          }),
        (error: unknown) => {
          assert.equal(error instanceof BadRequestException, true);
          assert.match((error as Error).message, /Invalid invoice relation payload/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }
}

async function testPrismaUpdateVersionConcurrencyConflict(): Promise<void> {
  const prismaMock = withPrismaTransactionMocks({
    invoiceClient: {
      findUnique: async () => ({
        id: "cli-1",
        groupId: null,
      }),
    },
    invoice: {
      findUnique: async () => ({
        id: "inv-conflict",
        clientId: "cli-1",
        groupId: null,
        issuedDate: new Date("2099-04-01T00:00:00.000Z"),
        dueDate: new Date("2099-04-05T00:00:00.000Z"),
        amount: 990_000,
        status: InvoiceStatus.PENDING,
        notes: null,
        version: 0,
      }),
      updateMany: async () => {
        return { count: 0 };
      },
    },
  }) as unknown as PrismaService;

  const { service, restore } = createPrismaInvoicesService(prismaMock);
  try {
    await assert.rejects(
      () =>
        service.update("inv-conflict", {
          version: 0,
          amount: 500_000,
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConflictException, true);
        assert.match((error as Error).message, /Invoice telah dimodifikasi oleh transaksi lain/i);
        return true;
      },
    );
  } finally {
    restore();
  }
}

async function main(): Promise<void> {
  await runCase("invoice list clients seeded labels", testListClientsReturnsSeededSortedLabels);
  await runCase("invoice create existing client sequential numbering", testCreateUsesExistingClientAndGeneratesSequentialNumbers);
  await runCase("invoice create new clients and status rules", testCreateCanCreateNewClientAndResolvesStatusRules);
  await runCase("invoice create reuses existing client case-insensitively", testCreateReusesExistingClientCaseInsensitively);
  await runCase("invoice create and update persist items", testCreateAndUpdatePersistInvoiceItems);
  await runCase("invoice create validation errors", testCreateValidationErrors);
  await runCase("invoice update status client and group rules", testUpdateSupportsClientSwitchStatusAndGroupRules);
  await runCase("invoice update validation errors", testUpdateValidationErrors);
  await runCase("invoice findAll missing client guard", testFindAllThrowsWhenInvoiceClientIsMissing);
  await runCase("invoice prisma list and findAll mapping", testPrismaListAndFindAllMapping);
  await runCase("invoice prisma list clients allows duplicate sort order", testPrismaListClientsAllowsDuplicateSortOrder);
  await runCase("invoice prisma findAll prefers inline down payment column", testPrismaFindAllPrefersInlineDownPaymentColumn);
  await runCase("invoice prisma create retry and fallback serial", testPrismaCreateSupportsRetryAndFallbackSerialResolution);
  await runCase(
    "invoice prisma create reuses client found inside locked transaction",
    testPrismaCreateReusesClientFoundInsideLockedTransaction,
  );
  await runCase("invoice prisma client lookup is case-insensitive", testPrismaClientLookupIsCaseInsensitive);
  await runCase("invoice prisma create error mapping", testPrismaCreateErrorMappings);
  await runCase("invoice prisma update success and error mapping", testPrismaUpdateSuccessAndErrorMappings);
  await runCase("invoice prisma update version concurrency conflict", testPrismaUpdateVersionConcurrencyConflict);
}

void main().catch((error: unknown) => {
  console.error("Invoices service test failed:", error);
  process.exitCode = 1;
});
