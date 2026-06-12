import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { ChecklistAssignmentStatus, GroupTone, Prisma, VisaPaymentStatus, VisaStatus } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { GroupsService } from "../application/groups.service";

function createPrismaGroupsService(prismaMock: PrismaService): { service: GroupsService; restore: () => void } {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "prisma";
  const prismaRecord = prismaMock as unknown as Record<string, unknown>;
  prismaRecord.groupAuditLog ??= {
    create: async () => ({}),
    findMany: async () => [],
  };
  const service = new GroupsService(prismaMock);

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

function createPrismaKnownRequestError(
  code: string,
  message = `prisma error ${code}`,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code: code as Prisma.PrismaClientKnownRequestError["code"],
    clientVersion: "unit-test",
  });
}

function createConfirmChecklistPayload(
  overrides: Partial<{
    tripDate: string;
    activity: string;
    tripLabel: string;
    requiredBusCount: number;
    scheduledTime: string;
    transferByTrain: boolean;
    trainDepartureTime: string;
    stationPickupTime: string;
    driver: {
      name: string;
      phone: string;
      plateNumber: string;
    };
  }> = {},
) {
  return {
    tripDate: "2026-05-20",
    activity: " Transfer ",
    tripLabel: " Makkah to Madinah ",
    requiredBusCount: 2,
    scheduledTime: " 08:00 ",
    transferByTrain: true,
    trainDepartureTime: " 09:00 ",
    stationPickupTime: " 07:00 ",
    driver: {
      name: " Driver One ",
      phone: " +62-888-111 ",
      plateNumber: " B 1234 CD ",
    },
    ...overrides,
  };
}

