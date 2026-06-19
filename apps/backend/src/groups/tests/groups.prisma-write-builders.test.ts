import assert from "node:assert/strict";
import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  Prisma,
  VisaPaymentStatus,
  VisaStatus,
  GroupStatus,
} from "@prisma/client";
import { CreateGroupDto } from "../dto/create-group.dto";
import {
  buildGroupCreateData,
  buildGroupReplaceData,
} from "../infrastructure/groups.prisma-write-builders";

function createPayload(overrides: Partial<CreateGroupDto> = {}): CreateGroupDto {
  return {
    code: "G-900",
    name: " Builder Test Group ",
    status: GroupStatus.ACTIVE,
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

async function runCase(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

function testTotalBusesCreateVsReplaceBehavior(): void {
  const payload = createPayload({ totalBuses: undefined });
  const createData = buildGroupCreateData(payload, "G-900");
  const replaceData = buildGroupReplaceData(payload, "G-900");

  assert.equal((createData as { totalBuses?: number }).totalBuses, undefined);
  assert.equal((replaceData as { totalBuses: number | null }).totalBuses, null);
}

function testTrimAndDefaultMappings(): void {
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
      hotelAgreements: [
        {
          city: AgreementCity.MAKKAH,
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

  assert.equal(createDataAny.name, "Builder Test Group");
  assert.equal(createDataAny.status, GroupStatus.ACTIVE);
  assert.equal(createDataAny.packageName, "Standard Gold");
  assert.equal(
    createDataAny.searchDocument,
    "g trim gtrim builder test group buildertestgroup active standard gold standardgold",
  );
  assert.equal((createDataAny.arrivalDate as Date).toISOString().slice(0, 10), "2026-04-10");
  assert.equal((createDataAny.returnDate as Date).toISOString().slice(0, 10), "2026-04-18");
  assert.equal(createDataAny.musyrif.create.name, "Ust. Trim");
  assert.equal(createDataAny.nextActivity.create.title, "Arrival");
  assert.equal(createDataAny.itinerary.create[0].title, "Jeddah Arrival");
  assert.equal(createDataAny.notes.create[0].text, "first note");

  const itineraryIsoDate = createDataAny.itinerary.create[0].isoDate as Date;
  assert.equal(itineraryIsoDate.toISOString().slice(0, 10), "2026-04-10");

  const visaSetup = createDataAny.visaSetup.create;
  assert.equal(visaSetup.visaStatus, VisaStatus.DRAFT);
  assert.equal(visaSetup.issuedDate, null);
  assert.equal(visaSetup.paymentStatus, VisaPaymentStatus.UNPAID);
  assert.equal((visaSetup.outstandingAmount as Prisma.Decimal).toString(), "0");
  assert.equal(visaSetup.hotelAgreements.create[0].city, AgreementCity.MAKKAH);
  assert.equal(visaSetup.hotelAgreements.create[0].status, AgreementApprovalStatus.WAITING);
  assert.equal(visaSetup.raudhahAppointments.create[0].status, GroupRaudhahStatus.FREE);
  assert.equal(visaSetup.hotelAgreements.create[0].hotelName, "Makkah Hotel");

  const checklist = createDataAny.checklistAssignments.create[0];
  assert.equal(checklist.activity, "Arrival Transfer");
  assert.equal(checklist.status, ChecklistAssignmentStatus.NOT_COMPLETE);
  assert.equal(checklist.drivers.create[0].slotNumber, 1);
  assert.equal(checklist.drivers.create[0].name, "Driver One");
}

function testItineraryTitleFallbackWithoutExplicitTitle(): void {
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

  assert.equal(createDataAny.itinerary.create[0].title, "Transfer from Makkah Hotel to Madinah Hotel");
}

function testExplicitStatusesAreRespected(): void {
  const payload = createPayload({
    tone: GroupTone.INACTIVE,
    visaSetup: {
      visaStatus: VisaStatus.ISSUED,
      issuedDate: "2026-04-14",
      syarikah: "Provider",
      paymentStatus: VisaPaymentStatus.PAID,
      outstandingAmount: 150,
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

  assert.equal(createDataAny.tone, GroupTone.INACTIVE);
  assert.equal(visaSetup.visaStatus, VisaStatus.ISSUED);
  assert.equal((visaSetup.issuedDate as Date).toISOString().slice(0, 10), "2026-04-14");
  assert.equal(visaSetup.paymentStatus, VisaPaymentStatus.PAID);
  assert.equal((visaSetup.outstandingAmount as Prisma.Decimal).toString(), "150");
  assert.equal(visaSetup.hotelAgreements.create[0].status, AgreementApprovalStatus.APPROVED);
  assert.equal(visaSetup.hotelAgreements.create[0].city, AgreementCity.MADINAH);
  assert.equal(visaSetup.raudhahAppointments.create[0].status, GroupRaudhahStatus.BEFORE);
  assert.equal(createDataAny.checklistAssignments.create[0].status, ChecklistAssignmentStatus.ASSIGNED);
  assert.equal(createDataAny.checklistAssignments.create[0].drivers.create[0].slotNumber, 4);
  assert.equal(createDataAny.checklistAssignments.create[0].drivers.create[0].isVerified, true);
}

function testReplaceNullifiesChecklistItineraryLinks(): void {
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

  assert.equal(createData.checklistAssignments.create[0].itineraryItemId, "legacy-itinerary-id");
  assert.equal(replaceData.checklistAssignments.create[0].itineraryItemId, null);
  assert.equal(
    replaceData.searchDocument,
    "g links glinks builder test group buildertestgroup active standard gold standardgold",
  );
}

async function main(): Promise<void> {
  await runCase("prisma write builder total buses behavior", testTotalBusesCreateVsReplaceBehavior);
  await runCase("prisma write builder trim/default mappings", testTrimAndDefaultMappings);
  await runCase("prisma write builder title fallback", testItineraryTitleFallbackWithoutExplicitTitle);
  await runCase("prisma write builder explicit status mappings", testExplicitStatusesAreRespected);
  await runCase("prisma write builder replace nullifies checklist itinerary links", testReplaceNullifiesChecklistItineraryLinks);
}

main().catch((error: unknown) => {
  console.error("Prisma write builder test failed:", error);
  throw error;
});
