import assert from "node:assert/strict";
import {
  AgreementApprovalStatus,
  AgreementCity,
  GroupRaudhahStatus,
  GroupTone,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { CreateGroupDto } from "../dto/create-group.dto";
import { GroupsService } from "../application/groups.service";
import { PrismaService } from "../../prisma/prisma.service";

async function createMemoryService(): Promise<{
  service: GroupsService;
  restore: () => void;
}> {
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

function createGroupPayload(
  overrides: Partial<CreateGroupDto> = {},
): CreateGroupDto {
  return {
    code: "G-000",
    name: "Base Group",
    status: "Active",
    arrivalDate: "2026-04-10",
    returnDate: "2026-04-18",
    pax: 40,
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

async function testSearchFilterPagination(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "G-101",
        name: "Majestic Alpha",
        visaSetup: {
          visaStatus: VisaStatus.ISSUED,
          syarikah: "Alpha Provider",
          paymentStatus: VisaPaymentStatus.PAID,
          outstandingAmount: 0,
          hotelAgreements: [
            {
              city: AgreementCity.MAKKAH,
              hotelName: "Makkah Clock",
              agreementNumber: "M-101",
              pax: 40,
              status: AgreementApprovalStatus.APPROVED,
              stayStart: "2026-04-02",
              stayEnd: "2026-04-03",
            },
          ],
          raudhahAppointments: [],
        },
      }),
    );
    await service.create(
      createGroupPayload({
        code: "G-102",
        name: "Honeymoon Special",
        visaSetup: {
          visaStatus: VisaStatus.DRAFT,
          syarikah: "Beta Provider",
          paymentStatus: VisaPaymentStatus.UNPAID,
          outstandingAmount: 1200,
          hotelAgreements: [],
          raudhahAppointments: [],
        },
      }),
    );
    await service.create(
      createGroupPayload({
        code: "G-103",
        name: "Family Transit",
      }),
    );
    await service.create(
      createGroupPayload({
        code: "G-104",
        name: "Inactive Archive",
        status: "Inactive",
        tone: GroupTone.INACTIVE,
        visaSetup: {
          visaStatus: VisaStatus.ISSUED,
          syarikah: "Gamma Provider",
          paymentStatus: VisaPaymentStatus.PAID,
          outstandingAmount: 0,
          hotelAgreements: [
            {
              city: AgreementCity.MAKKAH,
              hotelName: "Archive Hotel",
              agreementNumber: "M-104",
              pax: 18,
              status: AgreementApprovalStatus.APPROVED,
              stayStart: "2026-04-06",
              stayEnd: "2026-04-08",
            },
          ],
          raudhahAppointments: [],
        },
      }),
    );

    const pagedResult = await service.findAll(undefined, {
      page: 1,
      pageSize: 2,
    });
    assert.equal(Array.isArray(pagedResult), false);
    const paged = pagedResult as {
      items: unknown[];
      total: number;
      page: number;
      pageSize: number;
    };
    assert.equal(paged.total, 4);
    assert.equal(paged.items.length, 2);
    assert.equal(paged.page, 1);
    assert.equal(paged.pageSize, 2);

    const searched = await service.findAll("honeymoon");
    assert.equal(Array.isArray(searched), true);
    assert.equal((searched as unknown[]).length, 1);

    const normalizedCodeSearch = await service.findAll("g102");
    assert.equal(Array.isArray(normalizedCodeSearch), true);
    assert.equal(
      (normalizedCodeSearch as Array<{ code?: string }>)[0]?.code,
      "G-102",
    );

    const unpaid = await service.findAll(undefined, { filter: "unpaid" });
    assert.equal(Array.isArray(unpaid), true);
    assert.equal((unpaid as unknown[]).length, 2);

    const missingHotel = await service.findAll(undefined, {
      filter: "missing-hotel",
    });
    assert.equal(Array.isArray(missingHotel), true);
    assert.equal((missingHotel as unknown[]).length, 2);

    const activeOnly = (await service.findAll(undefined, {
      activeOnly: true,
    })) as Array<{ code?: string }>;
    assert.equal(activeOnly.length, 3);
    assert.deepEqual(
      activeOnly.map((group) => group.code),
      ["G-103", "G-102", "G-101"],
    );

    const summaryList = (await service.findAll(undefined, {
      projection: "summary",
    })) as Array<Record<string, unknown>>;
    assert.equal(summaryList.length, 4);
    const summaryGroup = summaryList.find((group) => group.code === "G-101");
    assert.ok(summaryGroup);
    assert.equal(
      Object.prototype.hasOwnProperty.call(summaryGroup, "itinerary"),
      true,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(summaryGroup, "notes"),
      true,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(summaryGroup, "visaSetup"),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        summaryGroup,
        "checklistAssignments",
      ),
      false,
    );
  } finally {
    restore();
  }
}

