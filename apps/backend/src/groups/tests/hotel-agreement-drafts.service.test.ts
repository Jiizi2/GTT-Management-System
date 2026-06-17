import assert from "node:assert/strict";
import { AgreementApprovalStatus, AgreementCity } from "@prisma/client";
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

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testCreateUpdateDeleteDraft(): Promise<void> {
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

    assert.equal(created.agreementNumber, "AG-DRAFT-001");
    assert.equal(created.assignmentStatus, "Unassigned");

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

    assert.equal(updated.hotelName, "Makkah Clock Tower");
    assert.equal(updated.agreementNumber, "AG-DRAFT-001A");
    assert.equal(updated.status, AgreementApprovalStatus.APPROVED);

    await draftsService.remove(created.id);
    const drafts = await draftsService.findAll();
    assert.equal(drafts.length, 0);
  } finally {
    restore();
  }
}

async function testAssignDraftToGroup(): Promise<void> {
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

    assert.equal(assigned.assignmentStatus, "Assigned");
    assert.equal(assigned.assignedGroups[0]?.groupCode, "DRAFT-G-001");

    const group = (await groupsService.findOneByIdOrCode("DRAFT-G-001")) as {
      visaSetup?: {
        hotelAgreements?: Array<{
          agreementNumber: string;
          city: AgreementCity;
        }>;
      };
    };
    assert.equal(group.visaSetup?.hotelAgreements?.length, 1);
    assert.equal(
      group.visaSetup?.hotelAgreements?.[0]?.agreementNumber,
      "AG-ASSIGN-001",
    );
    assert.equal(
      group.visaSetup?.hotelAgreements?.[0]?.city,
      AgreementCity.MAKKAH,
    );

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

    assert.equal(assignedMadinah.assignmentStatus, "Assigned");
    assert.equal(assignedMadinah.assignedGroups[0]?.groupCode, "DRAFT-G-002");

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
    assert.equal(madinahFirstGroup.visaSetup?.hotelAgreements?.length, 1);
    assert.equal(
      madinahFirstGroup.visaSetup?.hotelAgreements?.[0]?.agreementNumber,
      "AG-ASSIGN-MAD-001",
    );
    assert.equal(
      madinahFirstGroup.visaSetup?.hotelAgreements?.[0]?.city,
      AgreementCity.MADINAH,
    );
  } finally {
    restore();
  }
}

async function testUnassignDraftFromGroup(): Promise<void> {
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

    assert.equal(unassigned.assignmentStatus, "Unassigned");
    assert.equal(unassigned.assignedGroups.length, 0);

    const group = (await groupsService.findOneByIdOrCode("DRAFT-G-001")) as {
      visaSetup?: {
        hotelAgreements?: Array<unknown>;
      };
    };
    assert.equal(group.visaSetup?.hotelAgreements?.length, 0);

    const unassignedDrafts = (await draftsService.findAll(
      undefined,
      "unassigned",
    )) as Array<{ id: string }>;
    assert.equal(
      unassignedDrafts.some((draft) => draft.id === created.id),
      true,
    );
  } finally {
    restore();
  }
}

async function testAutoRejectionDraft(): Promise<void> {
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

    assert.equal(created.status, AgreementApprovalStatus.WAITING);

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
    assert.ok(found);
    assert.equal(found.status, AgreementApprovalStatus.REJECTED);

    // Verify assign throws error
    await assert.rejects(
      draftsService.assign(created.id, { groupCode: "ANY-GROUP" }),
      /ditolak/i
    );
  } finally {
    restore();
  }
}

