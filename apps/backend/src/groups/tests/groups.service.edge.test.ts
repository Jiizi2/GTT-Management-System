import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreateGroupDto } from "../dto/create-group.dto";
import { GroupsService } from "../application/groups.service";

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
    status: "Active",
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

describe("GroupsServiceEdge", () => {
  runCase("groups replace/update conflict and date guards", async () => {
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

      await expect(
        () =>
          service.replace(
            "EDGE-701",
            createGroupPayload({
              code: "EDGE-702",
            }),
          ),
      ).rejects.toThrow(ConflictException);

      await expect(
        () =>
          service.update("EDGE-701", {
            code: "EDGE-702",
          }),
      ).rejects.toThrow(ConflictException);

      await expect(
        () =>
          service.replace(
            "EDGE-MISSING",
            createGroupPayload({
              code: "EDGE-799",
            }),
          ),
      ).rejects.toThrow(NotFoundException);

      await expect(
        () =>
          service.replace(
            "EDGE-701",
            createGroupPayload({
              code: "EDGE-701",
              arrivalDate: "2026-04-20",
              returnDate: "2026-04-19",
            }),
          ),
      ).rejects.toThrow(/Return date must be on or after arrival date/i);

      await expect(
        () =>
          service.update("EDGE-701", {
            arrivalDate: "2026-04-22",
            returnDate: "2026-04-18",
          }),
      ).rejects.toThrow(/Return date must be on or after arrival date/i);
    } finally {
      restore();
    }
  });

  runCase("groups checklist capacity and reset matching", async () => {
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
      expect(afterSecondDriver.status).toBe("ASSIGNED");
      expect(afterSecondDriver.drivers.length).toBe(2);

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
      expect(afterThirdAttempt.drivers.length).toBe(2);
      expect(afterThirdAttempt.drivers.some((driver) => driver.name === "Driver C")).toBe(false);

      const resetResult = await service.resetChecklistDriver("EDGE-801", {
        tripDate: "2026-04-15",
        scheduledTime: "09:00",
        activity: "arrival",
      });
      expect(resetResult.status).toBe("NOT_COMPLETE");
      expect(resetResult.drivers.length).toBe(0);

      await expect(
        () =>
          service.resetChecklistDriver("EDGE-801", {
            tripDate: "2026-04-15",
            scheduledTime: "11:00",
          }),
      ).rejects.toThrow(NotFoundException);
    } finally {
      restore();
    }
  });

  runCase("groups audit log filtering and pagination bounds", async () => {
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
      expect(limitedLogs.length).toBe(2);

      const groupLogs = await service.listAuditLogs("edge-901");
      expect(groupLogs.length >= 3).toBe(true);
      expect(groupLogs.every((entry) => entry.groupCode === "EDGE-901")).toBe(true);

      const unknownLogs = await service.listAuditLogs("EDGE-UNKNOWN");
      expect(unknownLogs.length).toBe(0);

      const noLimitWhenInvalid = await service.listAuditLogs("EDGE-901", -1);
      expect(noLimitWhenInvalid.length).toBe(groupLogs.length);

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
      expect(normalizedPage.page).toBe(1);
      expect(normalizedPage.pageSize).toBe(100);
      expect(normalizedPage.total).toBe(3);

      const pageTwo = (await service.findAll(undefined, {
        page: 2,
        pageSize: 2,
      })) as {
        items: unknown[];
        total: number;
        page: number;
        pageSize: number;
      };
      expect(pageTwo.page).toBe(2);
      expect(pageTwo.pageSize).toBe(2);
      expect(pageTwo.items.length).toBe(1);
      expect(pageTwo.total).toBe(3);
    } finally {
      restore();
    }
  });
});
