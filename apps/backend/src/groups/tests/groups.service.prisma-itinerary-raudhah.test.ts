import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { GroupRaudhahStatus, Prisma } from "@prisma/client";
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

function createGroupFindFirstMock() {
  return async (args: Record<string, unknown>) => {
    if ("select" in args) {
      return {
        id: "grp-1",
        code: "GRP-PRISMA",
      };
    }

    return {
      id: "grp-1",
      code: "GRP-PRISMA",
      itinerary: [],
      visaSetup: {
        raudhahAppointments: [],
      },
    };
  };
}

function createItineraryPayload(overrides: Partial<{
  sortOrder: number;
  dateLabel: string;
  yearLabel: string;
  category: string;
  categoryKey: string;
  title: string;
  meta: string;
  icon: string;
  highlighted: boolean;
  isoDate: string;
  time: string;
  fromLocation: string;
  toLocation: string;
  notes: string;
}> = {}) {
  return {
    dateLabel: " 10 Apr ",
    yearLabel: " 2026 ",
    category: " Arrival ",
    categoryKey: "arrival",
    title: " Arrival to Jeddah ",
    meta: " 07:30 | SV-827 ",
    icon: " flight_land ",
    highlighted: true,
    isoDate: "2026-04-10",
    time: "07:30",
    fromLocation: " JED Airport ",
    toLocation: " Makkah Hotel ",
    notes: " Handle luggage at gate 4 ",
    ...overrides,
  };
}

