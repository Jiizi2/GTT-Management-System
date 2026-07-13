import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaInvoiceRepository } from "../infrastructure/repositories/prisma/prisma-invoice.repository";
import { MemoryInvoiceRepository } from "../infrastructure/repositories/memory/memory-invoice.repository";
import { describe, expect, it } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { InvoicesService } from "./invoices.service";
import { InvoiceValidator } from "./domain/invoice-validator";
import { InvoiceNumberGenerator } from "./domain/invoice-number-generator";
import { InvoiceMemoryStore } from "./application/invoice-memory-store";
import { InvoiceQueryService } from "./application/invoice-query.service";
import { InvoiceCommandService } from "./application/invoice-command.service";

type InvoiceListItem = Awaited<ReturnType<InvoicesService["findAll"]>>[number];
type InvoiceClient = Awaited<ReturnType<InvoicesService["listClients"]>>[number];

async function createMemoryInvoicesService(): Promise<{ service: InvoicesService; restore: () => void }> {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "memory";
  
  const memoryStore = new InvoiceMemoryStore();
  const repo = new MemoryInvoiceRepository(memoryStore);

  const moduleRef = await Test.createTestingModule({
    providers: [
      InvoicesService,
      InvoiceQueryService,
      InvoiceCommandService,
      ConfigService,
      {
        provide: "InvoiceRepository",
        useValue: repo,
      },
    ],
  }).compile();

  const service = moduleRef.get(InvoicesService);

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

async function createPrismaInvoicesService(prismaMock: PrismaService): Promise<{ service: InvoicesService; restore: () => void }> {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "prisma";
  
  const repo = new PrismaInvoiceRepository(prismaMock);

  const moduleRef = await Test.createTestingModule({
    providers: [
      InvoicesService,
      InvoiceQueryService,
      InvoiceCommandService,
      ConfigService,
      {
        provide: "InvoiceRepository",
        useValue: repo,
      },
    ],
  }).compile();

  const service = moduleRef.get(InvoicesService);

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

function findClientByName(clients: InvoiceClient[], name: string): InvoiceClient {
  const matched = clients.find((entry) => entry.name === name);
  if (!matched) {
    throw new Error(`Expected client '${name}' to exist.`);
  }
  return matched;
}

function assertInvoiceNumberPattern(invoiceNumber: string, year: string, serial: string): void {
  expect(invoiceNumber).toBe(`GTT/INV/${year}/${serial}`);
}

async function testListClientsReturnsSeededSortedLabels(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    const clients = await service.listClients();
    expect(clients.length).toBe(3);
    expect(
      clients.map((entry) => entry.name),
    ).toEqual(["Yassir", "Haris", "JSA"]);
    expect(
      clients.map((entry) => entry.label),
    ).toEqual(["01. Yassir", "02. Haris", "03. JSA"]);

    const yassir = findClientByName(clients, "Yassir");
    expect(yassir.groupCode).toBe("9017000001");
    expect(yassir.groupName).toBe("Dummy Trip Lengkap");
  } finally {
    restore();
  }
}

async function testCreateUsesExistingClientAndGeneratesSequentialNumbers(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
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
    expect(createdOne.clientName).toBe("Yassir");
    expect(createdOne.clientInitials).toBe("Y");
    expect(createdOne.status).toBe("Pending");
    expect(createdOne.amount).toBe(1_500_000);
    expect(createdOne.downPaymentIdr).toBe(0);
    expect(createdOne.groupCode).toBe("9017000001");
    expect(createdOne.monthKey).toBe("2099-02");

    const createdTwo = await service.create({
      clientId: yassir.id,
      issuedDate: "2099-01-03",
      dueDate: "2099-02-01",
      amount: 250_100,
    });
    assertInvoiceNumberPattern(createdTwo.invoiceNumber, "2099", "0002");

    const listed = await service.findAll();
    expect(listed.length).toBe(2);
    expect(listed[0].invoiceNumber).toBe("GTT/INV/2099/0002");
    expect(listed[1].invoiceNumber).toBe("GTT/INV/2099/0001");
  } finally {
    restore();
  }
}