async function testMultiGroupAssignment(): Promise<void> {
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

    assert.equal(draft.remainingPax, 30);

    // 3. Assign to GROUP-A (23 pax)
    const assignedA = (await draftsService.assign(draft.id, {
      groupCode: "GROUP-A",
    })) as {
      assignmentStatus: string;
      remainingPax: number;
      assignedGroups: Array<{ groupCode: string; pax: number }>;
    };

    assert.equal(assignedA.assignmentStatus, "Partially Assigned"); // Not fully assigned yet
    assert.equal(assignedA.remainingPax, 7);
    assert.equal(assignedA.assignedGroups.length, 1);
    assert.equal(assignedA.assignedGroups[0].groupCode, "GROUP-A");
    assert.equal(assignedA.assignedGroups[0].pax, 23);

    // Verify group A has the agreement with 23 pax
    const groupA = (await groupsService.findOneByIdOrCode("GROUP-A")) as any;
    assert.equal(groupA.visaSetup?.hotelAgreements?.length, 1);
    assert.equal(groupA.visaSetup?.hotelAgreements?.[0]?.pax, 23);

    // 4. Assign to GROUP-B (7 pax)
    const assignedB = (await draftsService.assign(draft.id, {
      groupCode: "GROUP-B",
    })) as {
      assignmentStatus: string;
      remainingPax: number;
      assignedGroups: Array<{ groupCode: string; pax: number }>;
    };

    assert.equal(assignedB.assignmentStatus, "Assigned"); // Fully assigned now!
    assert.equal(assignedB.remainingPax, 0);
    assert.equal(assignedB.assignedGroups.length, 2);

    // Verify group B has the agreement with 7 pax
    const groupB = (await groupsService.findOneByIdOrCode("GROUP-B")) as any;
    assert.equal(groupB.visaSetup?.hotelAgreements?.length, 1);
    assert.equal(groupB.visaSetup?.hotelAgreements?.[0]?.pax, 7);

    // 5. Trying to assign again when remaining pax is 0 should fail
    await assert.rejects(
      draftsService.assign(draft.id, { groupCode: "GROUP-A" }),
      /fully assigned/i
    );

    // 6. Unassign only GROUP-A
    const unassignedA = (await draftsService.unassign(draft.id, "GROUP-A")) as {
      assignmentStatus: string;
      remainingPax: number;
      assignedGroups: Array<{ groupCode: string; pax: number }>;
    };

    assert.equal(unassignedA.assignmentStatus, "Partially Assigned"); // Back to partially assigned because remaining capacity is > 0 and GROUP-B is still assigned
    assert.equal(unassignedA.remainingPax, 23);
    assert.equal(unassignedA.assignedGroups.length, 1);
    assert.equal(unassignedA.assignedGroups[0].groupCode, "GROUP-B");

    // Verify GROUP-A has 0 agreements, GROUP-B still has its agreement
    const groupAPost = (await groupsService.findOneByIdOrCode("GROUP-A")) as any;
    assert.equal(groupAPost.visaSetup?.hotelAgreements?.length, 0);

    const groupBPost = (await groupsService.findOneByIdOrCode("GROUP-B")) as any;
    assert.equal(groupBPost.visaSetup?.hotelAgreements?.length, 1);
    assert.equal(groupBPost.visaSetup?.hotelAgreements?.[0]?.pax, 7);

  } finally {
    restore();
  }
}

async function testDraftUpdateCascade(): Promise<void> {
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
    assert.equal(groupPre.visaSetup?.hotelAgreements?.length, 1);
    assert.equal(groupPre.visaSetup?.hotelAgreements?.[0]?.hotelName, "Hotel Original");
    assert.equal(groupPre.visaSetup?.hotelAgreements?.[0]?.agreementNumber, "AG-ORIGINAL");
    assert.equal(groupPre.visaSetup?.hotelAgreements?.[0]?.status, AgreementApprovalStatus.WAITING);

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
    assert.equal(groupPost.visaSetup?.hotelAgreements?.length, 1);
    assert.equal(groupPost.visaSetup?.hotelAgreements?.[0]?.hotelName, "Hotel Updated");
    assert.equal(groupPost.visaSetup?.hotelAgreements?.[0]?.agreementNumber, "AG-UPDATED");
    assert.equal(groupPost.visaSetup?.hotelAgreements?.[0]?.status, AgreementApprovalStatus.APPROVED);
    assert.equal(groupPost.visaSetup?.hotelAgreements?.[0]?.stayStart, "2026-06-11");
    assert.equal(groupPost.visaSetup?.hotelAgreements?.[0]?.stayEnd, "2026-06-16");
  } finally {
    restore();
  }
}

async function main(): Promise<void> {
  await runCase(
    "hotel agreement draft create update delete",
    testCreateUpdateDeleteDraft,
  );
  await runCase(
    "hotel agreement draft assign to group",
    testAssignDraftToGroup,
  );
  await runCase(
    "hotel agreement draft unassign from group",
    testUnassignDraftFromGroup,
  );
  await runCase(
    "hotel agreement draft auto-rejection after 24h",
    testAutoRejectionDraft,
  );
  await runCase(
    "hotel agreement draft multi-group assignment and capacity",
    testMultiGroupAssignment,
  );
  await runCase(
    "hotel agreement draft update cascade to linked agreements",
    testDraftUpdateCascade,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
