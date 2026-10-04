import { describe, expect, it, vi } from "vitest";
import { AgreementApprovalStatus, AgreementCity } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { GroupsService } from "../application/groups.service";
import { MemoryHotelAgreementDraftRepository } from "../../infrastructure/repositories/memory/memory-hotel-agreement-draft.repository";
import { PrismaHotelAgreementDraftRepository } from "../../infrastructure/repositories/prisma/prisma-hotel-agreement-draft.repository";

async function fixture(source: "memory" | "prisma") {
  const now = new Date();
  const expired = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const cases = [
    {
      id: "rejected-linked",
      status: AgreementApprovalStatus.REJECTED,
      linked: true,
      updatedAt: now,
    },
    {
      id: "expired-linked",
      status: AgreementApprovalStatus.WAITING,
      linked: true,
      updatedAt: expired,
    },
    {
      id: "approved-linked",
      status: AgreementApprovalStatus.APPROVED,
      linked: true,
      updatedAt: now,
    },
    {
      id: "rejected-unlinked",
      status: AgreementApprovalStatus.REJECTED,
      linked: false,
      updatedAt: now,
    },
    {
      id: "waiting-unlinked",
      status: AgreementApprovalStatus.WAITING,
      linked: false,
      updatedAt: now,
    },
  ];
  const records = cases.map((item) => ({
    ...item,
    city: AgreementCity.MAKKAH,
    agentId: "agent-1",
    hotelName: "Hotel One",
    agreementNumber: item.id,
    groupName: "Group One",
    pax: 10,
    stayStart: new Date("2026-10-10"),
    stayEnd: new Date("2026-10-15"),
    createdAt: now,
  }));
  const linked = records.filter((record) => record.linked);
  const groups = {
    findAll: vi.fn().mockResolvedValue([
      {
        code: "GROUP-1",
        visaSetup: {
          hotelAgreements: linked.map((record) => ({
            ...record,
            sourceDraftId: record.id,
            stayStart: "2026-10-10",
            stayEnd: "2026-10-15",
          })),
        },
      },
    ]),
  };
  if (source === "memory") {
    const repository = new MemoryHotelAgreementDraftRepository(
      groups as unknown as GroupsService,
    );
    repository.memoryDrafts.push(
      ...records.map((record) => ({
        ...record,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        stayStart: "2026-10-10",
        stayEnd: "2026-10-15",
      })),
    );
    return repository;
  }
  const prisma = {
    hotelAgreementDraft: {
      findMany: vi.fn().mockResolvedValue(records),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    visaHotelAgreement: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { OR: Array<{ sourceDraftId: string }> };
        }) => {
          const record = linked.find(
            (draft) => draft.id === where.OR[0].sourceDraftId,
          );
          return record
            ? [{ ...record, visaSetup: { group: { code: "GROUP-1" } } }]
            : [];
        },
      ),
    },
  };
  return new PrismaHotelAgreementDraftRepository(
    prisma as unknown as PrismaService,
    groups as unknown as GroupsService,
  );
}

describe.each(["memory", "prisma"] as const)(
  "%s agreement default inbox",
  (source) => {
    it("includes manual and expired rejections even with full allocations, preserving group links", async () => {
      const repository = await fixture(source);
      const inbox = await repository.findAll(undefined, "unassigned");
      expect(inbox).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "rejected-linked",
            status: "REJECTED",
            remainingPax: 0,
            assignedGroups: [expect.objectContaining({ groupCode: "GROUP-1" })],
          }),
          expect.objectContaining({ id: "expired-linked", status: "REJECTED" }),
          expect.objectContaining({ id: "rejected-unlinked" }),
          expect.objectContaining({ id: "waiting-unlinked" }),
        ]),
      );
      expect(inbox).toHaveLength(4);
      expect(await repository.findAll("rejected-linked", "unassigned")).toEqual(
        [expect.objectContaining({ id: "rejected-linked" })],
      );
      expect(await repository.findAll(undefined, "assigned")).toHaveLength(3);
      expect(await repository.findAll()).toHaveLength(5);
    });
  },
);
