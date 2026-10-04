import { ConfigService } from "@nestjs/config";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AgreementApprovalStatus, AgreementCity } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { DirectoryService } from "../directory/directory.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { GroupsService } from "../groups/application/groups.service";
import { HotelAgreementDraftsService } from "../groups/application/hotel-agreement-drafts.service";
import { MemoryHotelAgreementDraftRepository } from "../infrastructure/repositories/memory/memory-hotel-agreement-draft.repository";
import { AgentAgreementDraftsService } from "./agent-agreement-drafts.service";

const input = {
  city: AgreementCity.MAKKAH,
  hotelName: "Own hotel",
  agreementNumber: "AGR-OWN",
  groupName: "Own group",
  pax: 10,
  stayStart: "2026-10-05",
  stayEnd: "2026-10-10",
};

type AllocationGroup = {
  code: string;
  agentId: string;
  visaSetup: {
    hotelAgreements: Array<typeof input & { sourceDraftId?: string }>;
  };
};

function fixture() {
  const groups: AllocationGroup[] = [];
  const updateVisaHotelAgreement = vi.fn();
  const groupsService = {
    findAll: vi.fn(async () => groups),
    updateVisaHotelAgreement,
  } as unknown as GroupsService;
  const repository = new MemoryHotelAgreementDraftRepository(groupsService);
  const directory = new DirectoryService(
    new ConfigService({ DATA_SOURCE: "memory" }),
    {} as PrismaService,
  );
  const admin = new HotelAgreementDraftsService(
    repository,
    groupsService,
    undefined,
    undefined,
    directory,
  );
  const agent = new AgentAgreementDraftsService(repository, directory);
  const createDraft = async (agentId: string) => {
    const created = (await admin.create({ ...input, agentId })) as {
      id: string;
    };
    return agent.detail(agentId, created.id);
  };
  return {
    groups,
    repository,
    directory,
    admin,
    agent,
    createDraft,
    updateVisaHotelAgreement,
  };
}