function createResetChecklistPayload(
  overrides: Partial<{
    tripDate: string;
    scheduledTime: string;
    activity: string;
  }> = {},
) {
  return {
    tripDate: "2026-05-20",
    scheduledTime: " 08:00 ",
    ...overrides,
  };
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testPrismaFindAllWhereAndPaginationBranches(): Promise<void> {
  {
    const findManyCalls: Array<Record<string, unknown>> = [];
    const prismaMock = {
      group: {
        findMany: async (args: Record<string, unknown>) => {
          findManyCalls.push(args);
          return [{ id: "grp-1", code: "GRP-1" }];
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const items = (await service.findAll(" grp ", {
        filter: "not-issued",
      })) as Array<{ code?: string }>;

      assert.equal(items.length, 1);
      assert.equal(items[0].code, "GRP-1");
      assert.equal(findManyCalls.length, 1);
      assert.equal(
        Boolean((findManyCalls[0] as { select?: unknown }).select),
        true,
        "Expected Prisma groups list query to use an explicit select shape.",
      );

      const where = (findManyCalls[0] as {
        where?: {
          AND: Array<{ OR: Array<Record<string, unknown>> }>;
        };
      }).where;
      assert.ok(where);
      assert.equal(where?.AND.length, 2);

      const queryCondition = where?.AND[0] as unknown as {
        AND: Array<{
          searchDocument?: { contains: string; mode: string };
        }>;
      };
      assert.equal(queryCondition.AND.length, 1);
      assert.equal(queryCondition.AND[0].searchDocument?.contains, "grp");
      assert.equal(queryCondition.AND[0].searchDocument?.mode, "insensitive");

      const filterCondition = where?.AND[1] as {
        OR: Array<{
          visaSetup: { is: unknown };
        }>;
      };
      assert.equal(filterCondition.OR[0].visaSetup.is, null);
      assert.equal(
        (
          filterCondition.OR[1].visaSetup.is as {
            visaStatus: { not: VisaStatus };
          }
        ).visaStatus.not,
        VisaStatus.ISSUED,
      );
    } finally {
      restore();
    }
  }

  {
    let summaryFindManyArgs: Record<string, unknown> | null = null;
    const prismaMock = {
      group: {
        findMany: async (args: Record<string, unknown>) => {
          summaryFindManyArgs = args;
          return [{ id: "grp-summary", code: "GRP-SUMMARY" }];
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const summaryItems = (await service.findAll(undefined, {
        projection: "summary",
      })) as Array<{ code?: string }>;
      assert.equal(summaryItems.length, 1);
      assert.equal(summaryItems[0].code, "GRP-SUMMARY");
      assert.ok(summaryFindManyArgs);
      const summarySelect = (summaryFindManyArgs as { select?: Record<string, unknown> }).select ?? {};
      assert.equal(Object.prototype.hasOwnProperty.call(summarySelect, "itinerary"), true);
      assert.equal(Object.prototype.hasOwnProperty.call(summarySelect, "notes"), true);
      assert.equal(Object.prototype.hasOwnProperty.call(summarySelect, "visaSetup"), true);
      assert.equal(Object.prototype.hasOwnProperty.call(summarySelect, "checklistAssignments"), false);
    } finally {
      restore();
    }
  }

  {
    let searchFindManyArgs: Record<string, unknown> | null = null;
    const prismaMock = {
      group: {
        findMany: async (args: Record<string, unknown>) => {
          searchFindManyArgs = args;
          return [];
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      await service.findAll("grp-101 vip");
      const searchWhere = (searchFindManyArgs as unknown as {
        where?: {
          AND: Array<{
            AND?: Array<{ searchDocument: { contains: string; mode: string } }>;
          }>;
        };
      }).where;
      assert.ok(searchWhere);
      const tokenCondition = searchWhere?.AND[0];
      assert.deepEqual(tokenCondition?.AND, [
        {
          searchDocument: {
            contains: "grp",
            mode: "insensitive",
          },
        },
        {
          searchDocument: {
            contains: "101",
            mode: "insensitive",
          },
        },
        {
          searchDocument: {
            contains: "vip",
            mode: "insensitive",
          },
        },
      ]);
    } finally {
      restore();
    }
  }

  {
    let countWhere: unknown;
    let findManyArgs: Record<string, unknown> | null = null;
    const prismaMock = {
      group: {
        count: async (args: Record<string, unknown>) => {
          countWhere = args.where;
          return 11;
        },
        findMany: async (args: Record<string, unknown>) => {
          findManyArgs = args;
          return [{ id: "grp-2", code: "GRP-2" }];
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const paged = (await service.findAll(undefined, {
        page: 2,
        pageSize: 3,
        filter: "missing-hotel",
      })) as {
        items: Array<{ code?: string }>;
        total: number;
        page: number;
        pageSize: number;
      };

      assert.equal(paged.total, 11);
      assert.equal(paged.page, 2);
      assert.equal(paged.pageSize, 3);
      assert.equal(paged.items.length, 1);
      assert.equal(paged.items[0].code, "GRP-2");
      assert.ok(findManyArgs);
      assert.equal((findManyArgs as { skip: number }).skip, 3);
      assert.equal((findManyArgs as { take: number }).take, 3);
      assert.equal(
        Boolean((findManyArgs as { select?: unknown }).select),
        true,
        "Expected paginated Prisma groups list query to use an explicit select shape.",
      );

      const where = countWhere as {
        AND: Array<{
          OR: Array<{ visaSetup: { is: unknown } }>;
        }>;
      };
      assert.equal(where.AND.length, 1);
      const missingHotelCondition = where.AND[0];
      assert.equal(missingHotelCondition.OR[0].visaSetup.is, null);
      assert.deepEqual(
        (
          missingHotelCondition.OR[1].visaSetup.is as {
            hotelAgreements: { none: Record<string, never> };
          }
        ).hotelAgreements.none,
        {},
      );
    } finally {
      restore();
    }
  }

  {
    let whereUsed: unknown;
    const prismaMock = {
      group: {
        findMany: async (args: Record<string, unknown>) => {
          whereUsed = args.where;
          return [];
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const items = (await service.findAll(undefined, {
        filter: "unpaid",
      })) as unknown[];
      assert.equal(items.length, 0);

      const unpaidCondition = (whereUsed as {
        AND: Array<{
          OR: Array<{ visaSetup: { is: unknown } }>;
        }>;
      }).AND[0];
      assert.equal(unpaidCondition.OR[0].visaSetup.is, null);
      assert.equal(
        (
          unpaidCondition.OR[1].visaSetup.is as {
            paymentStatus: { not: VisaPaymentStatus };
          }
        ).paymentStatus.not,
        VisaPaymentStatus.PAID,
      );
    } finally {
      restore();
    }
  }

  {
    let whereUsed: unknown = "sentinel";
    const prismaMock = {
      group: {
        findMany: async (args: Record<string, unknown>) => {
          whereUsed = args.where;
          return [];
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      await service.findAll(undefined, {});
      assert.equal(whereUsed, undefined);
    } finally {
      restore();
    }
  }

  {
    let whereUsed: unknown;
    const prismaMock = {
      group: {
        findMany: async (args: Record<string, unknown>) => {
          whereUsed = args.where;
          return [];
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const items = (await service.findAll(undefined, {
        activeOnly: true,
      })) as unknown[];
      assert.equal(items.length, 0);
      assert.deepEqual(whereUsed, {
        AND: [
          {
            tone: GroupTone.ACTIVE,
          },
        ],
      });
    } finally {
      restore();
    }
  }
}

async function testPrismaConfirmChecklistDriverPaths(): Promise<void> {
  {
    let assignmentCreatePayload: Record<string, unknown> | null = null;
    let statusUpdatePayload: Record<string, unknown> | null = null;
    let checklistDriverCreateCalls = 0;
    let lockCalls = 0;

    const prismaMock = {
      group: {
        findFirst: async () => ({
          id: "grp-1",
          code: "GRP-PRISMA",
        }),
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          $executeRaw: async () => {
            lockCalls += 1;
            return 1;
          },
          checklistAssignment: {
            findFirst: async () => null,
            create: async (args: Record<string, unknown>) => {
              assignmentCreatePayload = args;
              return {
                id: "assign-1",
                tripDate: new Date("2026-05-20T00:00:00.000Z"),
                activity: "Transfer",
                tripLabel: "Makkah to Madinah",
                requiredBusCount: 2,
                scheduledTime: "08:00",
                transferByTrain: true,
                trainDepartureTime: "09:00",
                stationPickupTime: "07:00",
                status: ChecklistAssignmentStatus.NOT_COMPLETE,
                drivers: [],
              };
            },
            findUniqueOrThrow: async () => ({
              id: "assign-1",
              tripDate: new Date("2026-05-20T00:00:00.000Z"),
              activity: "Transfer",
              tripLabel: "Makkah to Madinah",
              requiredBusCount: 2,
              scheduledTime: "08:00",
              transferByTrain: true,
              trainDepartureTime: "09:00",
              stationPickupTime: "07:00",
              status: ChecklistAssignmentStatus.NOT_COMPLETE,
              drivers: [
                {
                  slotNumber: 1,
                  name: "Driver One",
                  phone: "+62-888-111",
                  plateNumber: "B 1234 CD",
                  isVerified: true,
                },
                {
                  slotNumber: 2,
                  name: "Driver Two",
                  phone: "+62-888-222",
                  plateNumber: "B 9999 EF",
                  isVerified: true,
                },
              ],
            }),
            update: async (args: Record<string, unknown>) => {
              statusUpdatePayload = args;
              return {
                id: "assign-1",
                tripDate: new Date("2026-05-20T00:00:00.000Z"),
                activity: "Transfer",
                tripLabel: "Makkah to Madinah",
                requiredBusCount: 2,
                scheduledTime: "08:00",
                transferByTrain: true,
                trainDepartureTime: "09:00",
                stationPickupTime: "07:00",
                status: ChecklistAssignmentStatus.ASSIGNED,
                drivers: [
                  {
                    slotNumber: 1,
                    name: "Driver One",
                    phone: "+62-888-111",
                    plateNumber: "B 1234 CD",
                    isVerified: true,
                  },
                  {
                    slotNumber: 2,
                    name: "Driver Two",
                    phone: "+62-888-222",
                    plateNumber: "B 9999 EF",
                    isVerified: true,
                  },
                ],
              };
            },
          },
          checklistDriver: {
            create: async () => {
              checklistDriverCreateCalls += 1;
              if (checklistDriverCreateCalls === 1) {
                throw createPrismaKnownRequestError("P2002", "duplicate slot");
              }
              return { id: `driver-${checklistDriverCreateCalls}` };
            },
          },
        };
        return callback(tx);
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const result = await service.confirmChecklistDriver(
        "GRP-PRISMA",
        createConfirmChecklistPayload({
          requiredBusCount: 2,
        }),
      );

      assert.equal(checklistDriverCreateCalls, 2);
      assert.equal(lockCalls, 1);
      assert.ok(assignmentCreatePayload);
      assert.ok(statusUpdatePayload);

      const createData = (assignmentCreatePayload as {
        data: {
          activity: string;
          tripLabel: string;
          requiredBusCount: number;
          scheduledTime: string;
          transferByTrain: boolean;
          trainDepartureTime: string | null;
          stationPickupTime: string | null;
        };
      }).data;
      assert.equal(createData.activity, "Transfer");
      assert.equal(createData.tripLabel, "Makkah to Madinah");
      assert.equal(createData.requiredBusCount, 2);
      assert.equal(createData.scheduledTime, "08:00");
      assert.equal(createData.transferByTrain, true);
      assert.equal(createData.trainDepartureTime, "09:00");
      assert.equal(createData.stationPickupTime, "07:00");

      const statusData = (statusUpdatePayload as {
        data: { status: ChecklistAssignmentStatus };
      }).data;
      assert.equal(statusData.status, ChecklistAssignmentStatus.ASSIGNED);
      assert.equal(result.groupCode, "GRP-PRISMA");
      assert.equal(result.status, ChecklistAssignmentStatus.ASSIGNED);
      assert.equal(result.drivers.length, 2);
    } finally {
      restore();
    }
  }

  {
    let assignmentFieldUpdateCalls = 0;
    let statusUpdateCalls = 0;

    const prismaMock = {
      group: {
        findFirst: async () => ({
          id: "grp-1",
          code: "GRP-PRISMA",
        }),
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          $executeRaw: async () => 1,
          checklistAssignment: {
            findFirst: async () => ({
              id: "assign-2",
              tripDate: new Date("2026-05-20T00:00:00.000Z"),
              activity: "City Tour",
              tripLabel: "Madinah City Tour",
              requiredBusCount: 1,
              scheduledTime: "10:00",
              transferByTrain: false,
              trainDepartureTime: null,
              stationPickupTime: null,
              status: ChecklistAssignmentStatus.ASSIGNED,
              drivers: [
                {
                  slotNumber: 1,
                  name: "Driver Existing",
                  phone: "+62-888-333",
                  plateNumber: "B 7777 GH",
                  isVerified: true,
                },
              ],
            }),
            update: async (args: Record<string, unknown>) => {
              const data = (args as { data?: Record<string, unknown> }).data ?? {};
              if ("status" in data) {
                statusUpdateCalls += 1;
              } else {
                assignmentFieldUpdateCalls += 1;
              }

              return {
                id: "assign-2",
                tripDate: new Date("2026-05-20T00:00:00.000Z"),
                activity: "City Tour",
                tripLabel: "Madinah City Tour",
                requiredBusCount: 1,
                scheduledTime: "10:00",
                transferByTrain: false,
                trainDepartureTime: null,
                stationPickupTime: null,
                status: ChecklistAssignmentStatus.ASSIGNED,
                drivers: [
                  {
                    slotNumber: 1,
                    name: "Driver Existing",
                    phone: "+62-888-333",
                    plateNumber: "B 7777 GH",
                    isVerified: true,
                  },
                ],
              };
            },
            findUniqueOrThrow: async () => ({
              id: "assign-2",
              tripDate: new Date("2026-05-20T00:00:00.000Z"),
              activity: "City Tour",
              tripLabel: "Madinah City Tour",
              requiredBusCount: 1,
              scheduledTime: "10:00",
              transferByTrain: false,
              trainDepartureTime: null,
              stationPickupTime: null,
              status: ChecklistAssignmentStatus.ASSIGNED,
              drivers: [
                {
                  slotNumber: 1,
                  name: "Driver Existing",
                  phone: "+62-888-333",
                  plateNumber: "B 7777 GH",
                  isVerified: true,
                },
              ],
            }),
          },
          checklistDriver: {
            create: async () => {
              throw new Error("checklistDriver.create should not be called for completed assignment");
            },
          },
        };
        return callback(tx);
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const result = await service.confirmChecklistDriver(
        "GRP-PRISMA",
        createConfirmChecklistPayload({
          activity: " City Tour ",
          tripLabel: " Madinah City Tour ",
          requiredBusCount: 1,
          scheduledTime: " 10:00 ",
          transferByTrain: false,
          trainDepartureTime: "",
          stationPickupTime: "",
        }),
      );

      assert.equal(assignmentFieldUpdateCalls, 1);
      assert.equal(statusUpdateCalls, 0);
      assert.equal(result.status, ChecklistAssignmentStatus.ASSIGNED);
      assert.equal(result.drivers.length, 1);
    } finally {
      restore();
    }
  }
}

async function testPrismaResetChecklistDriverPaths(): Promise<void> {
  {
    const prismaMock = {
      group: {
        findFirst: async () => ({
          id: "grp-1",
          code: "GRP-PRISMA",
        }),
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
        callback({
          $executeRaw: async () => 1,
          checklistAssignment: {
            findFirst: async () => null,
          },
        }),
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      await assert.rejects(
        () =>
          service.resetChecklistDriver(
            "GRP-PRISMA",
            createResetChecklistPayload({
              activity: "Transfer",
            }),
          ),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /Checklist assignment/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }

  {
    let findFirstArgs: Record<string, unknown> | null = null;
    let deletedAssignmentId: string | null = null;
    const prismaMock = {
      group: {
        findFirst: async () => ({
          id: "grp-1",
          code: "GRP-PRISMA",
        }),
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          $executeRaw: async () => 1,
          checklistAssignment: {
            findFirst: async (args: Record<string, unknown>) => {
              findFirstArgs = args;
              return {
                id: "assign-1",
                tripDate: new Date("2026-05-20T00:00:00.000Z"),
                activity: "Transfer",
                tripLabel: "Makkah to Madinah",
                requiredBusCount: 2,
                scheduledTime: "08:00",
                transferByTrain: true,
                trainDepartureTime: "09:00",
                stationPickupTime: "07:00",
                status: ChecklistAssignmentStatus.ASSIGNED,
                drivers: [
                  {
                    slotNumber: 1,
                    name: "Driver One",
                    phone: "+62-888-111",
                    plateNumber: "B 1234 CD",
                    isVerified: true,
                  },
                ],
              };
            },
            update: async () => ({
              id: "assign-1",
              tripDate: new Date("2026-05-20T00:00:00.000Z"),
              activity: "Transfer",
              tripLabel: "Makkah to Madinah",
              requiredBusCount: 2,
              scheduledTime: "08:00",
              transferByTrain: true,
              trainDepartureTime: "09:00",
              stationPickupTime: "07:00",
              status: ChecklistAssignmentStatus.NOT_COMPLETE,
              drivers: [],
            }),
          },
          checklistDriver: {
            deleteMany: async (args: { where: { checklistAssignmentId: string } }) => {
              deletedAssignmentId = args.where.checklistAssignmentId;
              return { count: 1 };
            },
          },
        };
        return callback(tx);
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const result = await service.resetChecklistDriver(
        "GRP-PRISMA",
        createResetChecklistPayload({
          activity: " transfer ",
        }),
      );

      assert.ok(findFirstArgs);
      const where = (findFirstArgs as { where: Record<string, unknown> }).where;
      assert.equal(
        (
          where.activity as {
            equals: string;
            mode: string;
          }
        ).equals,
        "transfer",
      );
      assert.equal((where.activity as { mode: string }).mode, "insensitive");
      assert.equal(deletedAssignmentId, "assign-1");
      assert.equal(result.status, ChecklistAssignmentStatus.NOT_COMPLETE);
      assert.equal(result.drivers.length, 0);
    } finally {
      restore();
    }
  }

  {
    let findFirstArgs: Record<string, unknown> | null = null;
    const prismaMock = {
      group: {
        findFirst: async () => ({
          id: "grp-1",
          code: "GRP-PRISMA",
        }),
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
        const tx = {
          $executeRaw: async () => 1,
          checklistAssignment: {
            findFirst: async (args: Record<string, unknown>) => {
              findFirstArgs = args;
              return {
                id: "assign-2",
                tripDate: new Date("2026-05-20T00:00:00.000Z"),
                activity: "Arrival",
                tripLabel: "Arrival",
                requiredBusCount: 1,
                scheduledTime: "08:00",
                transferByTrain: false,
                trainDepartureTime: null,
                stationPickupTime: null,
                status: ChecklistAssignmentStatus.ASSIGNED,
                drivers: [],
              };
            },
            update: async () => ({
              id: "assign-2",
              tripDate: new Date("2026-05-20T00:00:00.000Z"),
              activity: "Arrival",
              tripLabel: "Arrival",
              requiredBusCount: 1,
              scheduledTime: "08:00",
              transferByTrain: false,
              trainDepartureTime: null,
              stationPickupTime: null,
              status: ChecklistAssignmentStatus.NOT_COMPLETE,
              drivers: [],
            }),
          },
          checklistDriver: {
            deleteMany: async () => ({ count: 0 }),
          },
        };
        return callback(tx);
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const result = await service.resetChecklistDriver("GRP-PRISMA", createResetChecklistPayload());
      assert.ok(findFirstArgs);
      const where = (findFirstArgs as { where: Record<string, unknown> }).where;
      assert.equal(Object.prototype.hasOwnProperty.call(where, "activity"), false);
      assert.equal(result.status, ChecklistAssignmentStatus.NOT_COMPLETE);
      assert.equal(result.drivers.length, 0);
    } finally {
      restore();
    }
  }
}

async function testPrismaChecklistAuditLogsUseGroupCodeIdentity(): Promise<void> {
  let auditCreateArgs: Record<string, unknown> | null = null;
  let assignmentStatus: ChecklistAssignmentStatus = ChecklistAssignmentStatus.NOT_COMPLETE;

  const prismaMock = {
    group: {
      findFirst: async () => ({
        id: "grp-1",
        code: "GRP-PRISMA",
      }),
    },
    groupAuditLog: {
      create: async (args: Record<string, unknown>) => {
        auditCreateArgs = args;
        return {};
      },
      findMany: async () => [],
    },
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const tx = {
        $executeRaw: async () => 1,
        checklistAssignment: {
          findFirst: async () => ({
            id: "assign-1",
            tripDate: new Date("2026-05-20T00:00:00.000Z"),
            activity: "Transfer",
            tripLabel: "Makkah to Madinah",
            requiredBusCount: 1,
            scheduledTime: "08:00",
            transferByTrain: false,
            trainDepartureTime: null,
            stationPickupTime: null,
            status: assignmentStatus,
            drivers: [],
          }),
          update: async (args: Record<string, unknown>) => {
            const data = (args as { data?: { status?: ChecklistAssignmentStatus } }).data;
            if (data?.status) {
              assignmentStatus = data.status;
            }

            return {
              id: "assign-1",
              tripDate: new Date("2026-05-20T00:00:00.000Z"),
              activity: "Transfer",
              tripLabel: "Makkah to Madinah",
              requiredBusCount: 1,
              scheduledTime: "08:00",
              transferByTrain: false,
              trainDepartureTime: null,
              stationPickupTime: null,
              status: assignmentStatus,
              drivers:
                assignmentStatus === ChecklistAssignmentStatus.ASSIGNED
                  ? [
                      {
                        slotNumber: 1,
                        name: "Driver One",
                        phone: "+62-888-111",
                        plateNumber: "B 1234 CD",
                        isVerified: true,
                      },
                    ]
                  : [],
            };
          },
          findUniqueOrThrow: async () => ({
            id: "assign-1",
            tripDate: new Date("2026-05-20T00:00:00.000Z"),
            activity: "Transfer",
            tripLabel: "Makkah to Madinah",
            requiredBusCount: 1,
            scheduledTime: "08:00",
            transferByTrain: false,
            trainDepartureTime: null,
            stationPickupTime: null,
            status: assignmentStatus,
            drivers: [
              {
                slotNumber: 1,
                name: "Driver One",
                phone: "+62-888-111",
                plateNumber: "B 1234 CD",
                isVerified: true,
              },
            ],
          }),
        },
        checklistDriver: {
          create: async () => ({ id: "driver-1" }),
        },
      };
      return callback(tx);
    },
  } as unknown as PrismaService;

  const { service, restore } = createPrismaGroupsService(prismaMock);
  try {
    const result = await service.confirmChecklistDriver(
      "GRP-PRISMA",
      createConfirmChecklistPayload({
        requiredBusCount: 1,
        transferByTrain: false,
        trainDepartureTime: "",
        stationPickupTime: "",
      }),
    );

    assert.equal(result.groupCode, "GRP-PRISMA");
    assert.equal(result.status, ChecklistAssignmentStatus.ASSIGNED);
    assert.ok(auditCreateArgs);

    const auditData = (auditCreateArgs as {
      data: {
        groupId?: string;
        groupCode?: string;
        action?: string;
        entity?: string;
        payload?: {
          assignmentId?: string;
          slotCount?: number;
        };
      };
    }).data;

    assert.equal(auditData.groupId, undefined);
    assert.equal(auditData.groupCode, "GRP-PRISMA");
    assert.equal(auditData.action, "checklist.driver.confirmed");
    assert.equal(auditData.entity, "checklistAssignment");
    assert.equal(auditData.payload?.assignmentId, "assign-1");
    assert.equal(auditData.payload?.slotCount, 1);
  } finally {
    restore();
  }
}

async function testPrismaListAuditLogsReadsPersistentEntries(): Promise<void> {
  let findManyArgs: Record<string, unknown> | null = null;
  const prismaMock = {
    groupAuditLog: {
      create: async () => ({}),
      findMany: async (args: Record<string, unknown>) => {
        findManyArgs = args;
        return [
          {
            id: "audit-1",
            groupCode: "GRP-PRISMA",
            action: "group.updated",
            entity: "group",
            payload: {
              idOrCode: "GRP-PRISMA",
              updatedFields: ["name"],
            },
            createdAt: new Date("2026-05-21T10:00:00.000Z"),
          },
        ];
      },
    },
  } as unknown as PrismaService;

  const { service, restore } = createPrismaGroupsService(prismaMock);
  try {
    const logs = await service.listAuditLogs(" grp-prisma ", 5);
    assert.ok(findManyArgs);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].groupCode, "GRP-PRISMA");
    assert.equal(logs[0].action, "group.updated");
    assert.deepEqual(logs[0].payload, {
      idOrCode: "GRP-PRISMA",
      updatedFields: ["name"],
    });
    assert.deepEqual(findManyArgs, {
      where: {
        groupCode: "GRP-PRISMA",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      select: {
        id: true,
        groupCode: true,
        action: true,
        entity: true,
        payload: true,
        createdAt: true,
      },
    });
  } finally {
    restore();
  }
}

async function main(): Promise<void> {
  await runCase("groups prisma findAll where + pagination branches", testPrismaFindAllWhereAndPaginationBranches);
  await runCase("groups prisma confirm checklist driver paths", testPrismaConfirmChecklistDriverPaths);
  await runCase("groups prisma reset checklist driver paths", testPrismaResetChecklistDriverPaths);
  await runCase("groups prisma checklist audit logs use group code identity", testPrismaChecklistAuditLogsUseGroupCodeIdentity);
  await runCase("groups prisma listAuditLogs reads persistent entries", testPrismaListAuditLogsReadsPersistentEntries);
}

void main().catch((error: unknown) => {
  console.error("Groups prisma list/checklist test failed:", error);
  process.exitCode = 1;
});