async function testTravelDateValidation(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await assert.rejects(
      async () =>
        service.create(
          createGroupPayload({
            code: "G-150",
            arrivalDate: "2026-04-12",
            returnDate: "2026-04-10",
          }),
        ),
      /Return date must be on or after arrival date/i,
    );

    await service.create(
      createGroupPayload({
        code: "G-151",
      }),
    );

    await assert.rejects(
      async () =>
        service.update("G-151", {
          returnDate: "2026-04-09",
        }),
      /Return date must be on or after arrival date/i,
    );
  } finally {
    restore();
  }
}

async function testCreateIdentityWorkspace(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    const created = (await service.createIdentity({
      code: " g-identity ",
      name: " Nusuk Entry Group ",
      packageName: " Nusuk Package ",
      pax: 25,
      totalBuses: 1,
      arrivalDate: "2026-04-12",
      returnDate: "2026-04-18",
      musyrif: {
        name: " Ust Identity ",
        phone: " 081234 ",
        avatar: " https://example.com/avatar.png ",
      },
    })) as {
      code: string;
      name: string;
      status: string;
      itinerary: unknown[];
      visaSetup?: unknown;
      notes: Array<{ text: string }>;
      musyrif: { name: string; phone: string };
    };

    assert.equal(created.code, "G-IDENTITY");
    assert.equal(created.name, "Nusuk Entry Group");
    assert.equal(created.status, "Entry Only");
    assert.equal(created.itinerary.length, 0);
    assert.equal(created.visaSetup, undefined);
    assert.equal(created.musyrif.name, "Ust Identity");
    assert.equal(created.musyrif.phone, "081234");
    assert.equal(
      created.notes[0]?.text.includes(
        "Agreement and itinerary can be linked later",
      ),
      true,
    );

    const logs = await service.listAuditLogs("G-IDENTITY");
    assert.equal(
      logs.some((entry) => entry.action === "group.identity.created"),
      true,
    );
  } finally {
    restore();
  }
}

async function testItineraryCrudWithAudit(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "G-201",
        name: "Itinerary Group",
      }),
    );

    const afterAdd = (await service.addItineraryItem("G-201", {
      dateLabel: "2 Apr",
      yearLabel: "2026",
      category: "Arrival",
      title: "Jeddah Arrival",
      meta: "SV-827 | Hajj Terminal",
      icon: "flight_land",
      highlighted: true,
      isoDate: "2026-04-02",
      time: "04:20",
      fromLocation: "JED Airport",
      toLocation: "Makkah Hotel",
      notes: "Driver waiting at gate 4",
    })) as {
      itinerary: Array<{ id: string; title: string; sortOrder: number }>;
    };

    assert.equal(afterAdd.itinerary.length, 1);
    const itemId = afterAdd.itinerary[0].id;

    const afterUpdate = (await service.updateItineraryItem("G-201", itemId, {
      dateLabel: "2 Apr",
      yearLabel: "2026",
      category: "Arrival",
      title: "Jeddah Arrival Updated",
      meta: "SV-827 | Hajj Terminal",
      icon: "flight_land",
      highlighted: true,
      isoDate: "2026-04-02",
      time: "04:30",
      fromLocation: "JED Airport",
      toLocation: "Makkah Hotel",
      notes: "Updated note",
    })) as {
      itinerary: Array<{ id: string; title: string }>;
    };

    assert.equal(afterUpdate.itinerary[0].title, "Jeddah Arrival Updated");

    const afterRemove = (await service.removeItineraryItem(
      "G-201",
      itemId,
    )) as {
      itinerary: unknown[];
    };
    assert.equal(afterRemove.itinerary.length, 0);

    const logs = await service.listAuditLogs("G-201");
    const actions = logs.map((entry) => entry.action);
    assert.equal(actions.includes("itinerary.added"), true);
    assert.equal(actions.includes("itinerary.updated"), true);
    assert.equal(actions.includes("itinerary.deleted"), true);
  } finally {
    restore();
  }
}

