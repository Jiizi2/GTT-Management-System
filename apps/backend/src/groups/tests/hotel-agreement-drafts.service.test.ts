import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
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

describe("GroupsService", () => {
  runCase("groups search/filter/pagination", async () => {
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
              {
                city: AgreementCity.MADINAH,
                hotelName: "Madinah Tower",
                agreementNumber: "N-101",
                pax: 40,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: "2026-04-03",
                stayEnd: "2026-04-05",
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
          pax: 18,
          visaSetup: {
            visaStatus: VisaStatus.ISSUED,
            syarikah: "Gamma Provider",
            paymentStatus: VisaPaymentStatus.PAID,
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
              {
                city: AgreementCity.MADINAH,
                hotelName: "Archive Hotel Madinah",
                agreementNumber: "N-104",
                pax: 18,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: "2026-04-08",
                stayEnd: "2026-04-10",
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
      expect(Array.isArray(pagedResult)).toBe(false);
      const paged = pagedResult as {
        items: unknown[];
        total: number;
        page: number;
        pageSize: number;
      };
      expect(paged.total).toBe(4);
      expect(paged.items.length).toBe(2);
      expect(paged.page).toBe(1);
      expect(paged.pageSize).toBe(2);

      const searched = await service.findAll("honeymoon");
      expect(Array.isArray(searched)).toBe(true);
      expect((searched as unknown[]).length).toBe(1);

      const normalizedCodeSearch = await service.findAll("g102");
      expect(Array.isArray(normalizedCodeSearch)).toBe(true);
      expect(
        (normalizedCodeSearch as Array<{ code?: string }>)[0]?.code,
      ).toBe("G-102");

      const unpaid = await service.findAll(undefined, { filter: "unpaid" });
      expect(Array.isArray(unpaid)).toBe(true);
      expect((unpaid as unknown[]).length).toBe(2);

      const missingHotel = await service.findAll(undefined, {
        filter: "missing-hotel",
      });
      expect(Array.isArray(missingHotel)).toBe(true);
      expect((missingHotel as unknown[]).length).toBe(2);

      const activeOnly = (await service.findAll(undefined, {
        activeOnly: true,
      })) as Array<{ code?: string }>;
      expect(activeOnly.length).toBe(3);
      expect(
        activeOnly.map((group) => group.code),
      ).toEqual(["G-103", "G-102", "G-101"]);

      const summaryList = (await service.findAll(undefined, {
        projection: "summary",
      })) as Array<Record<string, unknown>>;
      expect(summaryList.length).toBe(4);
      const summaryGroup = summaryList.find((group) => group.code === "G-101");
      expect(summaryGroup).toBeTruthy();
      expect(
        Object.prototype.hasOwnProperty.call(summaryGroup, "itinerary"),
      ).toBe(true);
      expect(
        Object.prototype.hasOwnProperty.call(summaryGroup, "notes"),
      ).toBe(true);
      expect(
        Object.prototype.hasOwnProperty.call(summaryGroup, "visaSetup"),
      ).toBe(true);
      expect(
        Object.prototype.hasOwnProperty.call(
          summaryGroup,
          "checklistAssignments",
        ),
      ).toBe(false);
    } finally {
      restore();
    }
  });

  runCase("group travel date validation", async () => {
    const { service, restore } = await createMemoryService();

    try {
      await expect(
        async () =>
          service.create(
            createGroupPayload({
              code: "G-150",
              arrivalDate: "2026-04-12",
              returnDate: "2026-04-10",
            }),
          ),
      ).rejects.toThrow(/Return date must be on or after arrival date/i);

      await service.create(
        createGroupPayload({
          code: "G-151",
        }),
      );

      await expect(
        async () =>
          service.update("G-151", {
            returnDate: "2026-04-09",
          }),
      ).rejects.toThrow(/Return date must be on or after arrival date/i);
    } finally {
      restore();
    }
  });

  runCase("group identity workspace creation", async () => {
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

      expect(created.code).toBe("G-IDENTITY");
      expect(created.name).toBe("Nusuk Entry Group");
      expect(created.status).toBe("Entry Only");
      expect(created.itinerary.length).toBe(0);
      expect(created.visaSetup).toBe(undefined);
      expect(created.musyrif.name).toBe("Ust Identity");
      expect(created.musyrif.phone).toBe("081234");
      expect(
        created.notes[0]?.text.includes(
          "Agreement and itinerary can be linked later",
        ),
      ).toBe(true);

      const logs = await service.listAuditLogs("G-IDENTITY");
      expect(
        logs.some((entry) => entry.action === "group.identity.created"),
      ).toBe(true);
    } finally {
      restore();
    }
  });

  runCase("itinerary CRUD + audit", async () => {
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

      expect(afterAdd.itinerary.length).toBe(1);
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

      expect(afterUpdate.itinerary[0].title).toBe("Jeddah Arrival Updated");

      const afterRemove = (await service.removeItineraryItem(
        "G-201",
        itemId,
      )) as {
        itinerary: unknown[];
      };
      expect(afterRemove.itinerary.length).toBe(0);

      const logs = await service.listAuditLogs("G-201");
      const actions = logs.map((entry) => entry.action);
      expect(actions.includes("itinerary.added")).toBe(true);
      expect(actions.includes("itinerary.updated")).toBe(true);
      expect(actions.includes("itinerary.deleted")).toBe(true);
    } finally {
      restore();
    }
  });

  runCase("itinerary title fallback", async () => {
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

      expect(
        afterAdd.itinerary[0].title,
      ).toBe("Transfer from Makkah Hotel to Madinah Hotel");
    } finally {
      restore();
    }
  });

  runCase("visa + raudhah operations", async () => {
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

      expect(afterAddHotel.visaSetup.hotelAgreements.length).toBe(1);
      const hotelId = afterAddHotel.visaSetup.hotelAgreements[0].id;
      expect(
        afterAddHotel.visaSetup.hotelAgreements[0].status,
      ).toBe(AgreementApprovalStatus.WAITING);

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
      expect(
        afterUpdateHotel.visaSetup.hotelAgreements[0].status,
      ).toBe(AgreementApprovalStatus.APPROVED);

      const afterRemoveHotel = (await service.removeVisaHotelAgreement(
        "G-301",
        hotelId,
      )) as {
        visaSetup: { hotelAgreements: unknown[] };
      };
      expect(afterRemoveHotel.visaSetup.hotelAgreements.length).toBe(0);

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
      expect(afterUpsertRaudhah.visaSetup.raudhahAppointments.length).toBe(1);

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
      expect(afterSecondUpsert.visaSetup.raudhahAppointments.length).toBe(1);
      expect(
        afterSecondUpsert.visaSetup.raudhahAppointments[0].date,
      ).toBe("2026-04-16");
      expect(
        afterSecondUpsert.visaSetup.raudhahAppointments[0].status,
      ).toBe(GroupRaudhahStatus.BEFORE);
    } finally {
      restore();
    }
  });

  runCase("visa agreement rules", async () => {
    const { service, restore } = await createMemoryService();

    try {
      await service.create(
        createGroupPayload({
          code: "G-401",
          name: "Invalid Madinah Only",
          visaSetup: {
            visaStatus: VisaStatus.DRAFT,
            syarikah: "Provider Test",
            paymentStatus: VisaPaymentStatus.UNPAID,
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

      await service.addVisaHotelAgreement("G-402", {
        city: AgreementCity.MAKKAH,
        hotelName: "Makkah Hotel C",
        agreementNumber: "MAK-402-C",
        pax: 40,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-04-17",
        stayEnd: "2026-04-18",
      });

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

      expect(typeof secondMakkahId).toBe("string");

      await service.updateVisaHotelAgreement("G-402", secondMakkahId!, {
        city: AgreementCity.MAKKAH,
        hotelName: "Makkah Hotel B",
        agreementNumber: "MAK-402-B",
        pax: 40,
        status: AgreementApprovalStatus.WAITING,
        stayStart: "2026-04-14",
        stayEnd: "2026-04-16",
      });

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
      expect(typeof makkahHotelId).toBe("string");

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
      expect(afterRemoveMakkah.visaSetup.hotelAgreements.length).toBe(1);
      expect(
        afterRemoveMakkah.visaSetup.hotelAgreements[0]?.city,
      ).toBe(AgreementCity.MADINAH);
      expect(
        afterRemoveMakkah.visaSetup.hotelAgreements[0]?.agreementNumber,
      ).toBe("MAD-403-A");

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
      expect(afterMadinahOnly.visaSetup.hotelAgreements.length).toBe(1);
      expect(
        afterMadinahOnly.visaSetup.hotelAgreements[0]?.city,
      ).toBe(AgreementCity.MADINAH);
      expect(
        afterMadinahOnly.visaSetup.hotelAgreements[0]?.agreementNumber,
      ).toBe("MAD-404");

      // Avoid unused variable linting in strict TS with assertion-only reads.
      expect(
        afterFirstMakkah.visaSetup.hotelAgreements.some(
          (agreement) => agreement.city === AgreementCity.MAKKAH,
        ),
      ).toBe(true);
    } finally {
      restore();
    }
  });

  runCase("checklist identity avoids same-time collision", async () => {
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
      expect(sameTimeAssignments.length).toBe(2);
      expect(
        sameTimeAssignments.some(
          (assignment) =>
            assignment.activity === "Arrival" &&
            assignment.drivers.some((driver) => driver.name === "Driver A"),
        ),
      ).toBe(true);
      expect(
        sameTimeAssignments.some(
          (assignment) =>
            assignment.activity === "Transfer" &&
            assignment.drivers.some((driver) => driver.name === "Driver B"),
        ),
      ).toBe(true);
    } finally {
      restore();
    }
  });

  runCase("parent-child group inheritance and validation", async () => {
    const { service, restore } = await createMemoryService();

    try {
      const parent = (await service.create(
        createGroupPayload({
          code: "G-PARENT",
          name: "Parent Group",
        }),
      )) as { id: string };

      const child = (await service.create(
        createGroupPayload({
          code: "G-CHILD",
          name: "Child Group",
          parentGroupId: parent.id,
        }),
      )) as { id: string; parentGroupId?: string | null };

      expect(child.parentGroupId).toBe(parent.id);

      // 1. Add itinerary to parent
      await service.addItineraryItem("G-PARENT", {
        dateLabel: "2 Apr",
        yearLabel: "2026",
        category: "Arrival",
        title: "Jeddah Arrival",
        meta: "SV-827",
        icon: "flight_land",
        isoDate: "2026-04-02",
        time: "04:20",
      });

      // 2. Fetch child group, verify itinerary is inherited
      const fetchedChild = (await service.findOneByIdOrCode("G-CHILD")) as {
        itinerary: Array<{ title: string }>;
      };
      expect(fetchedChild.itinerary.length).toBe(1);
      expect(fetchedChild.itinerary[0].title).toBe("Jeddah Arrival");

      // 3. Verify edits are blocked on child group
      await expect(
        async () =>
          service.addItineraryItem("G-CHILD", {
            dateLabel: "3 Apr",
            yearLabel: "2026",
            category: "Arrival",
            title: "Direct to child",
            meta: "SV-827",
            icon: "flight_land",
          }),
      ).rejects.toThrow(/adalah child group. Silakan edit itinerary pada parent group/i);

      await expect(
        async () =>
          service.confirmChecklistDriver("G-CHILD", {
            tripDate: "2026-04-02",
            activity: "Arrival",
            tripLabel: "Jeddah Arrival",
            requiredBusCount: 1,
            scheduledTime: "04:20",
            driver: {
              name: "Driver Yusuf",
              phone: "+966 50 111 2222",
              plateNumber: "B 1234 ABC",
            },
          }),
      ).rejects.toThrow(/adalah child group. Silakan edit checklist pada parent group/i);

      await expect(
        async () => service.remove("G-PARENT"),
      ).rejects.toThrow(/still has child groups and cannot be deleted/i);

      await service.remove("G-CHILD");
      await service.remove("G-PARENT");
    } finally {
      restore();
    }
  });
});
