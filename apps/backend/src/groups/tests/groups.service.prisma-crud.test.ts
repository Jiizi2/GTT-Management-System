import assert from "node:assert/strict";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreateGroupDto } from "../dto/create-group.dto";
import { GroupsService } from "../application/groups.service";

type PrismaGroupRecord = {
  id: string;
  code: string;
  name?: string;
  status?: string;
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

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testPrismaCreateSuccessAndConflictGuard(): Promise<void> {
  {
    let createPayload: Record<string, unknown> | null = null;
    const prismaMock = {
      group: {
        create: async (args: Record<string, unknown>) => {
          createPayload = args;
          return {
            id: "grp-1",
            code: "GRP-CREATE",
          };
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const created = (await service.create(
        createGroupPayload({
          code: " grp-create ",
          name: " Group Create ",
          packageName: " Premium Package ",
        }),
      )) as { code?: string };

      assert.equal(created.code, "GRP-CREATE");
      assert.ok(createPayload);
      const data = (createPayload as {
        data: { code?: string; name?: string; packageName?: string; searchDocument?: string };
      }).data;
      assert.equal(data.code, "GRP-CREATE");
      assert.equal(data.name, "Group Create");
      assert.equal(data.packageName, "Premium Package");
      assert.equal(
        data.searchDocument,
        "grp create grpcreate group create groupcreate active premium package premiumpackage",
      );
    } finally {
      restore();
    }
  }

  {
    const prismaMock = {
      group: {
        create: async () => {
          throw createPrismaKnownRequestError("P2002", "duplicate code");
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      await assert.rejects(
        () =>
          service.create(
            createGroupPayload({
              code: "GRP-CREATE",
            }),
          ),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /already exists/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }
}

async function testPrismaReplaceSuccessAndGuards(): Promise<void> {
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
      await assert.rejects(
        () =>
          service.replace(
            "GRP-MISSING",
            createGroupPayload({
              code: "GRP-MISSING",
            }),
          ),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /not found/i);
          return true;
        },
      );
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
      await assert.rejects(
        () =>
          service.replace(
            "GRP-OLD",
            createGroupPayload({
              code: "GRP-DUPLICATE",
            }),
          ),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /already exists/i);
          return true;
        },
      );
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
      assert.equal(replaced.code, "GRP-REPLACE");
      assert.equal(findUniqueOrThrowCalls, 0);
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
      assert.equal(replaced.code, "GRP-RELINK");
      assert.equal(relinkUpdateCalls, 1);
      assert.equal(findUniqueOrThrowCalls, 1);
    } finally {
      restore();
    }
  }
}

async function testPrismaUpdateSuccessAndGuards(): Promise<void> {
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

      assert.equal(updated.code, "GRP-NEW");
      assert.ok(updatedPayload);
      const where = (updatedPayload as { where: { id: string } }).where;
      const data = (updatedPayload as {
        data: {
          code?: string;
          name?: string;
          status?: string;
          searchDocument?: string;
          arrivalDate?: Date;
          returnDate?: Date;
          packageName?: string;
          durationDays?: number;
        };
      }).data;
      assert.equal(where.id, "grp-1");
      assert.equal(data.code, "GRP-NEW");
      assert.equal(data.name, "Updated Group");
      assert.equal(data.status, "Active");
      assert.equal(data.packageName, "Premium");
      assert.equal(
        data.searchDocument,
        "grp new grpnew updated group updatedgroup active premium",
      );
      assert.equal(data.durationDays, 10);
      assert.equal(data.arrivalDate?.toISOString().slice(0, 10), "2026-04-11");
      assert.equal(data.returnDate?.toISOString().slice(0, 10), "2026-04-19");
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
      await assert.rejects(
        () =>
          service.update("GRP-OLD", {
            code: "GRP-DUPLICATE",
          }),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /already exists/i);
          return true;
        },
      );
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
      await assert.rejects(
        () =>
          service.update("GRP-MISSING", {
            name: "Missing",
          }),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /not found/i);
          return true;
        },
      );
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
      await assert.rejects(
        () =>
          service.update("GRP-OLD", {
            arrivalDate: "2026-04-20",
            returnDate: "2026-04-19",
          }),
        (error: unknown) => {
          assert.equal(error instanceof BadRequestException, true);
          assert.match((error as Error).message, /Return date must be on or after arrival date/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }
}

async function testPrismaRemoveSuccessAndNotFoundGuards(): Promise<void> {
  {
    let deletedGroupId: string | null = null;
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
          selectLookup: () => ({ id: "grp-1" }),
        }),
        delete: async (args: { where: { id: string } }) => {
          deletedGroupId = args.where.id;
          return {};
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      await service.remove("GRP-REMOVE");
      assert.equal(deletedGroupId, "grp-1");
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
      await assert.rejects(
        () => service.remove("GRP-MISSING"),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /not found/i);
          return true;
        },
      );
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
      await assert.rejects(
        () => service.remove("GRP-REMOVE"),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /not found/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }
}

async function main(): Promise<void> {
  await runCase("groups prisma create success and conflict guard", testPrismaCreateSuccessAndConflictGuard);
  await runCase("groups prisma replace success and guards", testPrismaReplaceSuccessAndGuards);
  await runCase("groups prisma update success and guards", testPrismaUpdateSuccessAndGuards);
  await runCase("groups prisma remove success and not-found guards", testPrismaRemoveSuccessAndNotFoundGuards);
}

void main().catch((error: unknown) => {
  console.error("Groups prisma CRUD test failed:", error);
  process.exitCode = 1;
});
