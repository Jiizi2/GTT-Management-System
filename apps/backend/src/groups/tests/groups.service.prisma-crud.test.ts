import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AgreementCity, GroupLifecycleStatus, Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreateGroupDto } from "../dto/create-group.dto";
import { GroupsService } from "../application/groups.service";

type PrismaGroupRecord = {
  id: string;
  code: string;
  name?: string;
  status?: string;
  packageName?: string;
  arrivalDate: Date;
  returnDate: Date;
};

type PrismaFindFirstArgs = {
  include?: unknown;
  select?: Record<string, unknown>;
};

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

function createGroupFindFirstMock(
  handlers: {
    includeLookup?: () => PrismaGroupRecord | null;
    selectLookup?: (select: Record<string, unknown>) => PrismaGroupRecord | { id: string } | null;
  },
): (args: PrismaFindFirstArgs) => Promise<unknown> {
  return async (args: PrismaFindFirstArgs) => {
    if (args.include) {
      return handlers.includeLookup ? handlers.includeLookup() : null;
    }

    const select = args.select ?? {};
    return handlers.selectLookup ? handlers.selectLookup(select) : null;
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

function createGroupPayload(overrides: Partial<CreateGroupDto> = {}): CreateGroupDto {
  return {
    code: "GRP-BASE",
    name: "Base Group",
    status: "Active",
    arrivalDate: "2026-04-10",
    returnDate: "2026-04-18",
    pax: 40,
    packageName: "Base Package",
    durationDays: 9,
    timeline: [],
    itinerary: [],
    notes: [],
    checklistAssignments: [],
    ...overrides,
  };
}

describe("GroupsServicePrismaCrud", () => {
  runCase("groups prisma create success and conflict guard", async () => {
    {
      let createPayload: Record<string, unknown> | null = null;
      let hotelDraftUpdateManyCalls = 0;
      const tx = {
        group: {
          create: async (args: Record<string, unknown>) => {
            createPayload = args;
            return {
              id: "grp-1",
              code: "GRP-CREATE",
            };
          },
        },
        hotelAgreementDraft: {
          updateMany: async () => {
            hotelDraftUpdateManyCalls += 1;
            return { count: 1 };
          },
        },
      };
      const prismaMock = {
        ...tx,
        $transaction: async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx),
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const created = (await service.create(
          createGroupPayload({
            code: " grp-create ",
            name: " Group Create ",
            packageName: " Premium Package ",
            visaSetup: {
              syarikah: "Nusuk Premium",
              hotelAgreements: [
                {
                  city: AgreementCity.MAKKAH,
                  sourceDraftId: "draft-makkah-1",
                  hotelName: "Makkah Hotel",
                  agreementNumber: "AG-MAK-1",
                  pax: 40,
                  stayStart: "2026-04-10",
                  stayEnd: "2026-04-13",
                },
              ],
            },
          }),
        )) as { code?: string };

        expect(created.code).toBe("GRP-CREATE");
        expect(createPayload).toBeTruthy();
        const data = (createPayload as {
          data: {
            code?: string;
            name?: string;
            packageName?: string;
            searchDocument?: string;
            visaSetup?: { create?: { hotelAgreements?: { create?: Array<{ sourceDraftId?: string | null }> } } };
          };
        }).data;
        expect(data.code).toBe("GRP-CREATE");
        expect(data.name).toBe("Group Create");
        expect(data.packageName).toBe("Premium Package");
        expect(
          data.searchDocument,
        ).toBe(
          "grp create grpcreate group create groupcreate active premium package premiumpackage",
        );
        expect(data.visaSetup?.create?.hotelAgreements?.create?.[0]?.sourceDraftId).toBe("draft-makkah-1");
        expect(hotelDraftUpdateManyCalls).toBe(0);
      } finally {
        restore();
      }
    }

    {
      let createPayload: Record<string, unknown> | null = null;
      const tx = {
        group: {
          create: async (args: Record<string, unknown>) => {
            createPayload = args;
            return {
              id: "grp-child",
              code: "GRP-CHILD",
            };
          },
        },
      };
      const prismaMock = {
        group: {
          findFirst: async () => ({
            id: "parent-id-1",
            code: "GRP-PARENT",
            parentGroupId: null,
          }),
        },
        $transaction: async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx),
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const created = (await service.create(
          createGroupPayload({
            code: "grp-child",
            parentGroupId: "GRP-PARENT",
          }),
        )) as { code?: string };

        expect(created.code).toBe("GRP-CHILD");
        expect(createPayload).toBeTruthy();
        const data = (createPayload as { data: { parentGroupId?: string | null } }).data;
        expect(data.parentGroupId).toBe("parent-id-1");
      } finally {
        restore();
      }
    }

    {
      let transactionCalls = 0;
      const prismaMock = {
        group: {
          findFirst: async () => ({
            id: "grp-child-parent",
            code: "GRP-CHILD-PARENT",
            parentGroupId: "grp-grandparent",
          }),
        },
        $transaction: async () => {
          transactionCalls += 1;
          throw new Error("grandchild create should be rejected before transaction");
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.create(
              createGroupPayload({
                code: "GRP-GRANDCHILD",
                parentGroupId: "GRP-CHILD-PARENT",
              }),
            ),
        ).rejects.toThrow(/cannot be used as parent/i);
        expect(transactionCalls).toBe(0);
      } finally {
        restore();
      }
    }

    {
      const tx = {
        group: {
          create: async () => {
            throw createPrismaKnownRequestError("P2002", "duplicate code");
          },
        },
      };
      const prismaMock = {
        ...tx,
        $transaction: async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx),
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.create(
              createGroupPayload({
                code: "GRP-CREATE",
              }),
            ),
        ).rejects.toThrow(ConflictException);
      } finally {
        restore();
      }
    }
  });

  runCase("groups prisma replace success and guards", async () => {
    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => null,
          }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.replace(
              "GRP-MISSING",
              createGroupPayload({
                code: "GRP-MISSING",
              }),
            ),
        ).rejects.toThrow(/not found/i);
      } finally {
        restore();
      }
    }

    {
      const current = {
        id: "grp-1",
        code: "GRP-OLD",
        itinerary: [],
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => current,
          }),
          findUnique: async () => ({ id: "grp-2" }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.replace(
              "GRP-OLD",
              createGroupPayload({
                code: "GRP-DUPLICATE",
              }),
            ),
        ).rejects.toThrow(ConflictException);
      } finally {
        restore();
      }
    }

    {
      let findUniqueOrThrowCalls = 0;
      const current = {
        id: "grp-1",
        code: "GRP-REPLACE",
        itinerary: [],
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => current,
          }),
        },
        $transaction: async (
          callback: (tx: {
            checklistAssignment: { deleteMany: (args: unknown) => Promise<unknown> };
            itineraryItem: { deleteMany: (args: unknown) => Promise<unknown> };
            groupTimelineItem: { deleteMany: (args: unknown) => Promise<unknown> };
            groupNote: { deleteMany: (args: unknown) => Promise<unknown> };
            nextActivity: { deleteMany: (args: unknown) => Promise<unknown> };
            musyrif: { deleteMany: (args: unknown) => Promise<unknown> };
            visaSetup: { deleteMany: (args: unknown) => Promise<unknown> };
            group: {
              update: (args: unknown) => Promise<unknown>;
              findUniqueOrThrow: (args: unknown) => Promise<unknown>;
            };
          }) => Promise<unknown>,
        ) => {
          const tx = {
            checklistAssignment: { deleteMany: async () => ({ count: 0 }) },
            itineraryItem: { deleteMany: async () => ({ count: 0 }) },
            groupTimelineItem: { deleteMany: async () => ({ count: 0 }) },
            groupNote: { deleteMany: async () => ({ count: 0 }) },
            nextActivity: { deleteMany: async () => ({ count: 0 }) },
            musyrif: { deleteMany: async () => ({ count: 0 }) },
            visaSetup: { deleteMany: async () => ({ count: 0 }) },
            group: {
              update: async () => ({
                id: "grp-1",
                code: "GRP-REPLACE",
                itinerary: [],
                checklistAssignments: [],
              }),
              findUniqueOrThrow: async () => {
                findUniqueOrThrowCalls += 1;
                return { id: "grp-1", code: "GRP-REPLACE" };
              },
            },
          };
          return callback(tx);
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const replaced = (await service.replace(
          "GRP-REPLACE",
          createGroupPayload({
            code: "GRP-REPLACE",
            checklistAssignments: [],
          }),
        )) as { code?: string };
        expect(replaced.code).toBe("GRP-REPLACE");
        expect(findUniqueOrThrowCalls).toBe(0);
      } finally {
        restore();
      }
    }

    {
      let relinkUpdateCalls = 0;
      let findUniqueOrThrowCalls = 0;
      const current = {
        id: "grp-1",
        code: "GRP-RELINK",
        itinerary: [{ id: "legacy-itinerary-3", sortOrder: 3 }],
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => current,
          }),
        },
        $transaction: async (
          callback: (tx: {
            checklistAssignment: {
              deleteMany: (args: unknown) => Promise<unknown>;
              update: (args: { where: { id: string }; data: { itineraryItemId: string } }) => Promise<unknown>;
            };
            itineraryItem: { deleteMany: (args: unknown) => Promise<unknown> };
            groupTimelineItem: { deleteMany: (args: unknown) => Promise<unknown> };
            groupNote: { deleteMany: (args: unknown) => Promise<unknown> };
            nextActivity: { deleteMany: (args: unknown) => Promise<unknown> };
            musyrif: { deleteMany: (args: unknown) => Promise<unknown> };
            visaSetup: { deleteMany: (args: unknown) => Promise<unknown> };
            group: {
              update: (args: unknown) => Promise<unknown>;
              findUniqueOrThrow: (args: unknown) => Promise<unknown>;
            };
          }) => Promise<unknown>,
        ) => {
          const tx = {
            checklistAssignment: {
              deleteMany: async () => ({ count: 0 }),
              update: async () => {
                relinkUpdateCalls += 1;
                return {};
              },
            },
            itineraryItem: { deleteMany: async () => ({ count: 0 }) },
            groupTimelineItem: { deleteMany: async () => ({ count: 0 }) },
            groupNote: { deleteMany: async () => ({ count: 0 }) },
            nextActivity: { deleteMany: async () => ({ count: 0 }) },
            musyrif: { deleteMany: async () => ({ count: 0 }) },
            visaSetup: { deleteMany: async () => ({ count: 0 }) },
            group: {
              update: async () => ({
                id: "grp-1",
                code: "GRP-RELINK",
                itinerary: [{ id: "new-itinerary-3", sortOrder: 3 }],
                checklistAssignments: [
                  {
                    id: "check-1",
                    itineraryItemId: null,
                    tripDate: new Date("2026-04-12T00:00:00.000Z"),
                    scheduledTime: "08:00",
                    activity: "Arrival",
                    tripLabel: "Arrival Trip",
                  },
                ],
              }),
              findUniqueOrThrow: async () => {
                findUniqueOrThrowCalls += 1;
                return { id: "grp-1", code: "GRP-RELINK" };
              },
            },
          };
          return callback(tx);
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const replaced = (await service.replace(
          "GRP-RELINK",
          createGroupPayload({
            code: "GRP-RELINK",
            checklistAssignments: [
              {
                itineraryItemId: "legacy-itinerary-3",
                tripDate: "2026-04-12",
                activity: "Arrival",
                tripLabel: "Arrival Trip",
                requiredBusCount: 1,
                scheduledTime: "08:00",
                drivers: [],
              },
            ],
          }),
        )) as { code?: string };
        expect(replaced.code).toBe("GRP-RELINK");
        expect(relinkUpdateCalls).toBe(1);
        expect(findUniqueOrThrowCalls).toBe(1);
      } finally {
        restore();
      }
    }
  });

  runCase("groups prisma update success and guards", async () => {
    {
      let updatedPayload: Record<string, unknown> | null = null;
      const currentGroup: PrismaGroupRecord = {
        id: "grp-1",
        code: "GRP-OLD",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => currentGroup,
          }),
          findUnique: async () => null,
          update: async (args: Record<string, unknown>) => {
            updatedPayload = args;
            return {
              id: "grp-1",
              code: "GRP-NEW",
            };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const updated = (await service.update("GRP-OLD", {
          code: " grp-new ",
          name: " Updated Group ",
          status: " Active ",
          arrivalDate: "2026-04-11",
          returnDate: "2026-04-19",
          packageName: " Premium ",
          durationDays: 10,
        })) as { code?: string };

        expect(updated.code).toBe("GRP-NEW");
        expect(updatedPayload).toBeTruthy();
        const where = (updatedPayload as { where: { id: string } }).where;
        const data = (updatedPayload as {
          data: {
            code?: string;
            name?: string;
            status?: string;
            lifecycleStatus?: GroupLifecycleStatus;
            searchDocument?: string;
            arrivalDate?: Date;
            returnDate?: Date;
            packageName?: string;
            durationDays?: number;
          };
        }).data;
        expect(where.id).toBe("grp-1");
        expect(data.code).toBe("GRP-NEW");
        expect(data.name).toBe("Updated Group");
        expect(data.status).toBe("Active");
        expect(data.lifecycleStatus).toBe(GroupLifecycleStatus.ACTIVE);
        expect(data.packageName).toBe("Premium");
        expect(
          data.searchDocument,
        ).toBe(
          "grp new grpnew updated group updatedgroup active premium",
        );
        expect(data.durationDays).toBe(10);
        expect(data.arrivalDate?.toISOString().slice(0, 10)).toBe("2026-04-11");
        expect(data.returnDate?.toISOString().slice(0, 10)).toBe("2026-04-19");
      } finally {
        restore();
      }
    }

    {
      let updatedPayload: Record<string, unknown> | null = null;
      const currentGroup: PrismaGroupRecord = {
        id: "grp-1",
        code: "GRP-OLD",
        name: "Old Group",
        status: "Active",
        packageName: "Pending Package",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => currentGroup,
          }),
          update: async (args: Record<string, unknown>) => {
            updatedPayload = args;
            return {
              id: "grp-1",
              code: "GRP-OLD",
            };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await service.update("GRP-OLD", {
          lifecycleStatus: GroupLifecycleStatus.COMPLETED,
        });

        expect(updatedPayload).toBeTruthy();
        const data = (updatedPayload as {
          data: {
            status?: string;
            lifecycleStatus?: GroupLifecycleStatus;
            searchDocument?: string;
          };
        }).data;
        expect(data.status).toBe("Completed");
        expect(data.lifecycleStatus).toBe(GroupLifecycleStatus.COMPLETED);
        expect(data.searchDocument).toBe("grp old grpold old group oldgroup completed pending package pendingpackage");
      } finally {
        restore();
      }
    }

    {
      const currentGroup: PrismaGroupRecord = {
        id: "grp-1",
        code: "GRP-OLD",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => currentGroup,
          }),
          findUnique: async () => ({ id: "grp-2" }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.update("GRP-OLD", {
              code: "GRP-DUPLICATE",
            }),
        ).rejects.toThrow(ConflictException);
      } finally {
        restore();
      }
    }

    {
      let updateCalls = 0;
      const currentGroup: PrismaGroupRecord = {
        id: "grp-parent",
        code: "GRP-PARENT",
        name: "Parent Group",
        status: "Active",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
      };
      const prismaMock = {
        group: {
          findFirst: async (args: { where?: { OR?: Array<{ id?: string; code?: string }> } }) => {
            const lookupValues = args.where?.OR ?? [];
            if (lookupValues.some((item) => item.id === "GRP-PARENT" || item.code === "GRP-PARENT")) {
              return currentGroup;
            }

            return {
              id: "grp-other-parent",
              code: "GRP-OTHER-PARENT",
              parentGroupId: null,
            };
          },
          findUnique: async () => null,
          count: async () => 1,
          update: async () => {
            updateCalls += 1;
            throw new Error("group with children should not become a child");
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.update("GRP-PARENT", {
              parentGroupId: "GRP-OTHER-PARENT",
            }),
        ).rejects.toThrow(/already has child groups/i);
        expect(updateCalls).toBe(0);
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => null,
          }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.update("GRP-MISSING", {
              name: "Missing",
            }),
        ).rejects.toThrow(/not found/i);
      } finally {
        restore();
      }
    }

    {
      const currentGroup: PrismaGroupRecord = {
        id: "grp-1",
        code: "GRP-OLD",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            selectLookup: () => currentGroup,
          }),
          findUnique: async () => null,
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.update("GRP-OLD", {
              arrivalDate: "2026-04-20",
              returnDate: "2026-04-19",
            }),
        ).rejects.toThrow(/Return date must be on or after arrival date/i);
      } finally {
        restore();
      }
    }
  });

  runCase("groups prisma remove success and not-found guards", async () => {
    {
      let deletedGroupId: string | null = null;
      let auditCreateArgs: Record<string, unknown> | null = null;
      const existingGroup: PrismaGroupRecord = {
        id: "grp-1",
        code: "GRP-REMOVE",
        name: "Group Remove",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
        status: "Active",
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            includeLookup: () => existingGroup,
            selectLookup: (select) => ("code" in select ? existingGroup : { id: "grp-1" }),
          }),
          delete: async (args: { where: { id: string } }) => {
            deletedGroupId = args.where.id;
            return {};
          },
          count: async () => 0,
        },
        groupAuditLog: {
          create: async (args: Record<string, unknown>) => {
            auditCreateArgs = args;
            return {};
          },
          findMany: async () => [],
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await service.remove("GRP-REMOVE");
        expect(deletedGroupId).toBe("grp-1");
        expect(auditCreateArgs).toBeTruthy();
        const auditData = (auditCreateArgs as {
          data: {
            groupId?: string;
            groupCode?: string;
            action?: string;
          };
        }).data;
        expect(auditData.groupId).toBe(undefined);
        expect(auditData.groupCode).toBe("GRP-REMOVE");
        expect(auditData.action).toBe("group.deleted");
      } finally {
        restore();
      }
    }

    {
      let deleteCalls = 0;
      const existingGroup: PrismaGroupRecord = {
        id: "grp-parent",
        code: "GRP-PARENT",
        name: "Parent Group",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
        status: "Active",
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            includeLookup: () => existingGroup,
            selectLookup: () => existingGroup,
          }),
          count: async () => 1,
          delete: async () => {
            deleteCalls += 1;
            throw new Error("parent with children should not be deleted");
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () => service.remove("GRP-PARENT"),
        ).rejects.toThrow(/still has child groups/i);
        expect(deleteCalls).toBe(0);
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            includeLookup: () => null,
          }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () => service.remove("GRP-MISSING"),
        ).rejects.toThrow(/not found/i);
      } finally {
        restore();
      }
    }

    {
      const existingGroup: PrismaGroupRecord = {
        id: "grp-1",
        code: "GRP-REMOVE",
        name: "Group Remove",
        arrivalDate: new Date("2026-04-10T00:00:00.000Z"),
        returnDate: new Date("2026-04-18T00:00:00.000Z"),
        status: "Active",
      };
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock({
            includeLookup: () => existingGroup,
            selectLookup: () => null,
          }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () => service.remove("GRP-REMOVE"),
        ).rejects.toThrow(/not found/i);
      } finally {
        restore();
      }
    }
  });
});
