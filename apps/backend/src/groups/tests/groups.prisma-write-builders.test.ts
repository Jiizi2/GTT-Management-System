import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupLifecycleStatus,
  GroupTone,
  VisaBusStatus,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { CreateGroupDto } from "../dto/create-group.dto";
import {
  buildGroupCreateData,
  buildGroupReplaceData,
} from "../../infrastructure/repositories/prisma/helpers/prisma-group.helpers";

function createPayload(overrides: Partial<CreateGroupDto> = {}): CreateGroupDto {
  return {
    code: "G-900",
    name: " Builder Test Group ",
    status: " Active ",
    arrivalDate: "2026-04-10",
    returnDate: "2026-04-18",
    tone: GroupTone.ACTIVE,
    pax: 45,
    packageName: " Standard Gold ",
    durationDays: 9,
    timeline: [],
    itinerary: [],
    notes: [],
    checklistAssignments: [],
    ...overrides,
  };
}

describe("GroupsPrismaWriteBuilders", () => {
  runCase("prisma write builder total buses behavior", () => {
    const payload = createPayload({ totalBuses: undefined });
    const createData = buildGroupCreateData(payload, "G-900");
    const replaceData = buildGroupReplaceData(payload, "G-900");

    expect((createData as { totalBuses?: number }).totalBuses).toBe(undefined);
    expect((replaceData as { totalBuses: number | null }).totalBuses).toBe(null);
  });

  runCase("prisma write builder trim/default mappings", () => {
    const payload = createPayload({
      musyrif: {
        name: " Ust. Trim ",
        phone: " 0812 ",
        avatar: " https://example.com/a.png ",
      },
      nextActivity: {
        title: " Arrival ",
        dateLabel: " 10 Apr ",
        timeLabel: " 08:00 ",
        icon: " flight_land ",
      },
      itinerary: [
        {
          sortOrder: 3,
          dateLabel: " 10 Apr ",
          yearLabel: " 2026 ",
          category: " Arrival ",
          title: " Jeddah Arrival ",
          meta: " 08:00 | JED ",
          icon: " flight_land ",
          isoDate: "2026-04-10",
          time: " 08:00 ",
        },
      ],
      notes: [
        {
          sortOrder: 0,
          text: " first note ",
          pinned: true,
        },
      ],
      visaSetup: {
        syarikah: " Nusuk ",
        busStatus: VisaBusStatus.VISA_PLUS,
        hotelAgreements: [
          {
            city: AgreementCity.MAKKAH,
            sourceDraftId: " draft-builder-1 ",
            hotelName: " Makkah Hotel ",
            agreementNumber: " AG-101 ",
            pax: 45,
            stayStart: "2026-04-10",
            stayEnd: "2026-04-12",
          },
        ],
        raudhahAppointments: [
          {
            date: "2026-04-11",
          },
        ],
      },
      checklistAssignments: [
        {
          tripDate: "2026-04-10",
          activity: " Arrival Transfer ",
          tripLabel: " Arrival Day ",
          requiredBusCount: 1,
          scheduledTime: " 08:00 ",
          drivers: [
            {
              name: " Driver One ",
              phone: " 08123 ",
              plateNumber: " B 1234 CD ",
            },
          ],
        },
      ],
    });

    const createData = buildGroupCreateData(payload, "G-TRIM");
    const createDataAny = createData as any;

    expect(createDataAny.name).toBe("Builder Test Group");
    expect(createDataAny.status).toBe("Active");
    expect(createDataAny.lifecycleStatus).toBe(GroupLifecycleStatus.ACTIVE);
    expect(createDataAny.packageName).toBe("Standard Gold");
    expect(
      createDataAny.searchDocument,
    ).toBe(
      "g trim gtrim builder test group buildertestgroup active standard gold standardgold",
    );
    expect((createDataAny.arrivalDate as Date).toISOString().slice(0, 10)).toBe("2026-04-10");
    expect((createDataAny.returnDate as Date).toISOString().slice(0, 10)).toBe("2026-04-18");
    expect(createDataAny.musyrif.create.name).toBe("Ust. Trim");
    expect(createDataAny.nextActivity.create.title).toBe("Arrival");
    expect(createDataAny.itinerary.create[0].title).toBe("Jeddah Arrival");
    expect(createDataAny.notes.create[0].text).toBe("first note");

    const itineraryIsoDate = createDataAny.itinerary.create[0].isoDate as Date;
    expect(itineraryIsoDate.toISOString().slice(0, 10)).toBe("2026-04-10");

    const visaSetup = createDataAny.visaSetup.create;
    expect(visaSetup.visaStatus).toBe(VisaStatus.DRAFT);
    expect(visaSetup.issuedDate).toBe(null);
    expect(visaSetup.busStatus).toBe(VisaBusStatus.VISA_PLUS);
    expect(visaSetup.paymentStatus).toBe(VisaPaymentStatus.UNPAID);
    expect(visaSetup.hotelAgreements.create[0].city).toBe(AgreementCity.MAKKAH);
    expect(visaSetup.hotelAgreements.create[0].sourceDraftId).toBe("draft-builder-1");
    expect(visaSetup.hotelAgreements.create[0].status).toBe(AgreementApprovalStatus.WAITING);
    expect(visaSetup.raudhahAppointments.create[0].status).toBe(GroupRaudhahStatus.FREE);
    expect(visaSetup.hotelAgreements.create[0].hotelName).toBe("Makkah Hotel");

    const checklist = createDataAny.checklistAssignments.create[0];
    expect(checklist.activity).toBe("Arrival Transfer");
    expect(checklist.status).toBe(ChecklistAssignmentStatus.NOT_COMPLETE);
    expect(checklist.drivers.create[0].slotNumber).toBe(1);
    expect(checklist.drivers.create[0].name).toBe("Driver One");
  });

  runCase("prisma write builder title fallback", () => {
    const payload = createPayload({
      itinerary: [
        {
          sortOrder: 0,
          dateLabel: " 11 Apr ",
          yearLabel: " 2026 ",
          category: " Transfer ",
          meta: " 09:00 | Route 40 ",
          icon: " airport_shuttle ",
          isoDate: "2026-04-11",
          time: " 09:00 ",
          fromLocation: " Makkah Hotel ",
          toLocation: " Madinah Hotel ",
        },
      ],
    });

    const createData = buildGroupCreateData(payload, "G-TITLE");
    const createDataAny = createData as any;

    expect(createDataAny.itinerary.create[0].title).toBe("Transfer from Makkah Hotel to Madinah Hotel");
  });

  runCase("prisma write builder explicit status mappings", () => {
    const payload = createPayload({
      status: "Entry Only",
      lifecycleStatus: GroupLifecycleStatus.ENTRY_ONLY,
      tone: GroupTone.INACTIVE,
      visaSetup: {
        visaStatus: VisaStatus.ISSUED,
        issuedDate: "2026-04-14",
        syarikah: "Provider",
        paymentStatus: VisaPaymentStatus.PAID,
        hotelAgreements: [
          {
            city: AgreementCity.MADINAH,
            hotelName: "Madinah Hotel",
            agreementNumber: "AG-MAD-01",
            pax: 45,
            status: AgreementApprovalStatus.APPROVED,
            stayStart: "2026-04-15",
            stayEnd: "2026-04-18",
          },
        ],
        raudhahAppointments: [
          {
            date: "2026-04-16",
            status: GroupRaudhahStatus.BEFORE,
          },
        ],
      },
      checklistAssignments: [
        {
          tripDate: "2026-04-15",
          activity: "Activity",
          tripLabel: "Trip",
          requiredBusCount: 2,
          scheduledTime: "09:00",
          status: ChecklistAssignmentStatus.ASSIGNED,
          drivers: [
            {
              slotNumber: 4,
              name: "Driver",
              phone: "08123",
              plateNumber: "B 1 CD",
              isVerified: true,
            },
          ],
        },
      ],
    });

    const createData = buildGroupCreateData(payload, "G-STATE");
    const createDataAny = createData as any;
    const visaSetup = createDataAny.visaSetup.create;

    expect(createDataAny.status).toBe("Entry Only");
    expect(createDataAny.lifecycleStatus).toBe(GroupLifecycleStatus.ENTRY_ONLY);
    expect(createDataAny.tone).toBe(GroupTone.INACTIVE);
    expect(visaSetup.visaStatus).toBe(VisaStatus.ISSUED);
    expect((visaSetup.issuedDate as Date).toISOString().slice(0, 10)).toBe("2026-04-14");
    expect(visaSetup.paymentStatus).toBe(VisaPaymentStatus.PAID);
    expect(visaSetup.hotelAgreements.create[0].status).toBe(AgreementApprovalStatus.APPROVED);
    expect(visaSetup.hotelAgreements.create[0].city).toBe(AgreementCity.MADINAH);
    expect(visaSetup.raudhahAppointments.create[0].status).toBe(GroupRaudhahStatus.BEFORE);
    expect(createDataAny.checklistAssignments.create[0].status).toBe(ChecklistAssignmentStatus.ASSIGNED);
    expect(createDataAny.checklistAssignments.create[0].drivers.create[0].slotNumber).toBe(4);
    expect(createDataAny.checklistAssignments.create[0].drivers.create[0].isVerified).toBe(true);
  });

  runCase("prisma write builder replace nullifies checklist itinerary links", () => {
    const payload = createPayload({
      checklistAssignments: [
        {
          itineraryItemId: "legacy-itinerary-id",
          tripDate: "2026-04-15",
          activity: "Activity",
          tripLabel: "Trip",
          requiredBusCount: 1,
          scheduledTime: "09:00",
        },
      ],
    });

    const createData = buildGroupCreateData(payload, "G-LINKS") as any;
    const replaceData = buildGroupReplaceData(payload, "G-LINKS") as any;

    expect(createData.checklistAssignments.create[0].itineraryItemId).toBe("legacy-itinerary-id");
    expect(replaceData.checklistAssignments.create[0].itineraryItemId).toBe(null);
    expect(
      replaceData.searchDocument,
    ).toBe(
      "g links glinks builder test group buildertestgroup active standard gold standardgold",
    );
  });
});