describe("Admin–Agent agreement consistency", () => {
  it("follows Admin changes and current directory names with every draft read-only", async () => {
    const { repository, directory, admin, agent, createDraft } = fixture();
    const muassasah = await directory.createMuassasah({
      name: "Muassasah Original",
    });
    const created = await createDraft("agent-own");
    expect(created).toMatchObject({
      muassasahId: null,
      muassasahName: null,
      editable: false,
    });
    await admin.update(created.id, {
      ...input,
      agentId: "agent-own",
      muassasahId: muassasah.id,
      notes: "PRIVATE ADMIN NOTE",
      status: AgreementApprovalStatus.REJECTED,
    });
    await directory.updateMuassasah(muassasah.id, {
      name: "Muassasah Renamed",
      isActive: false,
    });
    const expected = {
      muassasahId: muassasah.id,
      muassasahName: "Muassasah Renamed",
    };
    const before = structuredClone(repository.memoryDrafts);
    expect(await agent.detail("agent-own", created.id)).toMatchObject({
      ...expected,
      status: "REJECTED",
      editable: false,
    });
    expect(await agent.list("agent-own")).toEqual([
      expect.objectContaining(expected),
    ]);
    expect(repository.memoryDrafts).toEqual(before);
    const revised = await admin.update(created.id, {
      ...input,
      agentId: "agent-own",
      hotelName: "Admin revised hotel",
      muassasahId: muassasah.id,
      notes: "PRIVATE ADMIN NOTE",
      status: AgreementApprovalStatus.WAITING,
    });
    expect(revised).toMatchObject({
      ...expected,
      hotelName: "Admin revised hotel",
    });
    const read = await agent.detail("agent-own", created.id);
    expect(read).toMatchObject({
      ...expected,
      hotelName: "Admin revised hotel",
      editable: false,
    });
    expect(read).not.toHaveProperty("notes");
    await directory.removeMuassasah(muassasah.id);
    expect(await agent.detail("agent-own", created.id)).toMatchObject({
      muassasahId: null,
      muassasahName: null,
      editable: false,
    });
    expect(await admin.findAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          muassasahId: null,
          muassasahName: null,
        }),
      ]),
    );
  });

  it("resolves only owned draft references and never exposes private directory data", async () => {
    const { directory, admin, agent, createDraft } = fixture();
    const own = await directory.createMuassasah({ name: "Own Muassasah" });
    const foreign = await directory.createMuassasah({
      name: "FOREIGN PRIVATE MUASSASAH",
    });
    await directory.createDriver({
      name: "PRIVATE DRIVER",
      phone: "PRIVATE PHONE",
      muassasahId: own.id,
    });
    const draft = await createDraft("agent-own");
    await admin.update(draft.id, {
      ...input,
      agentId: "agent-own",
      muassasahId: own.id,
      notes: "PRIVATE NOTE",
    });
    const foreignDraft = await createDraft("agent-foreign");
    await admin.update(foreignDraft.id, {
      ...input,
      agentId: "agent-foreign",
      muassasahId: foreign.id,
    });
    const resolve = vi.spyOn(directory, "resolveMuassasahNames");
    const rows = await agent.list("agent-own");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: draft.id, muassasahName: own.name });
    expect(JSON.stringify(rows)).not.toMatch(
      /PRIVATE|driverCount|vehicleCount|phone|agentId/,
    );
    expect(resolve).toHaveBeenLastCalledWith([own.id]);
    resolve.mockClear();
    await expect(
      agent.detail("agent-own", foreignDraft.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(resolve).not.toHaveBeenCalled();
  });

  it("rejects Agent creation and revision without calling repository writes", async () => {
    const { repository, agent, createDraft } = fixture();
    await createDraft("agent-own");
    const before = structuredClone(repository.memoryDrafts);
    const create = vi.spyOn(repository, "create");
    const update = vi.spyOn(repository, "update");
    await expect(agent.create()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(agent.update()).rejects.toBeInstanceOf(ForbiddenException);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(repository.memoryDrafts).toEqual(before);
  });

  it.each([
    { secondStart: "2026-10-07", remainingPax: 4 },
    { secondStart: "2026-10-06", remainingPax: 0 },
  ])(
    "uses the same per-night capacity for both portals ($secondStart)",
    async ({ secondStart, remainingPax }) => {
      const { groups, admin, agent, createDraft } = fixture();
      const draft = await createDraft("agent-own");
      groups.push(
        {
          code: "OWN-A",
          agentId: "agent-own",
          visaSetup: {
            hotelAgreements: [
              {
                ...input,
                sourceDraftId: draft.id,
                pax: 6,
                stayEnd: "2026-10-07",
              },
            ],
          },
        },
        {
          code: "OWN-B",
          agentId: "agent-own",
          visaSetup: {
            hotelAgreements: [
              {
                ...input,
                sourceDraftId: draft.id,
                pax: 6,
                stayStart: secondStart,
              },
            ],
          },
        },
      );
      const expected = {
        remainingPax,
        status: "WAITING",
        assignmentStatus: "Assigned",
        assignedGroups: [
          { groupCode: "OWN-A", pax: 6 },
          { groupCode: "OWN-B", pax: 6 },
        ],
      };
      expect(await agent.detail("agent-own", draft.id)).toMatchObject({
        ...expected,
        editable: false,
      });
      expect(await admin.findAll()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: draft.id, ...expected }),
        ]),
      );
    },
  );

  it("keeps duplicate agreement numbers separate by source ID while reading legacy links", async () => {
    const { groups, admin, agent, createDraft, updateVisaHotelAgreement } =
      fixture();
    const own = await createDraft("agent-own");
    const other = await createDraft("agent-own");
    groups.push({
      code: "OTHER",
      agentId: "agent-own",
      visaSetup: {
        hotelAgreements: [{ ...input, sourceDraftId: other.id, pax: 7 }],
      },
    });
    expect(await agent.detail("agent-own", own.id)).toMatchObject({
      remainingPax: 10,
      assignedGroups: [],
      assignmentStatus: "Unassigned",
      editable: false,
    });
    expect(await admin.findAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: own.id,
          remainingPax: 10,
          assignedGroups: [],
        }),
      ]),
    );
    await admin.update(own.id, {
      ...input,
      agentId: "agent-own",
      hotelName: "Revised own hotel",
    });
    expect(updateVisaHotelAgreement).not.toHaveBeenCalled();
    // Records created before sourceDraftId still resolve by city and agreement number.
    groups.push({
      code: "LEGACY",
      agentId: "agent-own",
      visaSetup: { hotelAgreements: [{ ...input, pax: 2 }] },
    });
    expect(await agent.detail("agent-own", own.id)).toMatchObject({
      remainingPax: 8,
      assignedGroups: [{ groupCode: "LEGACY", pax: 2 }],
    });
  });

  it("shares capacity and read-only state for legacy foreign allocations without revealing group identities", async () => {
    const { groups, admin, agent, createDraft } = fixture();
    const own = await createDraft("agent-own");
    groups.push({
      code: "FOREIGN PRIVATE GROUP",
      agentId: "foreign",
      visaSetup: {
        hotelAgreements: [{ ...input, sourceDraftId: own.id, pax: 3 }],
      },
    });
    const read = await agent.detail("agent-own", own.id);
    expect(read).toMatchObject({
      remainingPax: 7,
      assignmentStatus: "Assigned",
      editable: false,
      assignedGroups: [],
    });
    expect(read).not.toHaveProperty("hasAllocations");
    expect(JSON.stringify(read)).not.toContain("PRIVATE");
    expect(await admin.findAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: own.id,
          remainingPax: 7,
          assignmentStatus: "Assigned",
        }),
      ]),
    );
    await expect(agent.update()).rejects.toBeInstanceOf(ForbiddenException);
  });
});