async function testCreateCanCreateNewClientAndResolvesStatusRules(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    const createdOverdue = await service.create({
      clientName: "Manual New Client",
      issuedDate: "1999-12-20",
      dueDate: "2000-01-01",
      amount: 123_450,
    });
    expect(createdOverdue.clientName).toBe("Manual New Client");
    expect(createdOverdue.clientLabel).toBe("04. Manual New Client");
    expect(createdOverdue.status).toBe("Overdue");

    const createdCancelled = await service.create({
      clientName: "Another Manual Client",
      issuedDate: "2099-01-10",
      dueDate: "2099-01-20",
      amount: 999_999,
      status: InvoiceStatus.CANCELLED,
    });
    expect(createdCancelled.clientLabel).toBe("05. Another Manual Client");
    expect(createdCancelled.status).toBe("Cancelled");
    expect(createdCancelled.amount).toBe(999_999);

    const clients = await service.listClients();
    expect(clients.length).toBe(5);
    expect(clients[3].name).toBe("Manual New Client");
    expect(clients[4].name).toBe("Another Manual Client");
  } finally {
    restore();
  }
}

async function testCreateReusesExistingClientCaseInsensitively(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    const created = await service.create({
      clientName: "  yAsSiR  ",
      issuedDate: "2099-08-01",
      dueDate: "2099-08-10",
      amount: 200_000,
    });

    expect(created.clientName).toBe("Yassir");
    expect(created.clientLabel).toBe("01. Yassir");

    const clients = await service.listClients();
    expect(clients.length).toBe(3);
  } finally {
    restore();
  }
}

async function testCreateAndUpdatePersistInvoiceItems(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
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
    expect(created.items?.length).toBe(2);
    expect(created.items?.[0].description).toBe("Umrah Package");
    expect(created.items?.[1].currency).toBe("IDR");
    expect(created.amount).toBe(39_750_000);
    expect(created.downPaymentIdr).toBe(300_000);

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
    expect(updated.items?.length).toBe(1);
    expect(updated.items?.[0].description).toBe("Updated Package");
    expect(updated.amount).toBe(18_000_000);
    expect(updated.downPaymentIdr).toBe(120_000);

    const manuallyAdjusted = await service.update(created.id, {
      version: 0,
      amount: 8_880_000,
      downPaymentIdr: 120_000,
      status: InvoiceStatus.PAID,
    });
    expect(manuallyAdjusted.amount).toBe(8_880_000);
    expect(manuallyAdjusted.downPaymentIdr).toBe(120_000);
    expect(manuallyAdjusted.items?.length).toBe(1);

    const listed = await service.findAll();
    expect(listed[0].items?.length).toBe(1);
    expect(listed[0].items?.[0].currency).toBe("SAR");
    expect(listed[0].amount).toBe(8_880_000);
    expect(listed[0].downPaymentIdr).toBe(120_000);
  } finally {
    restore();
  }
}

