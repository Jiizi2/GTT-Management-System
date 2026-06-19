import assert from "node:assert/strict";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreateGroupDto } from "../dto/create-group.dto";
import { GroupsService } from "../application/groups.service";
import { GroupStatus } from "@prisma/client";

async function createMemoryService(): Promise<{ service: GroupsService; restore: () => void }> {
  const previous = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "memory";
  const service = new GroupsService({} as PrismaService);

  const existingGroups = await service.findAll();
  if (Array.isArray(existingGroups)) {
    for (const group of existingGroups) {
      const code = (group as { code?: unknown }).code;
      if (typeof code === "string" && code.trim()) {
        await service.remove(code);
      }
    }
  }

  return {
    service,
    restore: () => {
      if (previous === undefined) {
        delete process.env.DATA_SOURCE;
      } else {
        process.env.DATA_SOURCE = previous;
      }
    },
  };
}

function createGroupPayload(overrides: Partial<CreateGroupDto> = {}): CreateGroupDto {
  return {
    code: "EDGE-000",
    name: "Edge Group",
    status: GroupStatus.ACTIVE,
    arrivalDate: "2026-04-10",
    returnDate: "2026-04-18",
    pax: 40,
    packageName: "Edge Package",
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

async function testReplaceAndUpdateConflictAndDateGuards(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "EDGE-701",
        name: "Group A",
      }),
    );
    await service.create(
      createGroupPayload({
        code: "EDGE-702",
        name: "Group B",
      }),
    );

    await assert.rejects(
      () =>
        service.replace(
          "EDGE-701",
          createGroupPayload({
            code: "EDGE-702",
          }),
        ),
      (error: unknown) => {
        assert.equal(error instanceof ConflictException, true);
        assert.match((error as Error).message, /already exists/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        service.update("EDGE-701", {
          code: "EDGE-702",
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConflictException, true);
        assert.match((error as Error).message, /already exists/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        service.replace(
          "EDGE-MISSING",
          createGroupPayload({
            code: "EDGE-799",
          }),
        ),
      (error: unknown) => {
        assert.equal(error instanceof NotFoundException, true);
        assert.match((error as Error).message, /not found/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        service.replace(
          "EDGE-701",
          createGroupPayload({
            code: "EDGE-701",
            arrivalDate: "2026-04-20",
            returnDate: "2026-04-19",
          }),
        ),
      (error: unknown) => {
        assert.equal(error instanceof BadRequestException, true);
        assert.match((error as Error).message, /Return date must be on or after arrival date/i);
        return true;
      },
    );

    await assert.rejects(
      () =>
        service.update("EDGE-701", {
          arrivalDate: "2026-04-22",
          returnDate: "2026-04-18",
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

async function testChecklistCapacityNoOverfillAndResetMatching(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "EDGE-801",
        name: "Checklist Edge",
      }),
    );

    await service.confirmChecklistDriver("EDGE-801", {
      tripDate: "2026-04-15",
      activity: "Arrival",
      tripLabel: "Jeddah Arrival",
      requiredBusCount: 2,
      scheduledTime: "09:00",
      driver: {
        name: "Driver A",
        phone: "081111",
        plateNumber: "B 1001 AA",
      },
    });

    const afterSecondDriver = await service.confirmChecklistDriver("EDGE-801", {
      tripDate: "2026-04-15",
      activity: "Arrival",
      tripLabel: "Jeddah Arrival",
      requiredBusCount: 2,
      scheduledTime: "09:00",
      driver: {
        name: "Driver B",
        phone: "082222",
        plateNumber: "B 2002 BB",
      },
    });
    assert.equal(afterSecondDriver.status, "ASSIGNED");
    assert.equal(afterSecondDriver.drivers.length, 2);

    const afterThirdAttempt = await service.confirmChecklistDriver("EDGE-801", {
      tripDate: "2026-04-15",
      activity: "Arrival",
      tripLabel: "Jeddah Arrival",
      requiredBusCount: 2,
      scheduledTime: "09:00",
      driver: {
        name: "Driver C",
        phone: "083333",
        plateNumber: "B 3003 CC",
      },
    });
    assert.equal(afterThirdAttempt.drivers.length, 2);
    assert.equal(afterThirdAttempt.drivers.some((driver) => driver.name === "Driver C"), false);

    const resetResult = await service.resetChecklistDriver("EDGE-801", {
      tripDate: "2026-04-15",
      scheduledTime: "09:00",
      activity: "arrival",
    });
    assert.equal(resetResult.status, "NOT_COMPLETE");
    assert.equal(resetResult.drivers.length, 0);

    await assert.rejects(
      () =>
        service.resetChecklistDriver("EDGE-801", {
          tripDate: "2026-04-15",
          scheduledTime: "11:00",
        }),
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

async function testAuditLogFilteringAndPaginationBounds(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "EDGE-901",
        name: "Audit Group",
      }),
    );
    await service.update("EDGE-901", {
      name: "Audit Group Updated",
    });
    await service.confirmChecklistDriver("EDGE-901", {
      tripDate: "2026-04-16",
      activity: "Departure",
      tripLabel: "Departure to airport",
      requiredBusCount: 1,
      scheduledTime: "18:00",
      driver: {
        name: "Driver Audit",
        phone: "089999",
        plateNumber: "B 9090 ZZ",
      },
    });

    const limitedLogs = await service.listAuditLogs(undefined, 2);
    assert.equal(limitedLogs.length, 2);

    const groupLogs = await service.listAuditLogs("edge-901");
    assert.equal(groupLogs.length >= 3, true);
    assert.equal(groupLogs.every((entry) => entry.groupCode === "EDGE-901"), true);

    const unknownLogs = await service.listAuditLogs("EDGE-UNKNOWN");
    assert.equal(unknownLogs.length, 0);

    const noLimitWhenInvalid = await service.listAuditLogs("EDGE-901", -1);
    assert.equal(noLimitWhenInvalid.length, groupLogs.length);

    await service.create(
      createGroupPayload({
        code: "EDGE-902",
        name: "Paged Group 2",
      }),
    );
    await service.create(
      createGroupPayload({
        code: "EDGE-903",
        name: "Paged Group 3",
      }),
    );

    const normalizedPage = (await service.findAll(undefined, {
      page: 0,
      pageSize: 1000,
    })) as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    assert.equal(normalizedPage.page, 1);
    assert.equal(normalizedPage.pageSize, 100);
    assert.equal(normalizedPage.total, 3);

    const pageTwo = (await service.findAll(undefined, {
      page: 2,
      pageSize: 2,
    })) as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    assert.equal(pageTwo.page, 2);
    assert.equal(pageTwo.pageSize, 2);
    assert.equal(pageTwo.items.length, 1);
    assert.equal(pageTwo.total, 3);
  } finally {
    restore();
  }
}

async function main(): Promise<void> {
  await runCase("groups replace/update conflict and date guards", testReplaceAndUpdateConflictAndDateGuards);
  await runCase("groups checklist capacity and reset matching", testChecklistCapacityNoOverfillAndResetMatching);
  await runCase("groups audit log filtering and pagination bounds", testAuditLogFilteringAndPaginationBounds);
}

void main().catch((error: unknown) => {
  console.error("Groups edge test failed:", error);
  process.exitCode = 1;
});
