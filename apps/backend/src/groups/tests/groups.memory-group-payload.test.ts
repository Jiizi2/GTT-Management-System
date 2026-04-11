import assert from "node:assert/strict";
import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { resolveItineraryTitle, formatRouteSummary } from "../groups-itinerary-title";
import { buildMemoryGroupPayloadFields } from "../groups.memory-group-payload";
import type { CreateGroupDto } from "../dto/create-group.dto";

function createPayload(overrides: Partial<CreateGroupDto> = {}): CreateGroupDto {
  return {
    code: "MEM-001",
    name: " Memory Group ",
    status: " Active ",
    arrivalDate: "2026-04-10",
    returnDate: "2026-04-18",
    tone: GroupTone.ACTIVE,
    pax: 40,
    totalBuses: 2,
    packageName: " Standard Gold ",
    durationDays: 9,
    musyrif: {
      name: " Ustadz Test ",
      phone: " 08123 ",
      avatar: " https://example.com/avatar.png ",
    },
    nextActivity: {
      title: " Next Activity ",
      dateLabel: " 10 Apr ",
      timeLabel: " 08:00 ",
      icon: " flight ",
    },
    timeline: [
      {
        dateLabel: " 10 Apr ",
        title: " Arrival ",
        isCurrent: true,
        nextActivity: " Check in ",
      },
      {
        sortOrder: 9,
        dateLabel: " 11 Apr ",
        title: " Transfer ",
      },
    ],
    itinerary: [
      {
        dateLabel: " 10 Apr ",
        yearLabel: " 2026 ",
        category: " Arrival ",
        categoryKey: " arrival ",
        meta: " 08:00 | Airport ",
        icon: " flight_land ",
        isoDate: "2026-04-10",
        time: " 08:00 ",
        fromLocation: " JED ",
        toLocation: " Makkah ",
        requiresBus: true,
        notes: " Note 1 ",
      },
      {
        sortOrder: 7,
        dateLabel: " 11 Apr ",
        yearLabel: " 2026 ",
        category: " City Tour ",
        categoryKey: " city-tour ",
        title: "   ",
        meta: " 09:00 | Tour ",
        icon: " tour ",
        fromLocation: " Lobby ",
        toLocation: " Quba ",
        cityTourCity: " Madinah ",
        transferByTrain: true,
        trainDepartureTime: " 09:00 ",
        destinationPickupTime: " 10:10 ",
        hotelPickupRequestTime: " 07:45 ",
      },
    ],
    notes: [
      {
        text: " Note A ",
        pinned: true,
      },
      {
        sortOrder: 9,
        text: " Note B ",
      },
    ],
    visaSetup: {
      visaStatus: VisaStatus.PENDING,
      issuedDate: " 2026-04-01 ",
      syarikah: " Provider Test ",
      paymentStatus: VisaPaymentStatus.PARTIAL,
      outstandingAmount: 1500,
      hotelAgreements: [
        {
          city: AgreementCity.MAKKAH,
          hotelName: " Swissotel ",
          agreementNumber: " AG-1 ",
          pax: 40,
          status: AgreementApprovalStatus.APPROVED,
          stayStart: "2026-04-10",
          stayEnd: "2026-04-12",
        },
      ],
      raudhahAppointments: [
        {
          date: "2026-04-13",
          status: GroupRaudhahStatus.AFTER,
          tasrehPrinted: true,
        },
      ],
    },
    checklistAssignments: [
      {
        tripDate: "2026-04-10",
        activity: " Arrival ",
        tripLabel: " Airport Pickup ",
        requiredBusCount: 2,
        scheduledTime: " 08:30 ",
        transferByTrain: true,
        trainDepartureTime: " 08:30 ",
        stationPickupTime: " 09:40 ",
        status: ChecklistAssignmentStatus.ASSIGNED,
        drivers: [
          {
            name: " Driver A ",
            phone: " 08111 ",
            plateNumber: " B 1111 AA ",
            isVerified: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testResolveItineraryTitleBranches(): void {
  assert.equal(
    resolveItineraryTitle({
      title: "  Explicit Title ",
      category: "Arrival",
    }),
    "Explicit Title",
  );

  assert.equal(
    resolveItineraryTitle({
      category: "Arrival schedule",
      fromLocation: "JED",
      toLocation: "Makkah",
    }),
    "Landing at JED and heading to Makkah",
  );

  assert.equal(
    resolveItineraryTitle({
      category: "City Tour",
      fromLocation: "Hotel",
      toLocation: "Quba",
      cityTourCity: "Madinah",
    }),
    "City Tour in Madinah: Hotel -> Quba",
  );

  assert.equal(
    resolveItineraryTitle({
      category: "Unknown Category",
      fromLocation: "",
      toLocation: "",
    }),
    "Unknown Category",
  );

  assert.equal(
    resolveItineraryTitle({
      category: "   ",
      fromLocation: "",
      toLocation: "",
    }),
    "Activity detail pending",
  );

  assert.equal(formatRouteSummary("departure", "Madinah", "MED"), "Depart from Madinah to MED");
  assert.equal(formatRouteSummary("city-tour", "Lobby", "Quba"), "Lobby -> Quba");
}

function testBuildMemoryGroupPayloadFieldsNormalizationAndDefaults(): void {
  const fields = buildMemoryGroupPayloadFields(createPayload());
  const timeline = fields.timeline ?? [];
  const notes = fields.notes ?? [];
  assert.equal(fields.name, "Memory Group");
  assert.equal(fields.status, "Active");
  assert.equal(fields.packageName, "Standard Gold");
  assert.equal(fields.arrivalDate, "2026-04-10");
  assert.equal(fields.returnDate, "2026-04-18");
  assert.equal(fields.totalBuses, 2);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].sortOrder, 0);
  assert.equal(timeline[1].sortOrder, 9);
  assert.equal(timeline[0].nextActivity, "Check in");

  assert.equal(fields.itinerary.length, 2);
  assert.equal(fields.itinerary[0].sortOrder, 0);
  assert.equal(fields.itinerary[1].sortOrder, 7);
  assert.equal(fields.itinerary[0].category, "Arrival");
  assert.equal(fields.itinerary[0].title, "Landing at JED and heading to Makkah");
  assert.equal(fields.itinerary[1].title, "City Tour in Madinah: Lobby -> Quba");
  assert.equal(fields.itinerary[1].transferByTrain, true);
  assert.equal(fields.itinerary[1].trainDepartureTime, "09:00");
  assert.equal(fields.itinerary[1].destinationPickupTime, "10:10");
  assert.equal(fields.itinerary[1].hotelPickupRequestTime, "07:45");

  assert.equal(notes.length, 2);
  assert.equal(notes[0].sortOrder, 0);
  assert.equal(notes[1].sortOrder, 9);
  assert.equal(notes[0].text, "Note A");

  assert.ok(fields.visaSetup);
  assert.equal(fields.visaSetup?.visaStatus, VisaStatus.PENDING);
  assert.equal(fields.visaSetup?.issuedDate, "2026-04-01");
  assert.equal(fields.visaSetup?.syarikah, "Provider Test");
  assert.equal(fields.visaSetup?.paymentStatus, VisaPaymentStatus.PARTIAL);
  assert.equal(fields.visaSetup?.hotelAgreements.length, 1);
  assert.equal(fields.visaSetup?.hotelAgreements[0].hotelName, "Swissotel");
  assert.equal(fields.visaSetup?.raudhahAppointments[0].status, GroupRaudhahStatus.AFTER);
  assert.equal(fields.visaSetup?.raudhahAppointments[0].tasrehPrinted, true);

  assert.equal(fields.checklistAssignments.length, 1);
  assert.equal(fields.checklistAssignments[0].activity, "Arrival");
  assert.equal(fields.checklistAssignments[0].tripLabel, "Airport Pickup");
  assert.equal(fields.checklistAssignments[0].scheduledTime, "08:30");
  assert.equal(fields.checklistAssignments[0].drivers.length, 1);
  assert.equal(fields.checklistAssignments[0].drivers[0].slotNumber, 1);
  assert.equal(fields.checklistAssignments[0].drivers[0].name, "Driver A");
}

function testBuildMemoryGroupPayloadFieldsFallbackDefaultsAndInvalidDate(): void {
  const minimal = buildMemoryGroupPayloadFields(
    createPayload({
      tone: undefined,
      totalBuses: undefined,
      musyrif: undefined,
      nextActivity: undefined,
      timeline: undefined,
      itinerary: undefined,
      notes: undefined,
      visaSetup: undefined,
      checklistAssignments: undefined,
    }),
  );
  const minimalTimeline = minimal.timeline ?? [];
  const minimalNotes = minimal.notes ?? [];

  assert.equal(minimal.tone, GroupTone.ACTIVE);
  assert.equal(minimal.totalBuses, null);
  assert.equal(minimal.musyrif, undefined);
  assert.equal(minimal.nextActivity, undefined);
  assert.equal(minimalTimeline.length, 0);
  assert.equal(minimal.itinerary.length, 0);
  assert.equal(minimalNotes.length, 0);
  assert.equal(minimal.visaSetup, undefined);
  assert.equal(minimal.checklistAssignments.length, 0);

  assert.throws(
    () =>
      buildMemoryGroupPayloadFields(
        createPayload({
          arrivalDate: "invalid-date",
        }),
      ),
    /Invalid ISO date value/i,
  );
}

async function main(): Promise<void> {
  await runCase("groups itinerary title helper branches", testResolveItineraryTitleBranches);
  await runCase("groups memory payload normalization", testBuildMemoryGroupPayloadFieldsNormalizationAndDefaults);
  await runCase("groups memory payload defaults and invalid date", testBuildMemoryGroupPayloadFieldsFallbackDefaultsAndInvalidDate);
}

void main().catch((error: unknown) => {
  console.error("Groups memory payload test failed:", error);
  process.exitCode = 1;
});
