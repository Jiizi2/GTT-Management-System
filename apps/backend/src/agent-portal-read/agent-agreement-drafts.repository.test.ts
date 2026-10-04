import { afterEach, describe, expect, it, vi } from "vitest";
import { AgreementApprovalStatus, AgreementCity } from "@prisma/client";
import { PrismaHotelAgreementDraftRepository } from "../infrastructure/repositories/prisma/prisma-hotel-agreement-draft.repository";
import type { PrismaService } from "../prisma/prisma.service";
import type { GroupsService } from "../groups/application/groups.service";
import type { UpsertHotelAgreementDraftDto } from "../groups/dto/hotel-agreement-draft.dto";
import { MemoryHotelAgreementDraftRepository } from "../infrastructure/repositories/memory/memory-hotel-agreement-draft.repository";

const input: UpsertHotelAgreementDraftDto = {
  city: AgreementCity.MAKKAH,
  hotelName: "New hotel",
  agreementNumber: "AGR-NEW",
  groupName: "Reference group",
  pax: 20,
  stayStart: "2026-10-05",
  stayEnd: "2026-10-08",
};

function fixture() {
  const record = {
    id: "draft-own",
    agentId: "agent-own",
    ...input,
    status: AgreementApprovalStatus.REJECTED,
    stayStart: new Date("2026-10-05"),
    stayEnd: new Date("2026-10-08"),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    notes: "Admin private note",
    muassasahId: "admin-muassasah",
  };
  const prisma = {
    $transaction: vi.fn(),
    hotelAgreementDraft: {
      findMany: vi.fn().mockResolvedValue([record]),
      updateMany: vi.fn(),
    },
    visaHotelAgreement: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const repository = new PrismaHotelAgreementDraftRepository(
    prisma as unknown as PrismaService,
    {} as GroupsService,
  );
  return { repository, prisma };
}

describe("Agent agreement draft repository reads", () => {
  it("reads owned drafts and allocations without triggering the Admin expiry mutation", async () => {
    const { repository, prisma } = fixture();
    await repository.findForAgent("agent-own", " hotel ");
    expect(
      prisma.hotelAgreementDraft.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      agentId: "agent-own",
      OR: [
        { hotelName: { contains: "hotel", mode: "insensitive" } },
        { agreementNumber: { contains: "hotel", mode: "insensitive" } },
        { groupName: { contains: "hotel", mode: "insensitive" } },
      ],
    });
    expect(
      prisma.visaHotelAgreement.findMany.mock.calls[0][0].where,
    ).toMatchObject({
      visaSetup: { group: { agentId: "agent-own" } },
    });
    expect(prisma.hotelAgreementDraft.updateMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("uses global capacity totals while keeping the group query scoped to the Agent", async () => {
    const { repository, prisma } = fixture();
    prisma.visaHotelAgreement.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          pax: 6,
          stayStart: new Date("2026-10-05"),
          stayEnd: new Date("2026-10-08"),
        },
      ]);
    const rows = await repository.findForAgent("agent-own");
    expect(rows[0]).toMatchObject({
      remainingPax: 14,
      assignedGroups: [],
      hasAllocations: true,
    });
    expect(prisma.visaHotelAgreement.findMany).toHaveBeenNthCalledWith(2, {
      where: { OR: [{ sourceDraftId: "draft-own" }] },
      select: { pax: true, stayStart: true, stayEnd: true },
    });
  });
});

describe("Agent agreement memory expiry", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps Agent GET pure while Admin still enforces the approval window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const groups = { findAll: vi.fn().mockResolvedValue([]) };
    const repository = new MemoryHotelAgreementDraftRepository(
      groups as unknown as GroupsService,
    );
    await repository.create({ ...input, agentId: "agent-own" });
    await repository.create({
      ...input,
      agreementNumber: "FOREIGN",
      agentId: "agent-other",
    });
    vi.setSystemTime(new Date("2026-10-02T02:00:00Z"));
    const own = (await repository.findForAgent("agent-own")) as Array<{
      status: string;
    }>;
    expect(own).toHaveLength(1);
    expect(own[0].status).toBe("WAITING");
    const internal = (await repository.findAll()) as Array<{ status: string }>;
    expect(internal.every((draft) => draft.status === "REJECTED")).toBe(true);
  });

  it("lets Admin reopen an expired draft and shows its current status to Agent", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    const groups = { findAll: vi.fn().mockResolvedValue([]) };
    const repository = new MemoryHotelAgreementDraftRepository(
      groups as unknown as GroupsService,
    );
    const created = (await repository.create({
      ...input,
      agentId: "agent-own",
    })) as { id: string };
    vi.setSystemTime(new Date("2026-10-02T02:00:00Z"));
    await repository.findAll();
    await repository.update(created.id, {
      ...input,
      hotelName: "Admin revised hotel",
      agentId: "agent-own",
      status: AgreementApprovalStatus.WAITING,
    });
    expect(await repository.findForAgent("agent-own")).toEqual([
      expect.objectContaining({
        status: "WAITING",
        hotelName: "Admin revised hotel",
      }),
    ]);
    expect(
      ((await repository.findAll()) as Array<{ status: string }>)[0].status,
    ).toBe("WAITING");
  });
});
