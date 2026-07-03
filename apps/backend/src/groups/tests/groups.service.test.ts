import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import {
  AgreementApprovalStatus,
  AgreementCity,
  VisaStatus,
  VisaPaymentStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { GroupsService } from "../application/groups.service";
import { HotelAgreementDraftsService } from "../application/hotel-agreement-drafts.service";
import type { CreateGroupDto } from "../dto/create-group.dto";

async function createMemoryServices(): Promise<{
  groupsService: GroupsService;
  draftsService: HotelAgreementDraftsService;
  restore: () => void;
}> {
  const previous = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "memory";
  const groupsService = new GroupsService({} as PrismaService);
  const draftsService = new HotelAgreementDraftsService(
    {} as PrismaService,
    groupsService,
  );

  const existingGroups = await groupsService.findAll();
  if (Array.isArray(existingGroups)) {
    for (const group of existingGroups) {
      const code = (group as { code?: unknown }).code;
      if (typeof code === "string" && code.trim()) {
        await groupsService.remove(code);
      }
    }
  }

  return {
    groupsService,
    draftsService,
    restore: () => {
      if (previous === undefined) {
        delete process.env.DATA_SOURCE;
      } else {
        process.env.DATA_SOURCE = previous;
      }
    },
  };
}

function createGroupPayload(
  overrides: Partial<CreateGroupDto> = {},
): CreateGroupDto {
  return {
    code: "DRAFT-G-001",
    name: "Draft Target Group",
    status: "Active",
    arrivalDate: "2026-06-10",
    returnDate: "2026-06-18",
    pax: 45,
    packageName: "Standard Gold",
    durationDays: 9,
    timeline: [],
    itinerary: [],
    notes: [],
    checklistAssignments: [],
    ...overrides,
  };
}

describe("HotelAgreementDrafts", () => {
  runCase("hotel agreement draft create update delete", async () => {
    const { draftsService, restore } = await createMemoryServices();

    try {
      const created = (await draftsService.create({
        city: AgreementCity.MAKKAH,
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-DRAFT-001",
        pax: 45,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-06-10",
        stayEnd: "2026-06-13",
        notes: "Received before group code.",
      })) as {
        id: string;
        agreementNumber: string;
        assignmentStatus: string;
      };

      expect(created.agreementNumber).toBe("AG-DRAFT-001");
      expect(created.assignmentStatus).toBe("Unassigned");

      const updated = (await draftsService.update(created.id, {
        city: AgreementCity.MAKKAH,
        hotelName: "Makkah Clock Tower",
        agreementNumber: "AG-DRAFT-001A",
        pax: 46,
        status: AgreementApprovalStatus.APPROVED,
        stayStart: "2026-06-10",
        stayEnd: "2026-06-13",
      })) as {
        hotelName: string;
        agreementNumber: string;
        status: string;
      };

      expect(updated.hotelName).toBe("Makkah Clock Tower");
      expect(updated.agreementNumber).toBe("AG-DRAFT-001A");
      expect(updated.status).toBe(AgreementApprovalStatus.APPROVED);

      await draftsService.remove(created.id);
      const drafts = await draftsService.findAll();
      expect(drafts.length).toBe(0);
    } finally {
      restore();
    }
  });

  runCase("hotel agreement draft assign to group", async () => {
    const { groupsService, draftsService, restore } =
      await createMemoryServices();

    try {
      await groupsService.create(createGroupPayload());
      const created = (await draftsService.create({
        city: AgreementCity.MAKKAH,
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-ASSIGN-001",
        pax: 45,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-06-10",
        stayEnd: "2026-06-13",
      })) as {
        id: string;
      };

      const assigned = (await draftsService.assign(created.id, {
        groupCode: "DRAFT-G-001",
      })) as {
        assignmentStatus: string;
        assignedGroups: Array<{ groupCode: string }>;
      };

      expect(assigned.assignmentStatus).toBe("Assigned");
      expect(assigned.assignedGroups[0]?.groupCode).toBe("DRAFT-G-001");

      const group = (await groupsService.findOneByIdOrCode("DRAFT-G-001")) as {
        visaSetup?: {
          hotelAgreements?: Array<{
            agreementNumber: string;
            city: AgreementCity;
          }>;
        };
      };
      expect(group.visaSetup?.hotelAgreements?.length).toBe(1);
      expect(
        group.visaSetup?.hotelAgreements?.[0]?.agreementNumber,
      ).toBe("AG-ASSIGN-001");
      expect(
        group.visaSetup?.hotelAgreements?.[0]?.city,
      ).toBe(AgreementCity.MAKKAH);

      await groupsService.create(
        createGroupPayload({
          code: "DRAFT-G-002",
          name: "Draft Target Madinah First",
        }),
      );
      const createdMadinah = (await draftsService.create({
        city: AgreementCity.MADINAH,
        hotelName: "Madinah Solo",
        agreementNumber: "AG-ASSIGN-MAD-001",
        pax: 45,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-06-14",
        stayEnd: "2026-06-18",
      })) as {
        id: string;
      };

      const assignedMadinah = (await draftsService.assign(createdMadinah.id, {
        groupCode: "DRAFT-G-002",
      })) as {
        assignmentStatus: string;
        assignedGroups: Array<{ groupCode: string }>;
      };

      expect(assignedMadinah.assignmentStatus).toBe("Assigned");
      expect(assignedMadinah.assignedGroups[0]?.groupCode).toBe("DRAFT-G-002");

      const madinahFirstGroup = (await groupsService.findOneByIdOrCode(
        "DRAFT-G-002",
      )) as {
        visaSetup?: {
          hotelAgreements?: Array<{
            agreementNumber: string;
            city: AgreementCity;
          }>;
        };
      };
      expect(madinahFirstGroup.visaSetup?.hotelAgreements?.length).toBe(1);
      expect(
        madinahFirstGroup.visaSetup?.hotelAgreements?.[0]?.agreementNumber,
      ).toBe("AG-ASSIGN-MAD-001");
      expect(
        madinahFirstGroup.visaSetup?.hotelAgreements?.[0]?.city,
      ).toBe(AgreementCity.MADINAH);
    } finally {
      restore();
    }
  });

  runCase("hotel agreement draft unassign from group", async () => {
    const { groupsService, draftsService, restore } =
      await createMemoryServices();

    try {
      await groupsService.create(createGroupPayload());
      const created = (await draftsService.create({
        city: AgreementCity.MAKKAH,
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-UNASSIGN-001",
        pax: 45,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-06-10",
        stayEnd: "2026-06-13",
      })) as {
        id: string;
      };

      await draftsService.assign(created.id, {
        groupCode: "DRAFT-G-001",
      });

      const unassigned = (await draftsService.unassign(created.id)) as {
        assignmentStatus: string;
        assignedGroups: Array<unknown>;
      };

      expect(unassigned.assignmentStatus).toBe("Unassigned");
      expect(unassigned.assignedGroups.length).toBe(0);

      const group = (await groupsService.findOneByIdOrCode("DRAFT-G-001")) as {
        visaSetup?: {
          hotelAgreements?: Array<unknown>;
        };
      };
      expect(group.visaSetup?.hotelAgreements?.length).toBe(0);

      const unassignedDrafts = (await draftsService.findAll(
        undefined,
        "unassigned",
      )) as Array<{ id: string }>;
      expect(
        unassignedDrafts.some((draft) => draft.id === created.id),
      ).toBe(true);
    } finally {
      restore();
    }
  });

  runCase("hotel agreement draft auto-rejection after 24h", async () => {
    const { draftsService, restore } = await createMemoryServices();

    try {
      const created = (await draftsService.create({
        city: AgreementCity.MAKKAH,
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-AUTO-REJECT",
        pax: 45,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-06-10",
        stayEnd: "2026-06-13",
      })) as { id: string; status: string };

      expect(created.status).toBe(AgreementApprovalStatus.WAITING);

      // Manipulate createdAt to be 25 hours ago
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      const memoryDrafts = draftsService["memoryDrafts"];
      const draftInMemory = memoryDrafts.find((d) => d.id === created.id);
      if (draftInMemory) {
        draftInMemory.createdAt = twentyFiveHoursAgo;
        draftInMemory.updatedAt = twentyFiveHoursAgo;
      }

      // Call findAll to trigger auto-rejection
      const allDrafts = (await draftsService.findAll()) as Array<{ id: string; status: string }>;
      const found = allDrafts.find((d) => d.id === created.id);
      expect(found).toBeTruthy();
      expect(found.status).toBe(AgreementApprovalStatus.REJECTED);

      // Verify assign throws error
      await expect(
        draftsService.assign(created.id, { groupCode: "ANY-GROUP" })
      ).rejects.toThrow(/ditolak/i);
    } finally {
      restore();
    }
  });

  runCase("hotel agreement draft multi-group assignment and capacity", async () => {
    const { groupsService, draftsService, restore } =
      await createMemoryServices();

    try {
      // 1. Create two groups
      await groupsService.create(
        createGroupPayload({
          code: "GROUP-A",
          pax: 23,
        }),
      );
      await groupsService.create(
        createGroupPayload({
          code: "GROUP-B",
          pax: 7,
        }),
      );

      // 2. Create a draft with 30 pax
      const draft = (await draftsService.create({
        city: AgreementCity.MADINAH,
        hotelName: "Swissotel Madinah",
        agreementNumber: "AG-MULTI-30",
        pax: 30,
        status: AgreementApprovalStatus.APPROVED,
        stayStart: "2026-06-14",
        stayEnd: "2026-06-18",
      })) as {
        id: string;
        remainingPax: number;
      };

      expect(draft.remainingPax).toBe(30);

      // 3. Assign to GROUP-A (23 pax)
      const assignedA = (await draftsService.assign(draft.id, {
        groupCode: "GROUP-A",
      })) as {
        assignmentStatus: string;
        remainingPax: number;
        assignedGroups: Array<{ groupCode: string; pax: number }>;
      };

      expect(assignedA.assignmentStatus).toBe("Partially Assigned"); // Not fully assigned yet
      expect(assignedA.remainingPax).toBe(7);
      expect(assignedA.assignedGroups.length).toBe(1);
      expect(assignedA.assignedGroups[0].groupCode).toBe("GROUP-A");
      expect(assignedA.assignedGroups[0].pax).toBe(23);

      // Verify group A has the agreement with 23 pax
      const groupA = (await groupsService.findOneByIdOrCode("GROUP-A")) as any;
      expect(groupA.visaSetup?.hotelAgreements?.length).toBe(1);
      expect(groupA.visaSetup?.hotelAgreements?.[0]?.pax).toBe(23);

      // 4. Assign to GROUP-B (7 pax)
      const assignedB = (await draftsService.assign(draft.id, {
        groupCode: "GROUP-B",
      })) as {
        assignmentStatus: string;
        remainingPax: number;
        assignedGroups: Array<{ groupCode: string; pax: number }>;
      };

      expect(assignedB.assignmentStatus).toBe("Assigned"); // Fully assigned now!
      expect(assignedB.remainingPax).toBe(0);
      expect(assignedB.assignedGroups.length).toBe(2);

      // Verify group B has the agreement with 7 pax
      const groupB = (await groupsService.findOneByIdOrCode("GROUP-B")) as any;
      expect(groupB.visaSetup?.hotelAgreements?.length).toBe(1);
      expect(groupB.visaSetup?.hotelAgreements?.[0]?.pax).toBe(7);

      // 5. Trying to assign again when remaining pax is 0 should fail
      await expect(
        draftsService.assign(draft.id, { groupCode: "GROUP-A" })
      ).rejects.toThrow(/fully assigned/i);

      // 6. Unassign only GROUP-A
      const unassignedA = (await draftsService.unassign(draft.id, "GROUP-A")) as {
        assignmentStatus: string;
        remainingPax: number;
        assignedGroups: Array<{ groupCode: string; pax: number }>;
      };

      expect(unassignedA.assignmentStatus).toBe("Partially Assigned"); // Back to partially assigned because remaining capacity is > 0 and GROUP-B is still assigned
      expect(unassignedA.remainingPax).toBe(23);
      expect(unassignedA.assignedGroups.length).toBe(1);
      expect(unassignedA.assignedGroups[0].groupCode).toBe("GROUP-B");

      // Verify GROUP-A has 0 agreements, GROUP-B still has its agreement
      const groupAPost = (await groupsService.findOneByIdOrCode("GROUP-A")) as any;
      expect(groupAPost.visaSetup?.hotelAgreements?.length).toBe(0);

      const groupBPost = (await groupsService.findOneByIdOrCode("GROUP-B")) as any;
      expect(groupBPost.visaSetup?.hotelAgreements?.length).toBe(1);
      expect(groupBPost.visaSetup?.hotelAgreements?.[0]?.pax).toBe(7);

    } finally {
      restore();
    }
  });

  runCase("hotel agreement draft update cascade to linked agreements", async () => {
    const { groupsService, draftsService, restore } =
      await createMemoryServices();

    try {
      await groupsService.create(
        createGroupPayload({
          code: "GROUP-C",
          pax: 25,
        }),
      );

      const draft = (await draftsService.create({
        city: AgreementCity.MAKKAH,
        hotelName: "Hotel Original",
        agreementNumber: "AG-ORIGINAL",
        pax: 30,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-06-10",
        stayEnd: "2026-06-15",
      })) as {
        id: string;
      };

      await draftsService.assign(draft.id, {
        groupCode: "GROUP-C",
      });

      const groupPre = (await groupsService.findOneByIdOrCode("GROUP-C")) as any;
      expect(groupPre.visaSetup?.hotelAgreements?.length).toBe(1);
      expect(groupPre.visaSetup?.hotelAgreements?.[0]?.hotelName).toBe("Hotel Original");
      expect(groupPre.visaSetup?.hotelAgreements?.[0]?.agreementNumber).toBe("AG-ORIGINAL");
      expect(groupPre.visaSetup?.hotelAgreements?.[0]?.status).toBe(AgreementApprovalStatus.WAITING);

      await draftsService.update(draft.id, {
        city: AgreementCity.MAKKAH,
        hotelName: "Hotel Updated",
        agreementNumber: "AG-UPDATED",
        pax: 30,
        status: AgreementApprovalStatus.APPROVED,
        stayStart: "2026-06-11",
        stayEnd: "2026-06-16",
      });

      const groupPost = (await groupsService.findOneByIdOrCode("GROUP-C")) as any;
      expect(groupPost.visaSetup?.hotelAgreements?.length).toBe(1);
      expect(groupPost.visaSetup?.hotelAgreements?.[0]?.hotelName).toBe("Hotel Updated");
      expect(groupPost.visaSetup?.hotelAgreements?.[0]?.agreementNumber).toBe("AG-UPDATED");
      expect(groupPost.visaSetup?.hotelAgreements?.[0]?.status).toBe(AgreementApprovalStatus.APPROVED);
      expect(groupPost.visaSetup?.hotelAgreements?.[0]?.stayStart).toBe("2026-06-11");
      expect(groupPost.visaSetup?.hotelAgreements?.[0]?.stayEnd).toBe("2026-06-16");
    } finally {
      restore();
    }
  });

  runCase("hotel agreement draft partial consumption and period capacity validation", async () => {
    const { groupsService, draftsService, restore } = await createMemoryServices();

    try {
      await groupsService.create(
        createGroupPayload({
          code: "GROUP-P-1",
          pax: 4,
          arrivalDate: "2026-06-10",
          returnDate: "2026-06-15",
          visaSetup: {
            visaStatus: VisaStatus.DRAFT,
            syarikah: "Provider",
            paymentStatus: VisaPaymentStatus.UNPAID,
            hotelAgreements: [
              {
                id: "existing-mak-b",
                city: AgreementCity.MAKKAH,
                hotelName: "Hotel B",
                agreementNumber: "AG-B",
                pax: 4,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: "2026-06-10",
                stayEnd: "2026-06-13",
              }
            ],
            raudhahAppointments: [],
          } as any
        })
      );

      const draftA = (await draftsService.create({
        city: AgreementCity.MAKKAH,
        hotelName: "Hotel A",
        agreementNumber: "AG-A",
        pax: 4,
        status: AgreementApprovalStatus.APPROVED,
        stayStart: "2026-06-01",
        stayEnd: "2026-06-30",
      })) as { id: string; remainingPax: number };

      await draftsService.assign(draftA.id, {
        groupCode: "GROUP-P-1",
      });

      const group = (await groupsService.findOneByIdOrCode("GROUP-P-1")) as any;
      const hotelAgreements = group.visaSetup?.hotelAgreements ?? [];
      expect(hotelAgreements.length).toBe(2);
      const assignedA = hotelAgreements.find((h: any) => h.agreementNumber === "AG-A");
      expect(assignedA).toBeTruthy();
      expect(assignedA.stayStart).toBe("2026-06-13");
      expect(assignedA.stayEnd).toBe("2026-06-15");
      expect(assignedA.pax).toBe(4);

      await groupsService.create(
        createGroupPayload({
          code: "GROUP-P-2",
          pax: 4,
          arrivalDate: "2026-06-01",
          returnDate: "2026-06-12",
        })
      );

      const assignedTo2 = (await draftsService.assign(draftA.id, {
        groupCode: "GROUP-P-2",
      })) as any;
      expect(assignedTo2).toBeTruthy();
      const group2 = (await groupsService.findOneByIdOrCode("GROUP-P-2")) as any;
      const hotelAgreements2 = group2.visaSetup?.hotelAgreements ?? [];
      expect(hotelAgreements2.length).toBe(1);
      expect(hotelAgreements2[0].agreementNumber).toBe("AG-A");
      expect(hotelAgreements2[0].stayStart).toBe("2026-06-01");
      expect(hotelAgreements2[0].stayEnd).toBe("2026-06-12");

      await groupsService.create(
        createGroupPayload({
          code: "GROUP-P-3",
          pax: 4,
          arrivalDate: "2026-06-12",
          returnDate: "2026-06-15",
        })
      );
      await expect(
        draftsService.assign(draftA.id, { groupCode: "GROUP-P-3" })
      ).rejects.toThrow(/remaining capacity/i);

    } finally {
      restore();
    }
  });

  runCase("hotel agreement draft explicit sub-period assignment dates override", async () => {
    const { groupsService, draftsService, restore } = await createMemoryServices();

    try {
      await groupsService.create(
        createGroupPayload({
          code: "GROUP-SUB-1",
          pax: 5,
          arrivalDate: "2026-06-10",
          returnDate: "2026-06-20",
        })
      );

      const draft = (await draftsService.create({
        city: AgreementCity.MAKKAH,
        hotelName: "Swissotel Sub",
        agreementNumber: "AG-SUB",
        pax: 10,
        status: AgreementApprovalStatus.APPROVED,
        stayStart: "2026-06-01",
        stayEnd: "2026-06-30",
      })) as { id: string };

      // Explicitly assign only for 12 June - 15 June (3 nights)
      await draftsService.assign(draft.id, {
        groupCode: "GROUP-SUB-1",
        stayStart: "2026-06-12",
        stayEnd: "2026-06-15",
      });

      const group = (await groupsService.findOneByIdOrCode("GROUP-SUB-1")) as any;
      const hotelAgreements = group.visaSetup?.hotelAgreements ?? [];
      expect(hotelAgreements.length).toBe(1);
      expect(hotelAgreements[0].stayStart).toBe("2026-06-12");
      expect(hotelAgreements[0].stayEnd).toBe("2026-06-15");
      expect(hotelAgreements[0].pax).toBe(5);

    } finally {
      restore();
    }
  });
});