async function testItineraryTitleFallbackWithoutExplicitTitle(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "G-202",
        name: "Derived Title Group",
      }),
    );

    const afterAdd = (await service.addItineraryItem("G-202", {
      dateLabel: "5 Apr",
      yearLabel: "2026",
      category: "Transfer",
      meta: "08:00 | Route 40",
      icon: "airport_shuttle",
      isoDate: "2026-04-05",
      time: "08:00",
      fromLocation: "Makkah Hotel",
      toLocation: "Madinah Hotel",
    })) as {
      itinerary: Array<{ id: string; title: string }>;
    };

    assert.equal(
      afterAdd.itinerary[0].title,
      "Transfer from Makkah Hotel to Madinah Hotel",
    );
  } finally {
    restore();
  }
}

async function testVisaAndRaudhahOps(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "G-301",
        name: "Visa Ops Group",
      }),
    );

    const afterAddHotel = (await service.addVisaHotelAgreement("G-301", {
      city: AgreementCity.MAKKAH,
      hotelName: "Swissotel",
      agreementNumber: "MAK-301",
      pax: 38,
      status: AgreementApprovalStatus.WAITING,
      stayStart: "2026-04-10",
      stayEnd: "2026-04-13",
    })) as {
      visaSetup: {
        hotelAgreements: Array<{ id: string; status: AgreementApprovalStatus }>;
      };
    };

    assert.equal(afterAddHotel.visaSetup.hotelAgreements.length, 1);
    const hotelId = afterAddHotel.visaSetup.hotelAgreements[0].id;
    assert.equal(
      afterAddHotel.visaSetup.hotelAgreements[0].status,
      AgreementApprovalStatus.WAITING,
    );

    const afterUpdateHotel = (await service.updateVisaHotelAgreement(
      "G-301",
      hotelId,
      {
        city: AgreementCity.MAKKAH,
        hotelName: "Swissotel",
        agreementNumber: "MAK-301",
        pax: 38,
        status: AgreementApprovalStatus.APPROVED,
        stayStart: "2026-04-10",
        stayEnd: "2026-04-13",
      },
    )) as {
      visaSetup: {
        hotelAgreements: Array<{ status: AgreementApprovalStatus }>;
      };
    };
    assert.equal(
      afterUpdateHotel.visaSetup.hotelAgreements[0].status,
      AgreementApprovalStatus.APPROVED,
    );

    const afterRemoveHotel = (await service.removeVisaHotelAgreement(
      "G-301",
      hotelId,
    )) as {
      visaSetup: { hotelAgreements: unknown[] };
    };
    assert.equal(afterRemoveHotel.visaSetup.hotelAgreements.length, 0);

    const afterUpsertRaudhah = (await service.upsertPrimaryRaudhahAppointment(
      "G-301",
      {
        date: "2026-04-15",
        status: GroupRaudhahStatus.AFTER,
      },
    )) as {
      visaSetup: {
        raudhahAppointments: Array<{
          date: string;
          status: GroupRaudhahStatus;
        }>;
      };
    };
    assert.equal(afterUpsertRaudhah.visaSetup.raudhahAppointments.length, 1);

    const afterSecondUpsert = (await service.upsertPrimaryRaudhahAppointment(
      "G-301",
      {
        date: "2026-04-16",
        status: GroupRaudhahStatus.BEFORE,
      },
    )) as {
      visaSetup: {
        raudhahAppointments: Array<{
          date: string;
          status: GroupRaudhahStatus;
        }>;
      };
    };
    assert.equal(afterSecondUpsert.visaSetup.raudhahAppointments.length, 1);
    assert.equal(
      afterSecondUpsert.visaSetup.raudhahAppointments[0].date,
      "2026-04-16",
    );
    assert.equal(
      afterSecondUpsert.visaSetup.raudhahAppointments[0].status,
      GroupRaudhahStatus.BEFORE,
    );
  } finally {
    restore();
  }
}

