import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import { NotFoundException } from "@nestjs/common";
import { ChecklistAssignmentStatus, GroupTone, Prisma, VisaPaymentStatus, VisaStatus } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { GroupsService } from "../application/groups.service";
import { PrismaGroupRepository } from "../../infrastructure/repositories/prisma/prisma-group.repository";

function createPrismaGroupsService(prismaMock: PrismaService): { service: GroupsService; restore: () => void } {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "prisma";
  const prismaRecord = prismaMock as unknown as Record<string, unknown>;
  prismaRecord.groupAuditLog ??= {
    create: async () => ({}),
    findMany: async () => [],
  };
  const service = new GroupsService(new PrismaGroupRepository(prismaMock));

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

describe("GroupsServicePrismaListChecklist", () => {
  runCase("groups prisma findAll where + pagination branches", async () => {
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

        expect(items.length).toBe(1);
        expect(items[0].code).toBe("GRP-1");
        expect(findManyCalls.length).toBe(1);
        expect(
          Boolean((findManyCalls[0] as { select?: unknown }).select),
        ).toBe(true);

        const where = (findManyCalls[0] as {
          where?: {
            AND: Array<{ OR: Array<Record<string, unknown>> }>;
          };
        }).where;
        expect(where).toBeTruthy();
        expect(where?.AND.length).toBe(2);

        const queryCondition = where?.AND[0] as unknown as {
          AND: Array<{
            searchDocument?: { contains: string; mode: string };
          }>;
        };
        expect(queryCondition.AND.length).toBe(1);
        expect(queryCondition.AND[0].searchDocument?.contains).toBe("grp");
        expect(queryCondition.AND[0].searchDocument?.mode).toBe("insensitive");

        const filterCondition = where?.AND[1] as {
          OR: Array<{
            visaSetup: { is: unknown };
          }>;
        };
        expect(filterCondition.OR[0].visaSetup.is).toBe(null);
        expect(
          (
            filterCondition.OR[1].visaSetup.is as {
              visaStatus: { not: VisaStatus };
            }
          ).visaStatus.not,
        ).toBe(VisaStatus.ISSUED);
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
        expect(summaryItems.length).toBe(1);
        expect(summaryItems[0].code).toBe("GRP-SUMMARY");
        expect(summaryFindManyArgs).toBeTruthy();
        const summarySelect = (summaryFindManyArgs as { select?: Record<string, unknown> }).select ?? {};
        expect(Object.prototype.hasOwnProperty.call(summarySelect, "itinerary")).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(summarySelect, "notes")).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(summarySelect, "visaSetup")).toBe(true);
        expect(Object.prototype.hasOwnProperty.call(summarySelect, "checklistAssignments")).toBe(false);
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
        expect(searchWhere).toBeTruthy();
        const tokenCondition = searchWhere?.AND[0];
        expect(tokenCondition?.AND).toEqual([
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

        expect(paged.total).toBe(11);
        expect(paged.page).toBe(2);
        expect(paged.pageSize).toBe(3);
        expect(paged.items.length).toBe(1);
        expect(paged.items[0].code).toBe("GRP-2");
        expect(findManyArgs).toBeTruthy();
        expect((findManyArgs as { skip: number }).skip).toBe(3);
        expect((findManyArgs as { take: number }).take).toBe(3);
        expect(
          Boolean((findManyArgs as { select?: unknown }).select),
        ).toBe(true);

        const where = countWhere as {
          AND: Array<{
            OR: Array<{ visaSetup: { is: unknown } }>;
          }>;
        };
        expect(where.AND.length).toBe(1);
        const missingHotelCondition = where.AND[0];
        expect(missingHotelCondition.OR.length).toBe(3);
        expect(missingHotelCondition.OR[0].visaSetup.is).toBe(null);
        expect(
          (
            missingHotelCondition.OR[1].visaSetup.is as {
              hotelAgreements: { none: { city: string } };
            }
          ).hotelAgreements.none,
        ).toEqual({ city: "MAKKAH" });
        expect(
          (
            missingHotelCondition.OR[2].visaSetup.is as {
              hotelAgreements: { none: { city: string } };
            }
          ).hotelAgreements.none,
        ).toEqual({ city: "MADINAH" });
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
        expect(items.length).toBe(0);

        const unpaidCondition = (whereUsed as {
          AND: Array<{
            OR: Array<{ visaSetup: { is: unknown } }>;
          }>;
        }).AND[0];
        expect(unpaidCondition.OR[0].visaSetup.is).toBe(null);
        expect(
          (
            unpaidCondition.OR[1].visaSetup.is as {
              paymentStatus: { not: VisaPaymentStatus };
            }
          ).paymentStatus.not,
        ).toBe(VisaPaymentStatus.PAID);
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
        expect(whereUsed).toBe(undefined);
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
        expect(items.length).toBe(0);
        expect(whereUsed).toEqual({
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
  });

  runCase("groups prisma confirm checklist driver paths", async () => {
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

        expect(checklistDriverCreateCalls).toBe(2);
        expect(lockCalls).toBe(1);
        expect(assignmentCreatePayload).toBeTruthy();
        expect(statusUpdatePayload).toBeTruthy();

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
        expect(createData.activity).toBe("Transfer");
        expect(createData.tripLabel).toBe("Makkah to Madinah");
        expect(createData.requiredBusCount).toBe(2);
        expect(createData.scheduledTime).toBe("08:00");
        expect(createData.transferByTrain).toBe(true);
        expect(createData.trainDepartureTime).toBe("09:00");
        expect(createData.stationPickupTime).toBe("07:00");

        const statusData = (statusUpdatePayload as {
          data: { status: ChecklistAssignmentStatus };
        }).data;
        expect(statusData.status).toBe(ChecklistAssignmentStatus.ASSIGNED);
        expect(result.groupCode).toBe("GRP-PRISMA");
        expect(result.status).toBe(ChecklistAssignmentStatus.ASSIGNED);
        expect(result.drivers.length).toBe(2);
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

        expect(assignmentFieldUpdateCalls).toBe(1);
        expect(statusUpdateCalls).toBe(0);
        expect(result.status).toBe(ChecklistAssignmentStatus.ASSIGNED);
        expect(result.drivers.length).toBe(1);
      } finally {
        restore();
      }
    }
  });

  runCase("groups prisma reset checklist driver paths", async () => {
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
        await expect(
          () =>
            service.resetChecklistDriver(
              "GRP-PRISMA",
              createResetChecklistPayload({
                activity: "Transfer",
              }),
            ),
        ).rejects.toThrow(/Checklist assignment/i);
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

        expect(findFirstArgs).toBeTruthy();
        const where = (findFirstArgs as { where: Record<string, unknown> }).where;
        expect(
          (
            where.activity as {
              equals: string;
              mode: string;
            }
          ).equals,
        ).toBe("transfer");
        expect((where.activity as { mode: string }).mode).toBe("insensitive");
        expect(deletedAssignmentId).toBe("assign-1");
        expect(result.status).toBe(ChecklistAssignmentStatus.NOT_COMPLETE);
        expect(result.drivers.length).toBe(0);
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
        expect(findFirstArgs).toBeTruthy();
        const where = (findFirstArgs as { where: Record<string, unknown> }).where;
        expect(Object.prototype.hasOwnProperty.call(where, "activity")).toBe(false);
        expect(result.status).toBe(ChecklistAssignmentStatus.NOT_COMPLETE);
        expect(result.drivers.length).toBe(0);
      } finally {
        restore();
      }
    }
  });

  runCase("groups prisma checklist audit logs use group code identity", async () => {
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

      expect(result.groupCode).toBe("GRP-PRISMA");
      expect(result.status).toBe(ChecklistAssignmentStatus.ASSIGNED);
      expect(auditCreateArgs).toBeTruthy();

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

      expect(auditData.groupId).toBe(undefined);
      expect(auditData.groupCode).toBe("GRP-PRISMA");
      expect(auditData.action).toBe("checklist.driver.confirmed");
      expect(auditData.entity).toBe("checklistAssignment");
      expect(auditData.payload?.assignmentId).toBe("assign-1");
      expect(auditData.payload?.slotCount).toBe(1);
    } finally {
      restore();
    }
  });

  runCase("groups prisma listAuditLogs reads persistent entries", async () => {
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
      expect(findManyArgs).toBeTruthy();
      expect(logs.length).toBe(1);
      expect(logs[0].groupCode).toBe("GRP-PRISMA");
      expect(logs[0].action).toBe("group.updated");
      expect(logs[0].payload).toEqual({
        idOrCode: "GRP-PRISMA",
        updatedFields: ["name"],
      });
      expect(findManyArgs).toEqual({
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
  });
});
