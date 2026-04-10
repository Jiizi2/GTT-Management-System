import assert from "node:assert/strict";
import {
  buildChecklistItemsFromGroups,
  buildVisaTrackingRowsFromGroups,
  expandInputTransferTrainItems,
  formatRouteSummary,
  getChecklistRangeDates,
  getLocalIsoDateWithOffset,
  getRouteFieldConfigByCategory,
  resolveValidRaudhahAppointments,
  type GroupData,
  type InputItineraryItem,
} from "../shared/app-domain.js";

function createBaseGroup(overrides: Partial<GroupData> = {}): GroupData {
  const todayIso = getLocalIsoDateWithOffset(0);
  const tomorrowIso = getLocalIsoDateWithOffset(1);
  const dayAfterIso = getLocalIsoDateWithOffset(2);

  return {
    code: "UNIT-001",
    name: "Unit Test Group",
    status: "Active",
    tone: "active",
    pax: 45,
    totalBuses: 2,
    packageName: "Unit Package",
    durationDays: 9,
    arrivalDate: todayIso,
    returnDate: dayAfterIso,
    timeline: [
      {
        date: "01 Jan",
        title: "Arrival",
      },
      {
        date: "02 Jan",
        title: "Departure",
        isCurrent: true,
        nextActivity: "Prepare departure",
      },
    ],
    nextActivity: {
      title: "Prepare departure",
      date: "02 Jan",
      time: "08:00",
      icon: "flight_takeoff",
    },
    itinerary: [
      {
        date: "01 Jan",
        year: "2099",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Arrival Trip",
        meta: "08:00 | Airport",
        icon: "flight_land",
        isoDate: todayIso,
        time: "08:00",
        from: "JED Airport",
        to: "Makkah Hotel",
        requiresBus: true,
      },
      {
        date: "02 Jan",
        year: "2099",
        category: "Departure",
        categoryKey: "departure",
        title: "Departure Trip",
        meta: "21:00 | Hotel to Airport",
        icon: "flight_takeoff",
        isoDate: tomorrowIso,
        time: "21:00",
        from: "Madinah Hotel",
        to: "MED Airport",
        requiresBus: true,
        hotelPickupRequestTime: "18:00",
      },
    ],
    notes: ["Unit note"],
    musyrif: {
      name: "Ustadz Unit",
      phone: "081111111",
      avatar: "https://example.com/avatar.png",
    },
    checklistAssignments: [],
    ...overrides,
  };
}

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testResolveValidRaudhahAppointmentsNormalization(): void {
  const group = createBaseGroup({
    code: "UNIT-RAUDHAH",
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "2099-01-01",
      syarikah: "Provider Unit",
      paymentStatus: "Paid",
      makkahHotels: [],
      madinahHotels: [],
      raudhahAppointments: [
        { id: "a3", dateIso: "2099-01-10", status: "After", tasrehPrinted: true },
        { id: "", dateIso: "invalid-date", status: "Before" },
        { id: "", dateIso: "2099-01-08", status: "Before" },
      ],
    },
  });

  const normalized = resolveValidRaudhahAppointments(group);
  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].dateIso, "2099-01-08");
  assert.equal(normalized[0].id, "UNIT-RAUDHAH-raudhah-3");
  assert.equal(normalized[0].tasrehPrinted, false);
  assert.equal(normalized[1].id, "a3");
  assert.equal(normalized[1].tasrehPrinted, true);
}

function testRouteHelpersForCategorySpecificBehavior(): void {
  const arrival = formatRouteSummary("arrival", "Jeddah", "Makkah");
  const transfer = formatRouteSummary("transfer", "Makkah", "Madinah");
  const departure = formatRouteSummary("departure", "Madinah", "MED Airport");
  const cityTour = formatRouteSummary("city-tour", "Hotel Lobby", "Masjid Quba", "Madinah");

  assert.equal(arrival, "Landing at Jeddah and heading to Makkah");
  assert.equal(transfer, "Transfer from Makkah to Madinah");
  assert.equal(departure, "Depart from Madinah to MED Airport");
  assert.equal(cityTour, "City Tour in Madinah: Hotel Lobby -> Masjid Quba");

  const departureFields = getRouteFieldConfigByCategory("departure");
  assert.equal(departureFields.fromLabel, "Departure City");
  assert.equal(departureFields.toLabel, "Destination Airport");
}

function testTransferTrainExpansionCreatesTwoChecklistSegments(): void {
  const items: InputItineraryItem[] = [
    {
      id: "unit-transfer",
      date: "2099-01-03",
      time: "08:00",
      category: "Transfer",
      categoryKey: "transfer",
      from: "Makkah",
      to: "Madinah",
      cityTourCity: "",
      flightNumber: "",
      requiresBus: true,
      notes: "Transfer by train",
      icon: "airport_shuttle",
      transferByTrain: true,
      trainDepartureTime: "08:00",
      destinationPickupTime: "09:15",
      hotelPickupRequestTime: "",
    },
  ];

  const expanded = expandInputTransferTrainItems(items);
  assert.equal(expanded.length, 2);
  assert.equal(expanded[0].id, "unit-transfer-train-departure");
  assert.equal(expanded[0].time, "08:00");
  assert.equal(expanded[0].category, "Transfer - Train Departure");
  assert.equal(expanded[1].id, "unit-transfer-station-pickup");
  assert.equal(expanded[1].time, "09:15");
  assert.equal(expanded[1].category, "Transfer - Arrival Station Pickup");
}