async function testCreateValidationErrors(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    try {
      await service.create({
        issuedDate: "2099-01-01",
        dueDate: "2099-01-02",
        amount: 1000,
      } as any);
      throw new Error("Expected error was not thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toMatch(/Either clientId or clientName is required/i);
    }

    try {
      await service.create({
        clientName: "Invalid Date Client",
        issuedDate: "not-a-date",
        dueDate: "2099-01-02",
        amount: 1000,
      });
      throw new Error("Expected error was not thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as Error).message).toMatch(/Invalid issuedDate value/i);
    }

    try {
      await service.create({
        clientId: "missing-client-id",
        issuedDate: "2099-01-01",
        dueDate: "2099-01-02",
        amount: 1000,
      });
      throw new Error("Expected error was not thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toMatch(/Invoice client 'missing-client-id' not found/i);
    }
  } finally {
    restore();
  }
}

async function testUpdateSupportsClientSwitchStatusAndGroupRules(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
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
    expect(cancelled.status).toBe("Cancelled");
    expect(cancelled.amount).toBe(2_500_000);
    expect(cancelled.groupCode).toBe("GRP-001");

    const switched = await service.update(created.id, {
      version: 1,
      clientName: "Switched Client",
      dueDate: "2099-03-20",
      groupCode: "  ",
      status: InvoiceStatus.PENDING,
      amount: 2_500_000,
      notes: "Reopened",
    });
    expect(switched.clientName).toBe("Switched Client");
    expect(switched.clientLabel).toBe("05. Switched Client");
    expect(switched.status).toBe("Pending");
    expect(switched.amount).toBe(2_500_000);
    expect(switched.groupCode).toBeUndefined();
    expect(switched.groupName).toBeUndefined();
  } finally {
    restore();
  }
}

async function testUpdateValidationErrors(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    try {
      await service.update("missing-invoice-id", { version: 0, notes: "noop" });
      throw new Error("Expected error was not thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toMatch(/Invoice 'missing-invoice-id' not found/i);
    }

    const created = await service.create({
      clientName: "Client To Update",
      issuedDate: "2099-05-01",
      dueDate: "2099-05-03",
      amount: 450_000,
    });

    try {
      await service.update(created.id, {
        version: 0,
        clientId: "missing-client-id",
      });
      throw new Error("Expected error was not thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toMatch(/Invoice client 'missing-client-id' not found/i);
    }
  } finally {
    restore();
  }
}

async function testFindAllThrowsWhenInvoiceClientIsMissing(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
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

    try {
      await service.findAll();
      throw new Error("Expected error was not thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as Error).message).toMatch(new RegExp(`Invoice client '${created.clientId}' not found`, "i"));
    }
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
          itemsRel: [
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
          itemsRel: [],
        },
      ],
    },
  } as unknown as PrismaService;

  const { service, restore } = await createPrismaInvoicesService(prismaMock);
  try {
    const clients = await service.listClients();
    expect(clients.length).toBe(2);
    expect(clients[0].label).toBe("02. Beta Client");
    expect(clients[1].label).toBe("01. Alpha Client");
    expect(clients[1].groupCode).toBe("G-100");

    const invoices = await service.findAll();
    expect(invoices.length).toBe(2);
    expect(invoices[0].status).toBe("Partially Paid");
    expect(invoices[0].clientInitials).toBe("AC");
    expect(invoices[0].items?.length).toBe(1);
    expect(invoices[0].downPaymentIdr).toBe(50_000);
    expect(invoices[1].status).toBe("Cancelled");
    expect(invoices[1].amount).toBe(900_000);
    expect(invoices[1].items).toBeUndefined();
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

  const { service, restore } = await createPrismaInvoicesService(prismaMock);
  try {
    const clients = await service.listClients();
    const orderBy = (findManyArgs as Record<string, unknown> | null)?.orderBy;
    expect(orderBy).toEqual([{ sortOrder: "asc" }, { createdAt: "asc" }]);
    expect(clients.length).toBe(2);
    expect(
      clients.map((client) => client.label),
    ).toEqual(["04. Earlier Client", "04. Later Client"]);
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
          itemsRel: [],
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

  const { service, restore } = await createPrismaInvoicesService(prismaMock);
  try {
    (service as unknown as { prismaInvoiceDownPaymentColumnState: boolean | null }).prismaInvoiceDownPaymentColumnState =
      true;

    const invoices = await service.findAll();
    expect(invoices.length).toBe(1);
    expect(invoices[0].downPaymentIdr).toBe(125_000);
    expect(rawReadCalls).toBe(0);
    expect(rawWriteCalls).toBe(0);
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

  const { service, restore } = await createPrismaInvoicesService(prismaMock);
  try {
    const created = await service.create({
      clientName: "Retry Client",
      issuedDate: "2099-03-01",
      dueDate: "2099-03-20",
      amount: 890_000,
      notes: "Create with retry",
    });

    expect(created.invoiceNumber).toBe("GTT/INV/2099/0011");
    expect(created.clientName).toBe("Retry Client");
    expect(created.status).toBe("Pending");
    expect(createAttempt).toBe(2);
    expect(
      (createdPayloads[1].data as { invoiceNumber: string }).invoiceNumber,
    ).toBe("GTT/INV/2099/0011");
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

          expect(data.clientId).toBe("cli-existing");

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

  const { service, restore } = await createPrismaInvoicesService(prismaMock);
  try {
    const created = await service.create({
      clientName: "Locked Existing Client",
      issuedDate: "2099-05-01",
      dueDate: "2099-05-20",
      amount: 450_000,
    });

    expect(created.clientName).toBe("Locked Existing Client");
    expect(created.clientId).toBe("cli-existing");
    expect(created.invoiceNumber).toBe("GTT/INV/2099/0010");
    expect(clientLookupCount).toBe(2);
    expect(aggregateCalls).toBe(0);
    expect(clientCreateCalls).toBe(0);
    expect(lockQueryCount).toBe(2);
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

  const { service, restore } = await createPrismaInvoicesService(prismaMock);
  try {
    const created = await service.create({
      clientName: "  existing CLIENT ",
      issuedDate: "2099-09-01",
      dueDate: "2099-09-15",
      amount: 510_000,
    });

    expect(created.clientId).toBe("cli-existing");
    expect(clientLookupCount >= 1).toBeTruthy();
    const lookupWhere = lastClientLookupArgs as { where?: { name?: { equals?: string; mode?: string } } } | null;
    expect(lookupWhere?.where?.name).toEqual({
      equals: "existing CLIENT",
      mode: "insensitive",
    });
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
        throw new Error("should not be called when group is left");
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
    const { service, restore } = await createPrismaInvoicesService(prismaMockUnknownGroup);
    try {
      try {
        await service.create({
          clientId: "cli-1",
          groupCode: "UNKNOWN",
          issuedDate: "2099-01-01",
          dueDate: "2099-01-10",
          amount: 100_000,
        });
        throw new Error("Expected error was not thrown");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as Error).message).toMatch(/Group 'UNKNOWN' not found/i);
      }
    } finally {
      restore();
    }
  }

  {
    const { service, restore } = await createPrismaInvoicesService(prismaMockPersistentP2002);
    try {
      try {
        await service.create({
          clientId: "cli-1",
          groupCode: "GRP-1",
          issuedDate: "2099-01-01",
          dueDate: "2099-01-10",
          amount: 100_000,
        });
        throw new Error("Expected error was not thrown");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(ConflictException);
        expect((error as Error).message).toMatch(/Failed to generate a unique invoice number/i);
      }
    } finally {
      restore();
    }
  }

  {
    const { service, restore } = await createPrismaInvoicesService(prismaMockEnumMismatch);
    try {
      try {
        await service.create({
          clientId: "cli-1",
          groupCode: "GRP-1",
          issuedDate: "2099-01-01",
          dueDate: "2099-01-10",
          amount: 100_000,
          status: InvoiceStatus.CANCELLED,
        });
        throw new Error("Expected error was not thrown");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toMatch(/CANCELLED belum tersedia di database/i);
      }
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
    const { service, restore } = await createPrismaInvoicesService(prismaMockSuccess);
    try {
      const updated = await service.update("inv-100", {
        version: 0,
        clientName: "Brand New Client",
        groupCode: "g-new",
        issuedDate: "2099-04-02",
        dueDate: "2099-04-20",
        amount: 700_000,
      });

      expect(updated.clientName).toBe("Brand New Client");
      expect(updated.clientLabel).toBe("05. Brand New Client");
      expect(updated.groupCode).toBe("G-NEW");
      expect(updated.status).toBe("Pending");
      expect(
        ((updateCalls[0].data as { clientId: string; groupId: string }).clientId),
      ).toBe("cli-new");
      expect(
        ((updateCalls[0].data as { clientId: string; groupId: string }).groupId),
      ).toBe("grp-new");
    } finally {
      restore();
    }
  }

  {
    const { service, restore } = await createPrismaInvoicesService(prismaMockError);
    try {
      try {
        await service.update("inv-101", {
          version: 0,
          clientId: "cli-old",
          groupCode: "GRP-EXISTING",
        });
        throw new Error("Expected error was not thrown");
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as Error).message).toMatch(/Invalid invoice relation payload/i);
      }
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

  const { service, restore } = await createPrismaInvoicesService(prismaMock);
  try {
    try {
      await service.update("inv-conflict", {
        version: 0,
        amount: 500_000,
      });
      throw new Error("Expected error was not thrown");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as Error).message).toMatch(/Invoice telah dimodifikasi oleh transaksi lain/i);
    }
  } finally {
    restore();
  }
}

async function testFinancialCalculationsAndEdgeCases(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    // Test 1: Exchange rate calculations with USD
    const usdInvoice = await service.create({
      clientName: "USD Client",
      issuedDate: "2099-05-01",
      dueDate: "2099-05-15",
      amount: 0,
      notes: "[ExchangeRate:USD=15800,SAR=4200]",
      items: [
        {
          description: "USD Package",
          pax: 2,
          currency: "USD",
          unitPrice: 1000,
          totalPrice: 2000,
          totalPriceIdr: 31600000, // 2000 * 15800
        },
      ],
    });
    expect(usdInvoice.amount).toBe(31600000);
    expect(usdInvoice.items?.[0].totalPriceIdr).toBe(31600000);

    // Test 2: Exchange rate calculations with SAR
    const sarInvoice = await service.create({
      clientName: "SAR Client",
      issuedDate: "2099-05-02",
      dueDate: "2099-05-16",
      amount: 0,
      notes: "[ExchangeRate:USD=15800,SAR=4200]",
      items: [
        {
          description: "SAR Package",
          pax: 1,
          currency: "SAR",
          unitPrice: 5000,
          totalPrice: 5000,
          totalPriceIdr: 21000000, // 5000 * 4200
        },
      ],
    });
    expect(sarInvoice.amount).toBe(21000000);

    // Test 3: Down payment normalization (cannot exceed amount)
    const overpaymentInvoice = await service.create({
      clientName: "Overpayment Client",
      issuedDate: "2099-05-03",
      dueDate: "2099-05-17",
      amount: 1000000,
      downPaymentIdr: 1500000, // Exceeds amount
    });
    expect(overpaymentInvoice.downPaymentIdr).toBe(1000000); // Normalized to amount
    expect(overpaymentInvoice.status).toBe("Paid");

    // Test 4: Partial payment status
    const partialPaymentInvoice = await service.create({
      clientName: "Partial Payment Client",
      issuedDate: "2099-05-04",
      dueDate: "2099-05-18",
      amount: 1000000,
      downPaymentIdr: 500000,
    });
    expect(partialPaymentInvoice.status).toBe("Partially Paid");
    expect(partialPaymentInvoice.downPaymentIdr).toBe(500000);

    // Test 5: Negative amount is normalized to 0 in memory mode
    const negativeAmountInvoice = await service.create({
      clientName: "Negative Amount Client",
      issuedDate: "2099-05-05",
      dueDate: "2099-05-19",
      amount: -1000,
    });
    expect(negativeAmountInvoice.amount).toBe(0); // Normalized to 0

    // Test 6: Negative down payment is normalized to 0 in memory mode
    const negativeDPInvoice = await service.create({
      clientName: "Negative DP Client",
      issuedDate: "2099-05-06",
      dueDate: "2099-05-20",
      amount: 1000000,
      downPaymentIdr: -500000,
    });
    expect(negativeDPInvoice.downPaymentIdr).toBe(0); // Normalized to 0

    // Test 7: Invalid line item validation (memory mode is lenient, validation happens in Prisma mode)
    // In memory mode, invalid items are filtered out, not rejected
    const invalidItemInvoice = await service.create({
      clientName: "Invalid Item Client",
      issuedDate: "2099-05-07",
      dueDate: "2099-05-21",
      amount: 0,
      items: [
        {
          description: "",
          pax: 2,
          currency: "USD",
          unitPrice: 1000,
          totalPrice: 2000,
          totalPriceIdr: 31600000,
        },
      ],
    });
    // Empty description items are filtered out in memory mode
    expect(invalidItemInvoice.items).toBeUndefined();

    // Test 8: Invalid currency validation (cast to any to bypass TypeScript)
    // In memory mode, invalid currency items are filtered out, not rejected
    const invalidCurrencyInvoice = await service.create({
      clientName: "Invalid Currency Client",
      issuedDate: "2099-05-08",
      dueDate: "2099-05-22",
      amount: 0,
      items: [
        {
          description: "Invalid Currency",
          pax: 2,
          currency: "EUR" as any,
          unitPrice: 1000,
          totalPrice: 2000,
          totalPriceIdr: 17000000,
        },
      ],
    });
    // Invalid currency items are filtered out in memory mode
    expect(invalidCurrencyInvoice.items).toBeUndefined();

    // Test 9: Zero pax validation
    // In memory mode, zero pax items are filtered out, not rejected
    const zeroPaxInvoice = await service.create({
      clientName: "Zero Pax Client",
      issuedDate: "2099-05-09",
      dueDate: "2099-05-23",
      amount: 0,
      items: [
        {
          description: "Zero Pax",
          pax: 0,
          currency: "USD",
          unitPrice: 1000,
          totalPrice: 0,
          totalPriceIdr: 0,
        },
      ],
    });
    // Zero pax items are filtered out in memory mode
    expect(zeroPaxInvoice.items).toBeUndefined();
  } finally {
    restore();
  }
}

async function testOverdueStatusLogic(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    // Test 1: Invoice becomes overdue when past due date
    const pastDueInvoice = await service.create({
      clientName: "Past Due Client",
      issuedDate: "2020-01-01",
      dueDate: "2020-01-15",
      amount: 1000000,
    });
    expect(pastDueInvoice.status).toBe("Overdue");

    // Test 2: Invoice with NoDueDate flag doesn't become overdue
    const noDueDateInvoice = await service.create({
      clientName: "No Due Date Client",
      issuedDate: "2020-01-01",
      dueDate: "", // Empty due date
      amount: 1000000,
    });
    expect(noDueDateInvoice.status).toBe("Pending");
    expect(noDueDateInvoice.dueDateIso).toBe("");

    // Test 3: Update invoice to add due date
    const updatedWithDueDate = await service.update(noDueDateInvoice.id, {
      version: 0,
      dueDate: "2020-02-01",
    });
    expect(updatedWithDueDate.status).toBe("Overdue");
    expect(updatedWithDueDate.dueDateIso).toBe("2020-02-01");

    // Test 4: Partially paid invoice becomes overdue
    const partialOverdueInvoice = await service.create({
      clientName: "Partial Overdue Client",
      issuedDate: "2020-02-01",
      dueDate: "2020-02-15",
      amount: 1000000,
      downPaymentIdr: 500000,
    });
    expect(partialOverdueInvoice.status).toBe("Overdue");
    expect(partialOverdueInvoice.downPaymentIdr).toBe(500000);
  } finally {
    restore();
  }
}

