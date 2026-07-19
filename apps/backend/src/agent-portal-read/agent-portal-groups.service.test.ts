import { GroupLifecycleStatus } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { GroupMemoryStore } from "../infrastructure/repositories/memory/group-memory-store";
import type { MemoryGroupRecord } from "../groups/groups.service-types";
import { AgentPortalGroupsService } from "./agent-portal-groups.service";

const config = (source: "memory" | "prisma") => ({
  get: vi.fn((key: string) => key === "DATA_SOURCE" ? source : undefined),
}) as unknown as ConfigService;

function record(id: string, code: string, agentId: string): MemoryGroupRecord {
  return {
    id, code, agentId, name: `${code} Name`, status: "Active", lifecycleStatus: GroupLifecycleStatus.ACTIVE,
    tone: "ACTIVE", arrivalDate: "2026-08-01", returnDate: "2026-08-09", pax: 25,
    totalBuses: 2, packageName: "PRIVATE PACKAGE", durationDays: 9,
    musyrif: { name: "PRIVATE MUSYRIF", phone: "08123", avatar: "secret" },
    timeline: [{ sortOrder: 0, dateLabel: "1 Aug", title: "Arrival", isCurrent: true, nextActivity: "PRIVATE NEXT" }],
    itinerary: [{
      id: `${id}-trip`, sortOrder: 0, dateLabel: "1 Aug", yearLabel: "2026", category: "Arrival",
      title: "Scheduled arrival", meta: "PRIVATE META", icon: "flight", isoDate: "2026-08-01",
      requiresBus: true, notes: "PRIVATE ITINERARY NOTE", transferByTrain: false,
    }],
    notes: [{ sortOrder: 0, text: "PRIVATE GROUP NOTE", pinned: true }],
    visaSetup: {
      visaStatus: "PENDING", syarikah: "PRIVATE SYARIKAH", paymentStatus: "UNPAID",
      hotelAgreements: [{
        id: `${id}-hotel`, city: "MAKKAH", hotelName: "Safe Hotel", agreementNumber: "PRIVATE-AGREEMENT",
        pax: 25, status: "WAITING", stayStart: "2026-08-01", stayEnd: "2026-08-05",
      }],
      raudhahAppointments: [],
    },
    checklistAssignments: [{
      id: `${id}-transport`, tripDate: "2026-08-01", activity: "Transfer", tripLabel: "Airport",
      requiredBusCount: 1, scheduledTime: "09:00", status: "ASSIGNED", drivers: [{
        slotNumber: 1, name: "PRIVATE DRIVER", phone: "08999", plateNumber: "B SECRET", isVerified: true,
      }],
    }],
    createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z",
  } as MemoryGroupRecord;
}

describe("AgentPortalGroupsService", () => {
  it("scopes list/search/count and returns owned operational summaries", async () => {
    const store = new GroupMemoryStore();
    store.groups.splice(0, store.groups.length, record("a", "OWN-1", "agent-a"), record("b", "OTHER-1", "agent-b"));
    const service = new AgentPortalGroupsService(config("memory"), {} as PrismaService, store);

    const result = await service.list("agent-a", { q: "own", page: 1, pageSize: 20, sortBy: "code", sortDirection: "asc" });

    expect(result.total).toBe(1);
    expect(result.items.map((item) => item.code)).toEqual(["OWN-1"]);
    expect(result.items[0]).toMatchObject({
      packageName: "PRIVATE PACKAGE",
      musyrif: { name: "PRIVATE MUSYRIF", phone: "08123" },
      notes: [],
      itinerary: [{ title: "Scheduled arrival" }],
    });
    expect(JSON.stringify(result)).not.toMatch(/OTHER-1|agentId|PRIVATE DRIVER|08999|B SECRET/i);
  });

  it("makes absent and cross-tenant detail indistinguishable", async () => {
    const store = new GroupMemoryStore();
    store.groups.splice(0, store.groups.length, record("b", "OTHER-1", "agent-b"));
    const service = new AgentPortalGroupsService(config("memory"), {} as PrismaService, store);

    const capture = async (identity: string) => service.detail("agent-a", identity).catch((error) => ({ status: error.status, message: error.message }));
    expect(await capture("OTHER-1")).toEqual(await capture("MISSING"));
  });

  it("projects owned group detail while still excluding driver identity and internal itinerary metadata", async () => {
    const store = new GroupMemoryStore();
    store.groups.splice(0, store.groups.length, record("a", "OWN-1", "agent-a"));
    const service = new AgentPortalGroupsService(config("memory"), {} as PrismaService, store);

    const facets = {
      detail: await service.detail("agent-a", "OWN-1"),
      itinerary: await service.itinerary("agent-a", "OWN-1"),
      timeline: await service.timeline("agent-a", "OWN-1"),
      visa: await service.visa("agent-a", "OWN-1"),
      hotels: await service.hotels("agent-a", "OWN-1"),
      transportation: await service.transportation("agent-a", "OWN-1"),
    };
    const serialized = JSON.stringify(facets);
    expect(facets.detail).toMatchObject({
      packageName: "PRIVATE PACKAGE",
      musyrif: { name: "PRIVATE MUSYRIF", phone: "08123" },
      notes: [],
      itinerary: [{ title: "Scheduled arrival" }],
    });
    expect(serialized).not.toMatch(/PRIVATE GROUP NOTE|PRIVATE NEXT|PRIVATE META|PRIVATE ITINERARY NOTE|PRIVATE DRIVER|08999|B SECRET/i);
    expect(facets.visa).toMatchObject({ status: "PENDING", syarikah: "PRIVATE SYARIKAH" });
    expect(facets.hotels[0]).toMatchObject({ agreementNumber: "PRIVATE-AGREEMENT" });
    expect(facets.transportation[0]).toMatchObject({ assignedDriverCount: 1, verifiedDriverCount: 1 });
  });

  it("combines tenant and resource identity in Prisma lookups", async () => {
    const prisma = {
      group: {
        findFirst: vi.fn().mockResolvedValue({
          id: "a", code: "OWN-1", name: "Own", lifecycleStatus: "ACTIVE",
          arrivalDate: new Date(), returnDate: new Date(), pax: 1, totalBuses: null, durationDays: 1,
        }),
      },
    };
    const service = new AgentPortalGroupsService(config("prisma"), prisma as unknown as PrismaService, new GroupMemoryStore());

    await service.detail("agent-a", "own-1");

    expect(prisma.group.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { agentId: "agent-a", OR: [{ id: "own-1" }, { code: "OWN-1" }] },
    }));
  });
});
