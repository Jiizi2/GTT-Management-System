import { GroupLifecycleStatus } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../prisma/prisma.service";
import { GroupMemoryStore } from "../infrastructure/repositories/memory/group-memory-store";
import type { MemoryGroupRecord } from "../groups/groups.service-types";
import type { AgentPrincipal } from "../agent-auth/agent-auth.types";
import { AgentPortalReadService } from "./agent-portal-read.service";

const principal: AgentPrincipal = {
  portalUserId: "portal-a",
  agentId: "agent-a",
  displayName: "Operator A",
  email: "operator-a@example.com",
  agentCode: "PARTNER-A",
  agentName: "Partner A",
  mustChangePassword: false,
  exp: 2_000_000_000,
};

function config(dataSource: "memory" | "prisma"): ConfigService {
  return { get: vi.fn((key: string) => key === "DATA_SOURCE" ? dataSource : undefined) } as unknown as ConfigService;
}

function group(overrides: Partial<MemoryGroupRecord>): MemoryGroupRecord {
  return {
    id: "group-a",
    code: "GROUP-A",
    name: "Owned Group",
    status: "Active",
    lifecycleStatus: GroupLifecycleStatus.ACTIVE,
    searchDocument: "",
    tone: "ACTIVE",
    arrivalDate: "2026-07-20",
    returnDate: "2026-07-28",
    pax: 40,
    totalBuses: 1,
    packageName: "Sensitive Package",
    durationDays: 9,
    agentId: "agent-a",
    musyrif: { name: "Private Name", phone: "081234", avatar: "private" },
    timeline: [{ sortOrder: 0, dateLabel: "20 Jul", title: "Safe arrival", isCurrent: true }],
    itinerary: [],
    notes: [{ sortOrder: 0, text: "SECRET INTERNAL NOTE", pinned: true }],
    checklistAssignments: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    ...overrides,
  } as MemoryGroupRecord;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AgentPortalReadService", () => {
  it("projects a minimal profile from the revalidated principal", () => {
    const service = new AgentPortalReadService(
      config("memory"),
      {} as PrismaService,
      new GroupMemoryStore(),
    );

    expect(service.profile(principal)).toEqual({
      account: { displayName: "Operator A" },
      agent: { code: "PARTNER-A", name: "Partner A" },
    });
    expect(JSON.stringify(service.profile(principal))).not.toContain("operator-a@example.com");
  });

  it("scopes every memory dashboard projection and count to the session Agent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T05:00:00.000Z"));
    const store = new GroupMemoryStore();
    store.groups.splice(
      0,
      store.groups.length,
      group({}),
      group({
        id: "group-b",
        code: "GROUP-B",
        name: "Foreign Group",
        agentId: "agent-b",
        pax: 900,
        notes: [{ sortOrder: 0, text: "FOREIGN SECRET", pinned: true }],
      }),
    );
    const service = new AgentPortalReadService(config("memory"), {} as PrismaService, store);

    const dashboard = await service.dashboard(principal);

    expect(dashboard.groups).toMatchObject({ total: 1, active: 1, upcoming: 1, totalPax: 40 });
    expect(dashboard.upcomingGroups.map((item) => item.code)).toEqual(["GROUP-A"]);
    expect(dashboard.recentTimeline.map((item) => item.group.code)).toEqual(["GROUP-A"]);
    const serialized = JSON.stringify(dashboard);
    expect(serialized).not.toContain("GROUP-B");
    expect(serialized).not.toContain("Private Name");
    expect(serialized).not.toContain("081234");
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("Sensitive Package");
  });

  it("applies the tenant predicate to every Prisma dashboard query", async () => {
    const prisma = {
      group: {
        aggregate: vi.fn().mockResolvedValue({ _count: { _all: 0 }, _sum: { pax: null } }),
        groupBy: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
      },
      groupTimelineItem: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new AgentPortalReadService(
      config("prisma"),
      prisma as unknown as PrismaService,
      new GroupMemoryStore(),
    );

    await service.dashboard(principal);

    expect(prisma.group.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: "agent-a" } }));
    expect(prisma.group.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { agentId: "agent-a" } }));
    expect(prisma.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ agentId: "agent-a" }) }),
    );
    for (const [call] of prisma.group.count.mock.calls) {
      expect(call.where.agentId).toBe("agent-a");
    }
    expect(prisma.groupTimelineItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { group: { agentId: "agent-a" } } }),
    );
  });
});