async function testPaymentHistoryValidation(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    // Test 1: Valid payment history in notes (status determined by downPaymentIdr, not payment history)
    const invoiceWithPayments = await service.create({
      clientName: "Payment History Client",
      issuedDate: "2099-06-01",
      dueDate: "2099-06-15",
      amount: 1000000,
      downPaymentIdr: 500000, // This determines Partially Paid status
      notes: `[Payments:${encodeURIComponent(JSON.stringify([
        { amount: 300000, date: "2099-06-05" },
        { amount: 200000, date: "2099-06-10" },
      ]))}]`,
    });
    expect(invoiceWithPayments.status).toBe("Partially Paid");
    expect(invoiceWithPayments.notes).toContain("[Payments:");

    // Test 2: Invalid payment history JSON (memory mode is lenient)
    // In memory mode, invalid JSON in notes is ignored, not rejected
    const invalidJsonInvoice = await service.create({
      clientName: "Invalid Payment JSON Client",
      issuedDate: "2099-06-02",
      dueDate: "2099-06-16",
      amount: 1000000,
      notes: "[Payments:invalid-json]",
    });
    // Invoice is created, notes are stored as-is
    expect(invalidJsonInvoice.notes).toContain("[Payments:invalid-json]");

    // Test 3: Negative payment amount (memory mode is lenient)
    // In memory mode, negative payment amounts are ignored, not rejected
    const negativePaymentInvoice = await service.create({
      clientName: "Negative Payment Client",
      issuedDate: "2099-06-03",
      dueDate: "2099-06-17",
      amount: 1000000,
      notes: `[Payments:${encodeURIComponent(JSON.stringify([
        { amount: -100000, date: "2099-06-05" },
      ]))}]`,
    });
    // Invoice is created, notes are stored as-is
    expect(negativePaymentInvoice.notes).toContain("[Payments:");
  } finally {
    restore();
  }
}