function testBuildVisaTrackingRowsUsesItineraryBoundariesAndStatuses(): void {
  const group = createBaseGroup({
    code: "UNIT-VISA",
    itinerary: [
      {
        date: "10 Jan",
        year: "2099",
        category: "Transfer",
        categoryKey: "transfer",
        title: "Late Transfer",
        meta: "10:00 | Late transfer",
        icon: "airport_shuttle",
        isoDate: "2099-01-10",
        time: "10:00",
        from: "Makkah",
        to: "Madinah",
        requiresBus: true,
      },
      {
        date: "08 Jan",
        year: "2099",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Early Arrival",
        meta: "05:00 | Early arrival",
        icon: "flight_land",
        isoDate: "2099-01-08",
        time: "05:00",
        from: "JED Airport",
        to: "Makkah",
        requiresBus: true,
      },
    ],
    arrivalDate: undefined,
    returnDate: undefined,
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "2099-01-07",
      syarikah: "Unit Provider",
      paymentStatus: "Partial",
      makkahHotels: [
        {
          id: "m-1",
          hotelName: "Makkah Hotel",
          agreementNumber: "AG-M-1",
          pax: 30,
          status: "Approved",
          stayStartIso: "2099-01-08",
          stayEndIso: "2099-01-09",
        },
      ],
      madinahHotels: [
        {
          id: "d-1",
          hotelName: "Madinah Hotel",
          agreementNumber: "AG-D-1",
          pax: 30,
          status: "Approved",
          stayStartIso: "2099-01-10",
          stayEndIso: "2099-01-11",
        },
      ],
      raudhahAppointments: [{ id: "r-1", dateIso: "2099-01-10", status: "Before" }],
    },
  });

  const rows = buildVisaTrackingRowsFromGroups([group]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].groupCode, "UNIT-VISA");
  assert.equal(rows[0].departureIso, "2099-01-08");
  assert.equal(rows[0].returnIso, "2099-01-11");
  assert.equal(rows[0].visaStatus, "Issued");
  assert.equal(rows[0].paymentStatus, "Partial");
  assert.equal(rows[0].makkahVerified, 30);
  assert.equal(rows[0].madinahVerified, 30);
  assert.equal(rows[0].raudhahTone, "warn");
}

function testBuildChecklistItemsFiltersDateWindowAndUsesDeparturePickupTime(): void {
  const [todayIso, tomorrowIso] = getChecklistRangeDates();
  const outsideWindowIso = getLocalIsoDateWithOffset(6);
  const group = createBaseGroup({
    code: "UNIT-CHECK",
    itinerary: [
      {
        date: "Today",
        year: todayIso.slice(0, 4),
        category: "Departure",
        categoryKey: "departure",
        title: "Today Departure",
        meta: "21:00 | Trip",
        icon: "flight_takeoff",
        isoDate: todayIso,
        time: "21:00",
        from: "Hotel",
        to: "Airport",
        requiresBus: true,
        hotelPickupRequestTime: "18:30",
      },
      {
        date: "Tomorrow",
        year: tomorrowIso.slice(0, 4),
        category: "Transfer",
        categoryKey: "transfer",
        title: "Train Transfer",
        meta: "09:00 | Trip",
        icon: "airport_shuttle",
        isoDate: tomorrowIso,
        time: "09:00",
        from: "Makkah",
        to: "Madinah",
        requiresBus: true,
        transferByTrain: true,
        trainDepartureTime: "09:00",
        destinationPickupTime: "10:20",
      },
      {
        date: "Outside",
        year: outsideWindowIso.slice(0, 4),
        category: "Arrival",
        categoryKey: "arrival",
        title: "Outside Window",
        meta: "07:00 | Trip",
        icon: "flight_land",
        isoDate: outsideWindowIso,
        time: "07:00",
        from: "Airport",
        to: "Hotel",
        requiresBus: true,
      },
    ],
  });

  const checklistItems = buildChecklistItemsFromGroups([group]);
  assert.equal(checklistItems.length, 3);

  const departure = checklistItems.find((entry) => entry.activity === "Departure");
  assert.ok(departure);
  assert.equal(departure?.scheduledTime, "18:30");
  assert.equal(departure?.requiredBusCount, 2);

  const transferItems = checklistItems.filter((entry) => entry.activity.startsWith("Transfer -"));
  assert.equal(transferItems.length, 2);
  assert.equal(
    transferItems.some((entry) => entry.activity === "Transfer - Train Departure" && entry.scheduledTime === "09:00"),
    true,
  );
  assert.equal(
    transferItems.some(
      (entry) => entry.activity === "Transfer - Arrival Station Pickup" && entry.scheduledTime === "10:20",
    ),
    true,
  );
}

async function main(): Promise<void> {
  await runCase("app-domain raudhah appointment normalization", testResolveValidRaudhahAppointmentsNormalization);
  await runCase("app-domain route helper behavior", testRouteHelpersForCategorySpecificBehavior);
  await runCase("app-domain transfer train expansion", testTransferTrainExpansionCreatesTwoChecklistSegments);
  await runCase("app-domain visa tracking row builder", testBuildVisaTrackingRowsUsesItineraryBoundariesAndStatuses);
  await runCase("app-domain checklist item builder", testBuildChecklistItemsFiltersDateWindowAndUsesDeparturePickupTime);
}

void main().catch((error: unknown) => {
  console.error("App domain unit test failed:", error);
  process.exitCode = 1;
});
