import { describe, expect, it, vi } from "vitest";
import { AgentStatus, AgentType, GroupLifecycleStatus, GroupTone, VisaStatus } from "@prisma/client";
import type { AgentsService } from "../agents/agents.service";
import type { GroupRepository } from "../domain/repositories/group.repository";
import { AnalyticsService } from "./analytics.service";

function thisMonthDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15));
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function makeGroupRepo(items: unknown[]): GroupRepository {
  return { findAll: vi.fn().mockResolvedValue(items) } as unknown as GroupRepository;
}

function makeAgents(list: unknown[]): AgentsService {
  return { list: vi.fn().mockResolvedValue(list) } as unknown as AgentsService;
}

const groupFixtures = [
  {
    id: "g1",
    code: "G1",
    agentId: "agent-a",
    pax: 40,
    arrivalDate: thisMonthDate(),
    packageName: "Umrah Reguler",
    tone: GroupTone.ACTIVE,
    lifecycleStatus: GroupLifecycleStatus.ACTIVE,
    visaSetup: { visaStatus: VisaStatus.ISSUED, issuedDate: thisMonthDate() },
  },
  {
    id: "g2",
    code: "G2",
    agentId: "agent-a",
    pax: 20,
    arrivalDate: thisMonthDate(),
    packageName: "Umrah Reguler",
    tone: GroupTone.INACTIVE,
    lifecycleStatus: GroupLifecycleStatus.COMPLETED,
    visaSetup: { visaStatus: VisaStatus.PENDING, issuedDate: null },
  },
  {
    id: "g3",
    code: "G3",
    agentId: "agent-b",
    pax: 15,
    arrivalDate: thisMonthDate(),
    packageName: "Umrah Plus Turki",
    tone: GroupTone.ACTIVE,
    lifecycleStatus: GroupLifecycleStatus.ACTIVE,
    visaSetup: { visaStatus: VisaStatus.DRAFT, issuedDate: null },
  },
];

const agentFixtures = [
  { id: "agent-a", code: "AGA", name: "Agent Alpha", type: AgentType.PARTNER, status: AgentStatus.ACTIVE },
  { id: "agent-b", code: "AGB", name: "Agent Beta", type: AgentType.PARTNER, status: AgentStatus.ACTIVE },
];

describe("AnalyticsService", () => {
  it("aggregates operational totals, monthly departures, and package breakdown", async () => {
    const service = new AnalyticsService(makeAgents(agentFixtures), makeGroupRepo(groupFixtures));

    const result = await service.operational({ months: 12 });

    expect(result.totals).toEqual({ groups: 3, pax: 75, activeGroups: 2, completedGroups: 1 });
    expect(result.monthly).toHaveLength(12);
    const currentBucket = result.monthly.find((point) => point.month === currentMonthKey());
    expect(currentBucket).toMatchObject({ groups: 3, pax: 75 });
    expect(result.packages[0]).toEqual({ name: "Umrah Reguler", groups: 2, pax: 60 });
  });

  it("derives the visa funnel and buckets issued pax by issued-date month", async () => {
    const service = new AnalyticsService(makeAgents(agentFixtures), makeGroupRepo(groupFixtures));

    const result = await service.visa({ months: 12 });

    // Measured in pax: g1 issued (40), g2 pending (20), g3 draft (15) → 75 total.
    expect(result.totals).toEqual({
      totalPax: 75,
      issuedPax: 40,
      notIssuedPax: 35,
      issuedRate: 53.3,
      missingIssuedDatePax: 0,
    });
    expect(result.funnel).toEqual([
      { stage: VisaStatus.DRAFT, pax: 15 },
      { stage: VisaStatus.PENDING, pax: 20 },
      { stage: VisaStatus.ISSUED, pax: 40 },
    ]);
    const currentBucket = result.monthly.find((point) => point.month === currentMonthKey());
    expect(currentBucket).toMatchObject({ issuedPax: 40 });
  });

  it("treats a group without a visa setup as Draft and still counts its pax in the total", async () => {
    const groups = [groupFixtures[0], { ...groupFixtures[2], id: "g4", code: "G4", visaSetup: undefined }];
    const service = new AnalyticsService(makeAgents(agentFixtures), makeGroupRepo(groups));

    const result = await service.visa({ months: 12 });

    expect(result.totals.totalPax).toBe(55);
    expect(result.totals.issuedPax).toBe(40);
    expect(result.funnel.find((stage) => stage.stage === VisaStatus.DRAFT)?.pax).toBe(15);
  });

  it("flags issued pax that have no issued date instead of bucketing them", async () => {
    const groups = [{ ...groupFixtures[0], visaSetup: { visaStatus: VisaStatus.ISSUED, issuedDate: null } }];
    const service = new AnalyticsService(makeAgents(agentFixtures), makeGroupRepo(groups));

    const result = await service.visa({ months: 12 });

    expect(result.totals.issuedPax).toBe(40);
    expect(result.totals.missingIssuedDatePax).toBe(40);
    const currentBucket = result.monthly.find((point) => point.month === currentMonthKey());
    expect(currentBucket).toMatchObject({ issuedPax: 0 });
  });

  it("ranks agents by pilgrims and folds in visa issuance rate over their pax", async () => {
    const service = new AnalyticsService(makeAgents(agentFixtures), makeGroupRepo(groupFixtures));

    const result = await service.agents({ months: 12 });

    expect(result.agents[0]).toMatchObject({
      agentId: "agent-a",
      groups: 2,
      pax: 60,
      visaIssuedPax: 40,
      visaIssuedRate: 66.7,
    });
    expect(result.agents[1]).toMatchObject({ agentId: "agent-b", groups: 1, pax: 15, visaIssuedPax: 0 });
  });
});