async function testClientSortOrderLogic(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    // Test 1: New clients get next available sort order
    const client1 = await service.create({
      clientName: "Client A",
      issuedDate: "2099-07-01",
      dueDate: "2099-07-15",
      amount: 1000000,
    });
    expect(client1.clientLabel).toBe("04. Client A");

    const client2 = await service.create({
      clientName: "Client B",
      issuedDate: "2099-07-02",
      dueDate: "2099-07-16",
      amount: 1000000,
    });
    expect(client2.clientLabel).toBe("05. Client B");

    // Test 2: Case-insensitive client matching
    const client1Duplicate = await service.create({
      clientName: "  client a  ",
      issuedDate: "2099-07-03",
      dueDate: "2099-07-17",
      amount: 1000000,
    });
    expect(client1Duplicate.clientLabel).toBe("04. Client A"); // Reuses existing

    // Test 3: Clients list is sorted by sortOrder
    const clients = await service.listClients();
    const sortOrders = clients.map((c) => c.sortOrder);
    const sortedSortOrders = [...sortOrders].sort((a, b) => a - b);
    expect(sortOrders).toEqual(sortedSortOrders);
  } finally {
    restore();
  }
}

async function testInvoiceNumberGeneration(): Promise<void> {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    // Test 1: Sequential numbering within same year
    const inv1 = await service.create({
      clientName: "Numbering Client 1",
      issuedDate: "2099-08-01",
      dueDate: "2099-08-15",
      amount: 1000000,
    });
    expect(inv1.invoiceNumber).toBe("GTT/INV/2099/0001");

    const inv2 = await service.create({
      clientName: "Numbering Client 2",
      issuedDate: "2099-08-02",
      dueDate: "2099-08-16",
      amount: 1000000,
    });
    expect(inv2.invoiceNumber).toBe("GTT/INV/2099/0002");

    // Test 2: Different year continues numbering (not reset)
    const inv3 = await service.create({
      clientName: "Numbering Client 3",
      issuedDate: "2100-01-01",
      dueDate: "2100-01-15",
      amount: 1000000,
    });
    expect(inv3.invoiceNumber).toBe("GTT/INV/2100/0003"); // Continues from 0002

    // Test 3: Month key extraction
    expect(inv1.monthKey).toBe("2099-08");
    expect(inv3.monthKey).toBe("2100-01");
  } finally {
    restore();
  }
}

