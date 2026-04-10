import assert from "node:assert/strict";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { GroupRaudhahStatus, Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { GroupsService } from "./groups.service";

function createPrismaGroupsService(prismaMock: PrismaService): { service: GroupsService; restore: () => void } {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "prisma";
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

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testPrismaAddItineraryRetryAndConflictGuards(): Promise<void> {
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

      assert.equal(createCalls, 2);
      assert.equal(result.code, "GRP-PRISMA");
      assert.ok(createdPayload);
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
      assert.equal(data.groupId, "grp-1");
      assert.equal(data.sortOrder, 3);
      assert.equal(data.dateLabel, "10 Apr");
      assert.equal(data.yearLabel, "2026");
      assert.equal(data.category, "Arrival");
      assert.equal(data.title, "Arrival to Jeddah");
      assert.equal(data.meta, "07:30 | SV-827");
      assert.equal(data.icon, "flight_land");
      assert.equal(data.time, "07:30");
      assert.equal(data.fromLocation, "JED Airport");
      assert.equal(data.toLocation, "Makkah Hotel");
      assert.equal(data.notes, "Handle luggage at gate 4");
      assert.equal(data.isoDate?.toISOString().slice(0, 10), "2026-04-10");
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
      await assert.rejects(
        () => service.addItineraryItem("GRP-PRISMA", createItineraryPayload()),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /Unable to allocate itinerary sort order/i);
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
        findFirst: createGroupFindFirstMock(),
      },
      itineraryItem: {
        findFirst: async () => ({ id: "existing-item" }),
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      await assert.rejects(
        () =>
          service.addItineraryItem(
            "GRP-PRISMA",
            createItineraryPayload({
              sortOrder: 7,
            }),
          ),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /Sort order '7' already exists/i);
          return true;
        },
      );
    } finally {
      restore();
    }
  }
}

async function testPrismaUpdateAndRemoveItineraryGuards(): Promise<void> {
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
      await assert.rejects(
        () => service.updateItineraryItem("GRP-PRISMA", "missing-item", createItineraryPayload()),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /Itinerary item 'missing-item' not found/i);
          return true;
        },
      );
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
      await assert.rejects(
        () =>
          service.updateItineraryItem(
            "GRP-PRISMA",
            "item-1",
            createItineraryPayload({
              sortOrder: 4,
            }),
          ),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /Sort order '4' already exists/i);
          return true;
        },
      );
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
      assert.equal(result.code, "GRP-PRISMA");
      assert.ok(updatedPayload);
      const data = (updatedPayload as { data: { title: string; sortOrder: number } }).data;
      assert.equal(data.title, "Arrival to Jeddah");
      assert.equal(data.sortOrder, 1);
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
      await assert.rejects(
        () =>
          service.updateItineraryItem(
            "GRP-PRISMA",
            "item-1",
            createItineraryPayload({
              sortOrder: 1,
            }),
          ),
        (error: unknown) => {
          assert.equal(error instanceof ConflictException, true);
          assert.match((error as Error).message, /Sort order '1' already exists/i);
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
        findFirst: createGroupFindFirstMock(),
      },
      itineraryItem: {
        deleteMany: async () => ({ count: 0 }),
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      await assert.rejects(
        () => service.removeItineraryItem("GRP-PRISMA", "item-missing"),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match((error as Error).message, /Itinerary item 'item-missing' not found/i);
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
        findFirst: createGroupFindFirstMock(),
      },
      itineraryItem: {
        deleteMany: async () => ({ count: 1 }),
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaGroupsService(prismaMock);
    try {
      const result = (await service.removeItineraryItem("GRP-PRISMA", "item-1")) as { code?: string };
      assert.equal(result.code, "GRP-PRISMA");
    } finally {
      restore();
    }
  }
}

async function testPrismaUpsertRaudhahAppointmentPaths(): Promise<void> {
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
      assert.equal(result.code, "GRP-PRISMA");
      assert.ok(updatePayload);
      const data = (updatePayload as {
        data: { date: Date; status: GroupRaudhahStatus; tasrehPrinted: boolean };
      }).data;
      assert.equal(data.date.toISOString().slice(0, 10), "2026-05-20");
      assert.equal(data.status, GroupRaudhahStatus.FREE);
      assert.equal(data.tasrehPrinted, false);
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
      assert.equal(result.code, "GRP-PRISMA");
      assert.ok(createPayload);
      const data = (createPayload as {
        data: { visaSetupId: string; date: Date; status: GroupRaudhahStatus; tasrehPrinted: boolean };
      }).data;
      assert.equal(data.visaSetupId, "visa-2");
      assert.equal(data.date.toISOString().slice(0, 10), "2026-05-21");
      assert.equal(data.status, GroupRaudhahStatus.BEFORE);
      assert.equal(data.tasrehPrinted, true);
    } finally {
      restore();
    }
  }
}

async function main(): Promise<void> {
  await runCase("groups prisma add itinerary retry and conflict guards", testPrismaAddItineraryRetryAndConflictGuards);
  await runCase("groups prisma update/remove itinerary guards", testPrismaUpdateAndRemoveItineraryGuards);
  await runCase("groups prisma upsert raudhah appointment paths", testPrismaUpsertRaudhahAppointmentPaths);
}

void main().catch((error: unknown) => {
  console.error("Groups prisma itinerary/raudhah test failed:", error);
  process.exitCode = 1;
});