async function testVisaAgreementRules(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await assert.rejects(
      async () =>
        service.create(
          createGroupPayload({
            code: "G-401",
            name: "Invalid Madinah Only",
            visaSetup: {
              visaStatus: VisaStatus.DRAFT,
              syarikah: "Provider Test",
              paymentStatus: VisaPaymentStatus.UNPAID,
              outstandingAmount: 0,
              hotelAgreements: [
                {
                  city: AgreementCity.MADINAH,
                  hotelName: "Madinah Hotel",
                  agreementNumber: "MAD-401",
                  pax: 20,
                  status: AgreementApprovalStatus.WAITING,
                  stayStart: "2026-04-10",
                  stayEnd: "2026-04-12",
                },
              ],
              raudhahAppointments: [],
            },
          }),
        ),
      /Makkah agreement is required/i,
    );

    await service.create(
      createGroupPayload({
        code: "G-402",
        name: "Continuity Rules",
      }),
    );

    const afterFirstMakkah = (await service.addVisaHotelAgreement("G-402", {
      city: AgreementCity.MAKKAH,
      hotelName: "Makkah Hotel A",
      agreementNumber: "MAK-402-A",
      pax: 40,
      status: AgreementApprovalStatus.WAITING,
      stayStart: "2026-04-10",
      stayEnd: "2026-04-12",
    })) as {
      visaSetup: {
        hotelAgreements: Array<{
          id: string;
          city: AgreementCity;
          stayStart: string;
        }>;
      };
    };

    await service.addVisaHotelAgreement("G-402", {
      city: AgreementCity.MAKKAH,
      hotelName: "Makkah Hotel B",
      agreementNumber: "MAK-402-B",
      pax: 40,
      status: AgreementApprovalStatus.WAITING,
      stayStart: "2026-04-12",
      stayEnd: "2026-04-15",
    });

    await assert.rejects(
      async () =>
        service.addVisaHotelAgreement("G-402", {
          city: AgreementCity.MAKKAH,
          hotelName: "Makkah Hotel C",
          agreementNumber: "MAK-402-C",
          pax: 40,
          status: AgreementApprovalStatus.WAITING,
          stayStart: "2026-04-17",
          stayEnd: "2026-04-18",
        }),
      /connected/i,
    );

    const secondMakkahId = (
      (await service.findOneByIdOrCode("G-402")) as {
        visaSetup: {
          hotelAgreements: Array<{
            id: string;
            city: AgreementCity;
            stayStart: string;
            stayEnd: string;
          }>;
        };
      }
    ).visaSetup.hotelAgreements.find(
      (agreement) =>
        agreement.city === AgreementCity.MAKKAH &&
        agreement.stayStart === "2026-04-12" &&
        agreement.stayEnd === "2026-04-15",
    )?.id;

    assert.equal(typeof secondMakkahId, "string");

    await assert.rejects(
      async () =>
        service.updateVisaHotelAgreement("G-402", secondMakkahId!, {
          city: AgreementCity.MAKKAH,
          hotelName: "Makkah Hotel B",
          agreementNumber: "MAK-402-B",
          pax: 40,
          status: AgreementApprovalStatus.WAITING,
          stayStart: "2026-04-14",
          stayEnd: "2026-04-16",
        }),
      /connected/i,
    );

    await service.create(
      createGroupPayload({
        code: "G-403",
        name: "Incremental Agreement Delete",
      }),
    );

    const afterMakkah = (await service.addVisaHotelAgreement("G-403", {
      city: AgreementCity.MAKKAH,
      hotelName: "Makkah Prime",
      agreementNumber: "MAK-403-A",
      pax: 35,
      status: AgreementApprovalStatus.WAITING,
      stayStart: "2026-05-01",
      stayEnd: "2026-05-03",
    })) as {
      visaSetup: {
        hotelAgreements: Array<{
          id: string;
          city: AgreementCity;
          stayStart: string;
        }>;
      };
    };
    const makkahHotelId = afterMakkah.visaSetup.hotelAgreements.find(
      (agreement) =>
        agreement.city === AgreementCity.MAKKAH &&
        agreement.stayStart === "2026-05-01",
    )?.id;
    assert.equal(typeof makkahHotelId, "string");

    await service.addVisaHotelAgreement("G-403", {
      city: AgreementCity.MADINAH,
      hotelName: "Madinah Prime",
      agreementNumber: "MAD-403-A",
      pax: 35,
      status: AgreementApprovalStatus.WAITING,
      stayStart: "2026-05-03",
      stayEnd: "2026-05-06",
    });

    const afterRemoveMakkah = (await service.removeVisaHotelAgreement(
      "G-403",
      makkahHotelId!,
    )) as {
      visaSetup: {
        hotelAgreements: Array<{
          city: AgreementCity;
          agreementNumber: string;
        }>;
      };
    };
    assert.equal(afterRemoveMakkah.visaSetup.hotelAgreements.length, 1);
    assert.equal(
      afterRemoveMakkah.visaSetup.hotelAgreements[0]?.city,
      AgreementCity.MADINAH,
    );
    assert.equal(
      afterRemoveMakkah.visaSetup.hotelAgreements[0]?.agreementNumber,
      "MAD-403-A",
    );

    await service.create(
      createGroupPayload({
        code: "G-404",
        name: "Madinah Add Before Makkah",
      }),
    );

    const afterMadinahOnly = (await service.addVisaHotelAgreement("G-404", {
      city: AgreementCity.MADINAH,
      hotelName: "Madinah Solo",
      agreementNumber: "MAD-404",
      pax: 25,
      status: AgreementApprovalStatus.WAITING,
      stayStart: "2026-06-01",
      stayEnd: "2026-06-03",
    })) as {
      visaSetup: {
        hotelAgreements: Array<{
          city: AgreementCity;
          agreementNumber: string;
        }>;
      };
    };
    assert.equal(afterMadinahOnly.visaSetup.hotelAgreements.length, 1);
    assert.equal(
      afterMadinahOnly.visaSetup.hotelAgreements[0]?.city,
      AgreementCity.MADINAH,
    );
    assert.equal(
      afterMadinahOnly.visaSetup.hotelAgreements[0]?.agreementNumber,
      "MAD-404",
    );

    // Avoid unused variable linting in strict TS with assertion-only reads.
    assert.equal(
      afterFirstMakkah.visaSetup.hotelAgreements.some(
        (agreement) => agreement.city === AgreementCity.MAKKAH,
      ),
      true,
    );
  } finally {
    restore();
  }
}