async function testPaginationSupport() {
  const { service, restore } = await createMemoryInvoicesService();
  try {
    for (let i = 1; i <= 5; i++) {
      await service.create({
        clientName: `Client ${i}`,
        issuedDate: "2026-07-05",
        dueDate: "2026-07-12",
        amount: 1000 * i,
      });
    }

    const res1 = await service.findAllPaginated({ page: 1, limit: 2 });
    expect(res1.data.length).toBe(2);
    expect(res1.total).toBe(5);
    expect(res1.page).toBe(1);
    expect(res1.limit).toBe(2);
    expect(res1.totalPages).toBe(3);

    const res2 = await service.findAllPaginated({ page: 2, limit: 2 });
    expect(res2.data.length).toBe(2);
    expect(res2.total).toBe(5);
    expect(res2.page).toBe(2);

    const res3 = await service.findAllPaginated({ page: 3, limit: 2 });
    expect(res3.data.length).toBe(1);
    expect(res3.total).toBe(5);
    expect(res3.page).toBe(3);
  } finally {
    restore();
  }
}


describe("InvoicesService", () => {
  it("invoice list clients seeded labels", async () => testListClientsReturnsSeededSortedLabels());
  it("invoice create existing client sequential numbering", async () => testCreateUsesExistingClientAndGeneratesSequentialNumbers());
  it("invoice create new clients and status rules", async () => testCreateCanCreateNewClientAndResolvesStatusRules());
  it("invoice create reuses existing client case-insensitively", async () => testCreateReusesExistingClientCaseInsensitively());
  it("invoice create and update persist items", async () => testCreateAndUpdatePersistInvoiceItems());
  it("invoice create validation errors", async () => testCreateValidationErrors());
  it("invoice update status client and group rules", async () => testUpdateSupportsClientSwitchStatusAndGroupRules());
  it("invoice update validation errors", async () => testUpdateValidationErrors());
  it("invoice findAll missing client guard", async () => testFindAllThrowsWhenInvoiceClientIsMissing());
  it("invoice prisma list and findAll mapping", async () => testPrismaListAndFindAllMapping());
  it("invoice prisma list clients allows duplicate sort order", async () => testPrismaListClientsAllowsDuplicateSortOrder());
  it("invoice prisma findAll prefers inline down payment column", async () => testPrismaFindAllPrefersInlineDownPaymentColumn());
  it("invoice prisma create retry and fallback serial", async () => testPrismaCreateSupportsRetryAndFallbackSerialResolution());
  it("invoice prisma create reuses client found inside locked transaction", async () => testPrismaCreateReusesClientFoundInsideLockedTransaction());
  it("invoice prisma client lookup is case-insensitive", async () => testPrismaClientLookupIsCaseInsensitive());
  it("invoice prisma create error mapping", async () => testPrismaCreateErrorMappings());
  it("invoice prisma update success and error mapping", async () => testPrismaUpdateSuccessAndErrorMappings());
  it("invoice prisma update version concurrency conflict", async () => testPrismaUpdateVersionConcurrencyConflict());
  it("financial calculations and edge cases", async () => testFinancialCalculationsAndEdgeCases());
  it("overdue status logic", async () => testOverdueStatusLogic());
  it("payment history validation", async () => testPaymentHistoryValidation());
  it("client sort order logic", async () => testClientSortOrderLogic());
  it("invoice number generation", async () => testInvoiceNumberGeneration());
  it("invoice pagination support", async () => testPaginationSupport());
});
