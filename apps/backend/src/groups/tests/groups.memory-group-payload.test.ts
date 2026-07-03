import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { resolveItineraryTitle, formatRouteSummary } from "../domain/groups-itinerary-title";
import { buildMemoryGroupPayloadFields } from "../infrastructure/groups.memory-group-payload";
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

describe("GroupsMemoryGroupPayload", () => {
  runCase("itinerary title helper branches", () => {
    expect(
      resolveItineraryTitle({
        title: "  Explicit Title ",
        category: "Arrival",
      }),
    ).toBe("Explicit Title");

    expect(
      resolveItineraryTitle({
        category: "Arrival schedule",
        fromLocation: "JED",
        toLocation: "Makkah",
      }),
    ).toBe("Landing at JED and heading to Makkah");

    expect(
      resolveItineraryTitle({
        category: "City Tour",
        fromLocation: "Hotel",
        toLocation: "Quba",
        cityTourCity: "Madinah",
      }),
    ).toBe("City Tour in Madinah: Hotel -> Quba");

    expect(
      resolveItineraryTitle({
        category: "Unknown Category",
        fromLocation: "",
        toLocation: "",
      }),
    ).toBe("Unknown Category");

    expect(
      resolveItineraryTitle({
        category: "   ",
        fromLocation: "",
        toLocation: "",
      }),
    ).toBe("Activity detail pending");

    expect(formatRouteSummary("departure", "Madinah", "MED")).toBe("Depart from Madinah to MED");
    expect(formatRouteSummary("city-tour", "Lobby", "Quba")).toBe("Lobby -> Quba");
  });

  runCase("normalization", () => {
    const fields = buildMemoryGroupPayloadFields(createPayload());
    const timeline = fields.timeline ?? [];
    const notes = fields.notes ?? [];
    expect(fields.name).toBe("Memory Group");
    expect(fields.status).toBe("Active");
    expect(fields.packageName).toBe("Standard Gold");
    expect(fields.arrivalDate).toBe("2026-04-10");
    expect(fields.returnDate).toBe("2026-04-18");
    expect(fields.totalBuses).toBe(2);

    expect(timeline.length).toBe(2);
    expect(timeline[0].sortOrder).toBe(0);
    expect(timeline[1].sortOrder).toBe(9);
    expect(timeline[0].nextActivity).toBe("Check in");

    expect(fields.itinerary.length).toBe(2);
    expect(fields.itinerary[0].sortOrder).toBe(0);
    expect(fields.itinerary[1].sortOrder).toBe(7);
    expect(fields.itinerary[0].category).toBe("Arrival");
    expect(fields.itinerary[0].title).toBe("Landing at JED and heading to Makkah");
    expect(fields.itinerary[1].title).toBe("City Tour in Madinah: Lobby -> Quba");
    expect(fields.itinerary[1].transferByTrain).toBe(true);
    expect(fields.itinerary[1].trainDepartureTime).toBe("09:00");
    expect(fields.itinerary[1].destinationPickupTime).toBe("10:10");
    expect(fields.itinerary[1].hotelPickupRequestTime).toBe("07:45");

    expect(notes.length).toBe(2);
    expect(notes[0].sortOrder).toBe(0);
    expect(notes[1].sortOrder).toBe(9);
    expect(notes[0].text).toBe("Note A");

    expect(fields.visaSetup).toBeTruthy();
    expect(fields.visaSetup?.visaStatus).toBe(VisaStatus.PENDING);
    expect(fields.visaSetup?.issuedDate).toBe("2026-04-01");
    expect(fields.visaSetup?.syarikah).toBe("Provider Test");
    expect(fields.visaSetup?.paymentStatus).toBe(VisaPaymentStatus.PARTIAL);
    expect(fields.visaSetup?.hotelAgreements.length).toBe(1);
    expect(fields.visaSetup?.hotelAgreements[0].hotelName).toBe("Swissotel");
    expect(fields.visaSetup?.raudhahAppointments[0].status).toBe(GroupRaudhahStatus.AFTER);
    expect(fields.visaSetup?.raudhahAppointments[0].tasrehPrinted).toBe(true);

    expect(fields.checklistAssignments.length).toBe(1);
    expect(fields.checklistAssignments[0].activity).toBe("Arrival");
    expect(fields.checklistAssignments[0].tripLabel).toBe("Airport Pickup");
    expect(fields.checklistAssignments[0].scheduledTime).toBe("08:30");
    expect(fields.checklistAssignments[0].drivers.length).toBe(1);
    expect(fields.checklistAssignments[0].drivers[0].slotNumber).toBe(1);
    expect(fields.checklistAssignments[0].drivers[0].name).toBe("Driver A");
  });

  runCase("defaults and invalid date", () => {
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

    expect(minimal.tone).toBe(GroupTone.ACTIVE);
    expect(minimal.totalBuses).toBeNull();
    expect(minimal.musyrif).toBeUndefined();
    expect(minimal.nextActivity).toBeUndefined();
    expect(minimalTimeline.length).toBe(0);
    expect(minimal.itinerary.length).toBe(0);
    expect(minimalNotes.length).toBe(0);
    expect(minimal.visaSetup).toBeUndefined();
    expect(minimal.checklistAssignments.length).toBe(0);

    expect(() =>
      buildMemoryGroupPayloadFields(
        createPayload({
          arrivalDate: "invalid-date",
        }),
      ),
    ).toThrow(/Invalid ISO date value/i);
  });
});