async function testChecklistIdentityAvoidsSameTimeCollision(): Promise<void> {
  const { service, restore } = await createMemoryService();

  try {
    await service.create(
      createGroupPayload({
        code: "G-501",
        name: "Checklist Collision Guard",
      }),
    );

    await service.confirmChecklistDriver("G-501", {
      tripDate: "2026-04-15",
      activity: "Arrival",
      tripLabel: "Jeddah Arrival",
      requiredBusCount: 1,
      scheduledTime: "09:00",
      driver: {
        name: "Driver A",
        phone: "081111",
        plateNumber: "B 1001 AA",
      },
    });

    await service.confirmChecklistDriver("G-501", {
      tripDate: "2026-04-15",
      activity: "Transfer",
      tripLabel: "Makkah to Madinah",
      requiredBusCount: 1,
      scheduledTime: "09:00",
      driver: {
        name: "Driver B",
        phone: "082222",
        plateNumber: "B 2002 BB",
      },
    });

    const group = (await service.findOneByIdOrCode("G-501")) as {
      checklistAssignments: Array<{
        activity: string;
        scheduledTime: string;
        drivers: Array<{ name: string }>;
      }>;
    };

    const sameTimeAssignments = group.checklistAssignments.filter(
      (assignment) => assignment.scheduledTime === "09:00",
    );
    assert.equal(sameTimeAssignments.length, 2);
    assert.equal(
      sameTimeAssignments.some(
        (assignment) =>
          assignment.activity === "Arrival" &&
          assignment.drivers.some((driver) => driver.name === "Driver A"),
      ),
      true,
    );
    assert.equal(
      sameTimeAssignments.some(
        (assignment) =>
          assignment.activity === "Transfer" &&
          assignment.drivers.some((driver) => driver.name === "Driver B"),
      ),
      true,
    );
  } finally {
    restore();
  }
}

async function main(): Promise<void> {
  await runCase("groups search/filter/pagination", testSearchFilterPagination);
  await runCase("group travel date validation", testTravelDateValidation);
  await runCase(
    "group identity workspace creation",
    testCreateIdentityWorkspace,
  );
  await runCase("itinerary CRUD + audit", testItineraryCrudWithAudit);
  await runCase(
    "itinerary title fallback",
    testItineraryTitleFallbackWithoutExplicitTitle,
  );
  await runCase("visa + raudhah operations", testVisaAndRaudhahOps);
  await runCase("visa agreement rules", testVisaAgreementRules);
  await runCase(
    "checklist identity avoids same-time collision",
    testChecklistIdentityAvoidsSameTimeCollision,
  );
}

void main().catch((error) => {
  console.error("Test run failed:", error);
  process.exitCode = 1;
});