describe("GroupsServicePrismaItineraryRaudhah", () => {
  runCase("groups prisma add itinerary retry and conflict guards", async () => {
    {
      let createCalls = 0;
      let createdPayload: Record<string, unknown> | null = null;
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          findFirst: async (args: Record<string, unknown>) => {
            if ("orderBy" in args) {
              return {
                sortOrder: 2,
              };
            }

            return null;
          },
          create: async (args: Record<string, unknown>) => {
            createCalls += 1;
            if (createCalls === 1) {
              throw createPrismaKnownRequestError("P2002", "duplicate sort order");
            }

            createdPayload = args;
            return { id: "item-1" };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const result = (await service.addItineraryItem("GRP-PRISMA", createItineraryPayload())) as {
          code?: string;
        };

        expect(createCalls).toBe(2);
        expect(result.code).toBe("GRP-PRISMA");
        expect(createdPayload).toBeTruthy();
        const data = (createdPayload as {
          data: {
            groupId: string;
            sortOrder: number;
            dateLabel: string;
            yearLabel: string;
            category: string;
            title: string;
            meta: string;
            icon: string;
            isoDate: Date | null;
            time: string | null;
            fromLocation: string | null;
            toLocation: string | null;
            notes: string | null;
          };
        }).data;
        expect(data.groupId).toBe("grp-1");
        expect(data.sortOrder).toBe(3);
        expect(data.dateLabel).toBe("10 Apr");
        expect(data.yearLabel).toBe("2026");
        expect(data.category).toBe("Arrival");
        expect(data.title).toBe("Arrival to Jeddah");
        expect(data.meta).toBe("07:30 | SV-827");
        expect(data.icon).toBe("flight_land");
        expect(data.time).toBe("07:30");
        expect(data.fromLocation).toBe("JED Airport");
        expect(data.toLocation).toBe("Makkah Hotel");
        expect(data.notes).toBe("Handle luggage at gate 4");
        expect(data.isoDate?.toISOString().slice(0, 10)).toBe("2026-04-10");
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          findFirst: async (args: Record<string, unknown>) => {
            if ("orderBy" in args) {
              return { sortOrder: 0 };
            }

            return null;
          },
          create: async () => {
            throw createPrismaKnownRequestError("P2002", "duplicate sort order");
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () => service.addItineraryItem("GRP-PRISMA", createItineraryPayload()),
        ).rejects.toThrow(/Unable to allocate itinerary sort order/i);
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          findFirst: async () => ({ id: "existing-item" }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.addItineraryItem(
              "GRP-PRISMA",
              createItineraryPayload({
                sortOrder: 7,
              }),
            ),
        ).rejects.toThrow(/Sort order '7' already exists/i);
      } finally {
        restore();
      }
    }
  });

  runCase("groups prisma update/remove itinerary guards", async () => {
    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          findFirst: async () => null,
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () => service.updateItineraryItem("GRP-PRISMA", "missing-item", createItineraryPayload()),
        ).rejects.toThrow(/Itinerary item 'missing-item' not found/i);
      } finally {
        restore();
      }
    }

    {
      let findFirstCalls = 0;
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          findFirst: async () => {
            findFirstCalls += 1;
            if (findFirstCalls === 1) {
              return { id: "item-1", sortOrder: 1 };
            }

            return { id: "item-2" };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.updateItineraryItem(
              "GRP-PRISMA",
              "item-1",
              createItineraryPayload({
                sortOrder: 4,
              }),
            ),
        ).rejects.toThrow(/Sort order '4' already exists/i);
      } finally {
        restore();
      }
    }

    {
      let updatedPayload: Record<string, unknown> | null = null;
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          findFirst: async () => ({ id: "item-1", sortOrder: 1 }),
          update: async (args: Record<string, unknown>) => {
            updatedPayload = args;
            return { id: "item-1" };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const result = (await service.updateItineraryItem(
          "GRP-PRISMA",
          "item-1",
          createItineraryPayload({
            sortOrder: 1,
          }),
        )) as { code?: string };
        expect(result.code).toBe("GRP-PRISMA");
        expect(updatedPayload).toBeTruthy();
        const data = (updatedPayload as { data: { title: string; sortOrder: number } }).data;
        expect(data.title).toBe("Arrival to Jeddah");
        expect(data.sortOrder).toBe(1);
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          findFirst: async () => ({ id: "item-1", sortOrder: 1 }),
          update: async () => {
            throw createPrismaKnownRequestError("P2002", "duplicate sort order");
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () =>
            service.updateItineraryItem(
              "GRP-PRISMA",
              "item-1",
              createItineraryPayload({
                sortOrder: 1,
              }),
            ),
        ).rejects.toThrow(/Sort order '1' already exists/i);
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          deleteMany: async () => ({ count: 0 }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        await expect(
          () => service.removeItineraryItem("GRP-PRISMA", "item-missing"),
        ).rejects.toThrow(/Itinerary item 'item-missing' not found/i);
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        itineraryItem: {
          deleteMany: async () => ({ count: 1 }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const result = (await service.removeItineraryItem("GRP-PRISMA", "item-1")) as { code?: string };
        expect(result.code).toBe("GRP-PRISMA");
      } finally {
        restore();
      }
    }
  });

  runCase("groups prisma upsert raudhah appointment paths", async () => {
    {
      let updatePayload: Record<string, unknown> | null = null;
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        visaSetup: {
          upsert: async () => ({
            id: "visa-1",
            groupId: "grp-1",
          }),
        },
        raudhahAppointment: {
          findFirst: async () => ({
            id: "raudhah-1",
          }),
          update: async (args: Record<string, unknown>) => {
            updatePayload = args;
            return { id: "raudhah-1" };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const result = (await service.upsertPrimaryRaudhahAppointment("GRP-PRISMA", {
          date: "2026-05-20",
        })) as { code?: string };
        expect(result.code).toBe("GRP-PRISMA");
        expect(updatePayload).toBeTruthy();
        const data = (updatePayload as {
          data: { date: Date; status: GroupRaudhahStatus; tasrehPrinted: boolean };
        }).data;
        expect(data.date.toISOString().slice(0, 10)).toBe("2026-05-20");
        expect(data.status).toBe(GroupRaudhahStatus.FREE);
        expect(data.tasrehPrinted).toBe(false);
      } finally {
        restore();
      }
    }

    {
      let createPayload: Record<string, unknown> | null = null;
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        visaSetup: {
          upsert: async () => ({
            id: "visa-2",
            groupId: "grp-1",
          }),
        },
        raudhahAppointment: {
          findFirst: async () => null,
          create: async (args: Record<string, unknown>) => {
            createPayload = args;
            return { id: "raudhah-2" };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaGroupsService(prismaMock);
      try {
        const result = (await service.upsertPrimaryRaudhahAppointment("GRP-PRISMA", {
          date: "2026-05-21",
          status: GroupRaudhahStatus.BEFORE,
          tasrehPrinted: true,
        })) as { code?: string };
        expect(result.code).toBe("GRP-PRISMA");
        expect(createPayload).toBeTruthy();
        const data = (createPayload as {
          data: { visaSetupId: string; date: Date; status: GroupRaudhahStatus; tasrehPrinted: boolean };
        }).data;
        expect(data.visaSetupId).toBe("visa-2");
        expect(data.date.toISOString().slice(0, 10)).toBe("2026-05-21");
        expect(data.status).toBe(GroupRaudhahStatus.BEFORE);
        expect(data.tasrehPrinted).toBe(true);
      } finally {
        restore();
      }
    }
  });
});
