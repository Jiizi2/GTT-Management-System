import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  buildChecklistActivityLabel,
  buildChecklistItemsFromGroups,
  buildItineraryItemFromEditForm,
  buildTransferTrainSummary,
  buildVisaTrackingRowsFromGroups,
  createDummyOverviewGroups,
  createEditScheduleForm,
  createEmptyChecklistDraft,
  createEmptyChecklistDriverProfile,
  createInitialInputItineraryForm,
  createInitialNoteForm,
  createInitialScheduleForm,
  createNewGroupAgreementForm,
  createNewGroupRaudhahForm,
  createNoteItems,
  createScheduleMeta,
  detectCityFromText,
  escapeHtml,
  expandInputTransferTrainItems,
  expandTransferTrainItineraryItems,
  formatAprilDisplayDate,
  formatAprilIsoDate,
  formatChecklistCopyDate,
  formatRouteSummary,
  formatScheduleDate,
  formatScheduleTime,
  getAllowedTransportModes,
  getDefaultTransportMode,
  getTransportModeIcon,
  resolveItineraryIcon,
  resolveTransportMode,
  getChecklistRangeDates,
  getChecklistDayLabel,
  getLocalIsoDateWithOffset,
  getMinimumBusCountForPax,
  getRouteFieldConfigByCategory,
  getScheduleTypeOption,
  getStatusByTone,
  getTransferTrainSegmentCategory,
  getItineraryIsoDate,
  hasIncompleteTransferTrainFields,
  includesKnownKeyword,
  inferCategoryKey,
  inferCityTourCity,
  isCityTourActivityType,
  isDepartureActivityType,
  isFlightActivityType,
  isFridayDate,
  isTransferActivityType,
  normalizeGroupStatus,
  normalizeSaudiCityValue,
  overviewDummySeeds,
  parseDisplayDateToIso,
  parseTimeForInput,
  resolveCurrentGroupTone,
  resolveGroupCompleteness,
  resolveGroupToneByItinerary,
  resolveVisaAgreementNumber,
  resolveTotalBusCount,
  resolveValidRaudhahAppointments,
  scrollToTop,
  shouldShowFridayCityTourWarning,
  sortInputItineraryItems,
  type GroupData,
  type InputItineraryItem,
  type ItineraryItem,
} from "../shared/app-domain.js";
import { runCase } from "../test/run-case.js";

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

function createBaseItineraryItem(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    date: "10 Apr",
    year: "2026",
    category: "City Tour",
    title: "Default itinerary item",
    meta: "08:00 | Unit meta",
    icon: "tour",
    ...overrides,
  };
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
  assert.equal(departureFields.toLabel, "Destination Airport City");
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

  const entryOnlyGroup = createBaseGroup({
    code: "UNIT-ENTRY",
    status: "Entry Only",
    visaSetup: undefined,
  });
  const entryOnlyRow = buildVisaTrackingRowsFromGroups([entryOnlyGroup])[0];
  assert.equal(entryOnlyRow.visaStatus, "Draft");
  assert.equal(entryOnlyRow.paymentStatus, "Unpaid");
  assert.equal(entryOnlyRow.makkahVerified, 0);
  assert.equal(entryOnlyRow.madinahVerified, 0);
  assert.equal(resolveVisaAgreementNumber(entryOnlyRow, entryOnlyGroup, "makkah"), "Agreement pending");
  assert.equal(resolveVisaAgreementNumber(rows[0], group, "makkah"), "AG-M-1");
}

function testGroupCompletenessFlagsMissingPartsAndMismatches(): void {
  const partialGroup = createBaseGroup({
    code: "UNIT-PARTIAL",
    status: "Entry Only",
    itinerary: [],
    visaSetup: undefined,
  });

  const partialSummary = resolveGroupCompleteness(partialGroup);
  assert.equal(partialSummary.state, "incomplete");
  assert.equal(partialSummary.isReadyForOperations, false);
  assert.equal(
    partialSummary.issues.some((issue) => issue.key === "missing-agreement"),
    true,
  );
  assert.equal(
    partialSummary.issues.some((issue) => issue.key === "missing-itinerary"),
    true,
  );

  const completeGroup = createBaseGroup({
    code: "UNIT-COMPLETE",
    pax: 45,
    itinerary: [
      {
        date: "01 Jan",
        year: "2099",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Arrival Trip",
        meta: "08:00 | Airport",
        icon: "flight_land",
        isoDate: "2099-01-01",
        time: "08:00",
        from: "JED Airport",
        to: "Makkah Hotel",
        requiresBus: true,
      },
      {
        date: "05 Jan",
        year: "2099",
        category: "Departure",
        categoryKey: "departure",
        title: "Departure Trip",
        meta: "21:00 | Hotel to Airport",
        icon: "flight_takeoff",
        isoDate: "2099-01-05",
        time: "21:00",
        from: "Madinah Hotel",
        to: "MED Airport",
        requiresBus: true,
      },
    ],
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "2098-12-31",
      syarikah: "Provider Unit",
      paymentStatus: "Paid",
      makkahHotels: [
        {
          id: "m-1",
          hotelName: "Makkah Hotel",
          agreementNumber: "M-1",
          pax: 45,
          status: "Approved",
          stayStartIso: "2099-01-01",
          stayEndIso: "2099-01-03",
        },
      ],
      madinahHotels: [
        {
          id: "d-1",
          hotelName: "Madinah Hotel",
          agreementNumber: "D-1",
          pax: 45,
          status: "Approved",
          stayStartIso: "2099-01-03",
          stayEndIso: "2099-01-05",
        },
      ],
      raudhahAppointments: [],
    },
  });

  const completeSummary = resolveGroupCompleteness(completeGroup);
  assert.equal(completeSummary.state, "ready");
  assert.equal(completeSummary.isReadyForOperations, true);
  assert.equal(completeSummary.issues.length, 0);

  const mismatchedSummary = resolveGroupCompleteness(
    createBaseGroup({
      code: "UNIT-MISMATCH",
      pax: 45,
      itinerary: completeGroup.itinerary,
      visaSetup: {
        ...completeGroup.visaSetup!,
        makkahHotels: [
          {
            ...completeGroup.visaSetup!.makkahHotels[0],
            pax: 30,
            stayStartIso: "2099-01-03",
            stayEndIso: "2099-01-05",
          },
        ],
        madinahHotels: [
          {
            ...completeGroup.visaSetup!.madinahHotels[0],
            pax: 45,
            stayStartIso: "2099-01-05",
            stayEndIso: "2099-01-07",
          },
        ],
      },
    }),
  );
  assert.equal(
    mismatchedSummary.issues.some((issue) => issue.key === "pax-mismatch"),
    true,
  );
  assert.equal(
    mismatchedSummary.issues.some((issue) => issue.key === "date-mismatch"),
    true,
  );
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

function testBuildChecklistItemsKeepsVisaOnlyGroupInsideWindow(): void {
  const dayAfterTomorrowIso = getLocalIsoDateWithOffset(2);
  const group = createBaseGroup({
    code: "UNIT-VISA-ONLY",
    visaSetup: {
      visaStatus: "Pending",
      syarikah: "Provider Unit",
      paymentStatus: "Partial",
      makkahHotels: [],
      madinahHotels: [],
      raudhahAppointments: [],
    },
    itinerary: [
      {
        date: "Day After Tomorrow",
        year: dayAfterTomorrowIso.slice(0, 4),
        category: "Departure",
        categoryKey: "departure",
        title: "Visa Only Departure",
        meta: "23:00 | Trip",
        icon: "flight_takeoff",
        isoDate: dayAfterTomorrowIso,
        time: "23:00",
        from: "Madinah Hotel",
        to: "MED Airport",
        requiresBus: true,
        hotelPickupRequestTime: "20:00",
      },
    ],
  });

  const checklistItems = buildChecklistItemsFromGroups([group]);
  assert.equal(checklistItems.length, 1);
  assert.equal(checklistItems[0]?.groupCode, "UNIT-VISA-ONLY");
  assert.equal(checklistItems[0]?.tripDate, dayAfterTomorrowIso);
  assert.equal(checklistItems[0]?.scheduledTime, "20:00");
}

function testBuildChecklistItemsMergesLinkedGroups(): void {
  const [todayIso] = getChecklistRangeDates();
  
  const parentGroup = createBaseGroup({
    code: "PARENT-GP",
    pax: 40,
    itinerary: [
      {
        date: "Today",
        year: todayIso.slice(0, 4),
        category: "Arrival",
        categoryKey: "arrival",
        title: "Family Arrival",
        meta: "08:00 | JED Airport",
        icon: "flight_land",
        isoDate: todayIso,
        time: "08:00",
        from: "JED Airport",
        to: "Makkah Hotel",
        requiresBus: true,
      },
    ],
  });

  const childGroup = createBaseGroup({
    code: "CHILD-GP",
    pax: 5,
    parentGroupId: parentGroup.code,
    itinerary: [],
  });

  const checklistItems = buildChecklistItemsFromGroups([parentGroup, childGroup]);
  assert.equal(checklistItems.length, 1);
  assert.equal(checklistItems[0].groupCode, "PARENT-GP");
  assert.equal(checklistItems[0].groupPax, 45);
  assert.deepEqual(checklistItems[0].groupCodes, ["PARENT-GP", "CHILD-GP"]);
}

function testOverviewAndStatusNormalizationHelpers(): void {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const yesterdayIso = getLocalIsoDateWithOffset(-1);
  const todayIso = getLocalIsoDateWithOffset(0);
  const yesterdayDate = formatScheduleDate(yesterdayIso);
  const todayDate = formatScheduleDate(todayIso);

  assert.equal(formatAprilIsoDate(-3), "2026-04-01");
  assert.equal(formatAprilIsoDate(35), "2026-04-30");
  assert.equal(formatAprilDisplayDate(-4), "1 Apr");
  assert.equal(formatAprilDisplayDate(35), "30 Apr");
  assert.equal(getStatusByTone("active"), "Active");
  assert.equal(getStatusByTone("inactive"), "In Active");
  assert.equal(includesKnownKeyword("Bus route to Makkah", ["makkah"]), true);
  assert.equal(includesKnownKeyword("Bus route to Doha", ["makkah"]), false);
  assert.equal(resolveGroupToneByItinerary([]), "inactive");
  assert.equal(
    resolveGroupToneByItinerary([
      createBaseItineraryItem({
        category: "Arrival",
        title: "Landing at Jeddah and heading to Makkah",
        from: "Jeddah",
        to: "Makkah",
        icon: "flight_land",
      }),
    ]),
    "active",
  );
  assert.equal(
    resolveCurrentGroupTone(
      "active",
      [
        createBaseItineraryItem({
          date: yesterdayDate.date,
          year: yesterdayDate.year,
          isoDate: yesterdayIso,
          time: "08:00",
        }),
      ],
      now,
    ),
    "inactive",
  );
  assert.equal(
    resolveCurrentGroupTone(
      "active",
      [
        createBaseItineraryItem({
          date: todayDate.date,
          year: todayDate.year,
          isoDate: todayIso,
          time: "",
          meta: "Unit meta",
        }),
      ],
      now,
    ),
    "active",
  );
  assert.equal(getMinimumBusCountForPax(0), 1);
  assert.equal(getMinimumBusCountForPax(120), 3);
  assert.equal(resolveTotalBusCount(120, 1), 3);
  assert.equal(resolveTotalBusCount(120, 4.9), 4);

  const dummyGroups = createDummyOverviewGroups();
  assert.equal(dummyGroups.length, overviewDummySeeds.length);
  assert.equal(
    dummyGroups.every((group) => group.itinerary.length === 3),
    true,
  );
  assert.equal(
    dummyGroups.every((group) => (group.totalBuses ?? 0) >= 1),
    true,
  );

  const upcomingTransferIso = getLocalIsoDateWithOffset(1);
  const upcomingTransferDate = formatScheduleDate(upcomingTransferIso);
  const normalized = normalizeGroupStatus(
    createBaseGroup({
      code: "UNIT-NORMALIZE",
      status: "Unknown",
      tone: "inactive",
      pax: 120,
      totalBuses: 1,
      arrivalDate: "invalid",
      returnDate: "invalid",
      itinerary: [
        createBaseItineraryItem({
          category: "Transfer",
          categoryKey: "transfer",
          date: upcomingTransferDate.date,
          year: upcomingTransferDate.year,
          isoDate: upcomingTransferIso,
          from: "Makkah",
          to: "Madinah",
          icon: "airport_shuttle",
          transferByTrain: true,
          trainDepartureTime: "08:30",
          destinationPickupTime: "10:00",
        }),
      ],
    }),
  );

  assert.equal(normalized.arrivalDate, upcomingTransferIso);
  assert.equal(normalized.returnDate, upcomingTransferIso);
  assert.equal(normalized.itinerary.length, 2);
  assert.equal(normalized.tone, "active");
  assert.equal(normalized.status, "Active");
  assert.equal(normalized.totalBuses, 3);

  const identityOnly = normalizeGroupStatus(
    createBaseGroup({
      code: "UNIT-IDENTITY",
      status: "Entry Only",
      tone: "active",
      itinerary: [],
    }),
  );
  assert.equal(identityOnly.tone, "active");
  assert.equal(identityOnly.status, "Entry Only");
}

function testFormFactoryAndCategoryHelpers(): void {
  const initialInputForm = createInitialInputItineraryForm();
  assert.equal(initialInputForm.category, "city-tour");
  assert.equal(initialInputForm.requiresBus, true);
  assert.equal(initialInputForm.transferByTrain, false);

  const agreementForm = createNewGroupAgreementForm("makkah");
  assert.equal(agreementForm.id.startsWith("makkah-"), true);
  assert.equal(agreementForm.status, "Waiting for Approval");
  assert.equal(agreementForm.pax, "");

  const raudhahForm = createNewGroupRaudhahForm();
  assert.equal(raudhahForm.id.startsWith("raudhah-"), true);
  assert.equal(raudhahForm.status, "Free");
  assert.equal(raudhahForm.tasrehPrinted, false);

  const sorted = sortInputItineraryItems([
    {
      id: "item-2",
      date: "2026-04-12",
      time: "10:00",
      category: "Transfer",
      categoryKey: "transfer",
      from: "Makkah",
      to: "Madinah",
      cityTourCity: "",
      flightNumber: "",
      requiresBus: true,
      notes: "",
      icon: "airport_shuttle",
      transferByTrain: false,
      trainDepartureTime: "",
      destinationPickupTime: "",
      hotelPickupRequestTime: "",
    },
    {
      id: "item-1",
      date: "2026-04-11",
      time: "09:00",
      category: "Arrival",
      categoryKey: "arrival",
      from: "Jeddah",
      to: "Makkah",
      cityTourCity: "",
      flightNumber: "",
      requiresBus: true,
      notes: "",
      icon: "flight_land",
      transferByTrain: false,
      trainDepartureTime: "",
      destinationPickupTime: "",
      hotelPickupRequestTime: "",
    },
  ]);
  assert.equal(sorted[0].id, "item-1");

  const scheduleForm = createInitialScheduleForm();
  assert.equal(scheduleForm.category, "city-tour");
  assert.equal(scheduleForm.highlighted, false);
  assert.equal(scheduleForm.transferByTrain, false);

  assert.deepEqual(createInitialNoteForm(), { text: "", pinned: false });
  assert.deepEqual(createEmptyChecklistDriverProfile(), { name: "", phone: "", plateNumber: "" });
  assert.deepEqual(createEmptyChecklistDraft(), { name: "", phone: "", plateNumber: "" });
  assert.deepEqual(createNoteItems(["Alpha", "Beta"], "UNIT"), [
    { id: "UNIT-note-0", text: "Alpha", pinned: false },
    { id: "UNIT-note-1", text: "Beta", pinned: false },
  ]);

  assert.equal(getScheduleTypeOption("arrival").icon, "flight_land");
  assert.equal(getScheduleTypeOption("unknown").value, "city-tour");
  assert.equal(isFlightActivityType("arrival"), true);
  assert.equal(isFlightActivityType("city-tour"), false);
  assert.equal(isTransferActivityType("TRANSFER"), true);
  assert.equal(isCityTourActivityType("CITY-TOUR"), true);
  assert.equal(isDepartureActivityType("departure"), true);

  assert.equal(
    hasIncompleteTransferTrainFields({
      category: "arrival",
      transferByTrain: true,
      trainDepartureTime: "",
      destinationPickupTime: "",
    }),
    false,
  );
  assert.equal(
    hasIncompleteTransferTrainFields({
      category: "transfer",
      transferByTrain: true,
      trainDepartureTime: "",
      destinationPickupTime: "10:00",
    }),
    true,
  );
  assert.equal(
    hasIncompleteTransferTrainFields({
      category: "transfer",
      transferByTrain: true,
      trainDepartureTime: "08:00",
      destinationPickupTime: "10:00",
    }),
    false,
  );
  assert.equal(
    buildTransferTrainSummary({
      category: "transfer",
      transferByTrain: true,
      trainDepartureTime: "8:00",
      destinationPickupTime: "10:00",
    }),
    "HHR Transfer | Train departure: 08:00 | Station pickup: 10:00",
  );
  assert.equal(
    buildTransferTrainSummary({
      category: "arrival",
      transferByTrain: true,
      trainDepartureTime: "08:00",
      destinationPickupTime: "09:00",
    }),
    "",
  );
  assert.equal(getTransferTrainSegmentCategory("train-departure"), "Transfer - Train Departure");
  assert.equal(getTransferTrainSegmentCategory("station-pickup"), "Transfer - Arrival Station Pickup");

  assert.equal(inferCategoryKey(createBaseItineraryItem({ categoryKey: "departure" })), "departure");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Arrival Flight" })), "arrival");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Umrah City Tour" })), "city-tour");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Hotel Transfer" })), "transfer");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Flight Departure" })), "departure");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Other", icon: "flight_land" })), "arrival");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Other", icon: "airport_shuttle" })), "transfer");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Other", icon: "flight_takeoff" })), "departure");
  assert.equal(inferCategoryKey(createBaseItineraryItem({ category: "Other", icon: "help" })), "city-tour");
}

function testScheduleEditingAndCityInferenceHelpers(): void {
  assert.deepEqual(formatScheduleDate("2026-13-09"), { date: "9 Jan", year: "2026" });
  assert.equal(formatScheduleTime(""), "TBD");
  assert.equal(formatScheduleTime("7:05 PM"), "19:05");
  assert.equal(formatScheduleTime("24:61"), "24:61");
  assert.equal(formatScheduleTime("7:07"), "07:07");
  assert.equal(parseDisplayDateToIso("1 Apr", "2026"), "2026-04-01");
  assert.equal(parseDisplayDateToIso("1 Xxx", "2026"), "");
  assert.equal(parseDisplayDateToIso("", "2026"), "");
  assert.equal(parseTimeForInput(""), "");
  assert.equal(parseTimeForInput("07:30"), "07:30");
  assert.equal(parseTimeForInput("7:30 PM"), "19:30");
  assert.equal(parseTimeForInput("12:05 AM"), "00:05");
  assert.equal(parseTimeForInput("invalid"), "");

  const detailMeta = createScheduleMeta({
    category: "departure",
    time: "19:00",
    flightNumber: " SV-810 ",
    hotelPickupRequestTime: "17:30",
    from: "Madinah",
    to: "MED Airport",
    note: "This note is intentionally very long to trigger note truncation behavior in metadata.",
  });
  assert.equal(detailMeta.includes("19:00"), true);
  assert.equal(detailMeta.includes("SV-810"), true);
  assert.equal(detailMeta.includes("Hotel pickup request 17:30"), true);
  assert.equal(detailMeta.includes("Depart from Madinah to MED Airport"), true);
  assert.equal(detailMeta.includes("..."), true);
  assert.equal(
    createScheduleMeta({
      time: " ",
      from: "",
      to: "",
    }),
    "Schedule details pending confirmation",
  );

  assert.equal(detectCityFromText("Hotel in Makkah"), "Makkah");
  assert.equal(detectCityFromText(""), "");
  assert.equal(normalizeSaudiCityValue(" madinah "), "Madinah");
  assert.equal(normalizeSaudiCityValue("Unknown"), "");
  assert.equal(inferCityTourCity(createBaseItineraryItem({ cityTourCity: " Makkah " })), "Makkah");
  assert.equal(
    inferCityTourCity(
      createBaseItineraryItem({
        cityTourCity: "",
        from: "",
        to: "",
        title: "City tour in Madinah heritage area",
        notes: "",
      }),
    ),
    "Madinah",
  );

  const transferItem = createBaseItineraryItem({
    category: "Transfer",
    categoryKey: "transfer",
    date: "10 Apr",
    year: "2026",
    time: undefined,
    meta: "08:15 | Train transfer",
    from: "makkah",
    to: "madinah",
    transferByTrain: true,
    destinationPickupTime: "10:00",
    notes: "Transfer note",
    icon: "airport_shuttle",
  });
  const transferEdit = createEditScheduleForm(transferItem);
  assert.equal(transferEdit.date, "2026-04-10");
  assert.equal(transferEdit.time, "08:15");
  assert.equal(transferEdit.from, "Makkah");
  assert.equal(transferEdit.to, "Madinah");
  assert.equal(transferEdit.transferByTrain, true);
  assert.equal(transferEdit.trainDepartureTime, "08:15");

  const departureItem = createBaseItineraryItem({
    category: "Departure",
    categoryKey: "departure",
    date: "11 Apr",
    year: "2026",
    isoDate: "2026-04-11",
    time: "21:00",
    meta: "21:00 | Flight",
    from: "Madinah",
    to: "MED Airport",
    hotelPickupRequestTime: "18:30",
    requiresBus: true,
    icon: "flight_takeoff",
  });
  const departureEdit = createEditScheduleForm(departureItem);
  assert.equal(departureEdit.hotelPickupRequestTime, "18:30");

  const updatedTransfer = buildItineraryItemFromEditForm(transferItem, {
    ...transferEdit,
    date: "2026-04-10",
    time: "08:15",
    from: "Makkah",
    to: "Madinah",
    cityTourCity: "",
    notes: "Transfer note from form",
    transferByTrain: true,
    trainDepartureTime: "08:20",
    destinationPickupTime: "09:40",
    requiresBus: false,
    hotelName: "Madinah Hotel",
    hotelPickupRequestTime: "",
    category: "transfer",
    flightNumber: "",
  });
  assert.equal(updatedTransfer.categoryKey, "transfer");
  assert.equal(updatedTransfer.transferByTrain, true);
  assert.equal(updatedTransfer.transportMode, "train");
  // Train transfers no longer auto-require a bus; operators add a bus segment
  // manually when the group needs road transport around the station.
  assert.equal(updatedTransfer.requiresBus, false);
  assert.equal(updatedTransfer.time, "08:20");
  assert.equal(updatedTransfer.destinationPickupTime, "09:40");
  assert.equal(updatedTransfer.meta.includes("HHR Transfer"), true);
  assert.equal(updatedTransfer.meta.includes("Transfer from Makkah to Madinah"), true);

  assert.equal(isFridayDate("2026-04-10"), true);
  assert.equal(isFridayDate(""), false);
  assert.equal(shouldShowFridayCityTourWarning("city-tour", "2026-04-10"), true);
  assert.equal(shouldShowFridayCityTourWarning("transfer", "2026-04-10"), false);
}

function testDisplayChecklistAndScrollHelpers(): void {
  const expandedPlain = expandTransferTrainItineraryItems([
    createBaseItineraryItem({
      category: "Arrival",
      categoryKey: "arrival",
      isoDate: "2026-04-12",
      time: "07:00",
      icon: "flight_land",
      from: "Jeddah",
      to: "Makkah",
    }),
  ]);
  assert.equal(expandedPlain.length, 1);

  const expandedTrain = expandTransferTrainItineraryItems([
    createBaseItineraryItem({
      category: "Transfer",
      categoryKey: "transfer",
      date: "12 Apr",
      year: "2026",
      title: "Transfer from Makkah to Madinah",
      meta: "08:00 | train",
      icon: "airport_shuttle",
      from: "Makkah",
      to: "Madinah",
      transferByTrain: true,
      trainDepartureTime: "08:30",
      destinationPickupTime: "10:10",
      notes: "Fast route",
    }),
  ]);
  assert.equal(expandedTrain.length, 2);
  assert.equal(expandedTrain[0].category, "Transfer - Train Departure");
  assert.equal(expandedTrain[1].category, "Transfer - Arrival Station Pickup");
  assert.equal(expandedTrain[1].notes, "");

  assert.equal(escapeHtml("<b>'x' & \"y\"</b>"), "&lt;b&gt;&#39;x&#39; &amp; &quot;y&quot;&lt;/b&gt;");
  assert.equal(getChecklistDayLabel(""), "-");
  assert.equal(getChecklistDayLabel("bad-date"), "bad-date");
  assert.equal(getChecklistDayLabel("2026-04-10").includes("2026"), true);
  assert.equal(formatChecklistCopyDate(""), "-");
  assert.equal(formatChecklistCopyDate("bad-date"), "BAD-DATE");
  assert.equal(formatChecklistCopyDate("2026-04-10").includes("APR"), true);
  assert.equal(getItineraryIsoDate(createBaseItineraryItem({ isoDate: "2026-04-20" })), "2026-04-20");
  assert.equal(
    getItineraryIsoDate(createBaseItineraryItem({ isoDate: undefined, date: "2 Apr", year: "2026" })),
    "2026-04-02",
  );
  assert.equal(
    buildChecklistActivityLabel(createBaseItineraryItem({ category: "Departure" }), "departure"),
    "Departure",
  );
  assert.equal(
    buildChecklistActivityLabel(
      createBaseItineraryItem({
        category: "City Tour",
        cityTourCity: "",
      }),
      "city-tour",
    ),
    "City Tour",
  );
  assert.equal(
    buildChecklistActivityLabel(
      createBaseItineraryItem({
        category: "City Tour",
        from: "Makkah Hotel",
        to: "Jabal Rahmah",
        cityTourCity: "",
      }),
      "city-tour",
    ),
    "City Tour Makkah",
  );
  assert.equal(
    buildChecklistActivityLabel(
      createBaseItineraryItem({
        category: "City Tour Makkah",
        cityTourCity: "Makkah",
      }),
      "city-tour",
    ),
    "City Tour Makkah",
  );

  const globalWithWindow = globalThis as unknown as {
    window?: { scrollTo: (options: { top: number; behavior: string }) => void };
  };
  const originalWindow = globalWithWindow.window;
  let scrollPayload: { top: number; behavior: string } | null = null;
  globalWithWindow.window = {
    scrollTo: (options) => {
      scrollPayload = options;
    },
  };

  try {
    scrollToTop();
  } finally {
    if (originalWindow) {
      globalWithWindow.window = originalWindow;
    } else {
      delete globalWithWindow.window;
    }
  }

  assert.deepEqual(scrollPayload, {
    top: 0,
    behavior: "smooth",
  });
}

function testAgreementPaxExceedsGroupPaxDoesNotMismatch(): void {
  const completeGroup = createBaseGroup({
    code: "UNIT-COMPLETE",
    pax: 45,
    itinerary: [
      {
        date: "01 Jan",
        year: "2099",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Arrival Trip",
        meta: "08:00 | Airport",
        icon: "flight_land",
        isoDate: "2099-01-01",
        time: "08:00",
        from: "JED Airport",
        to: "Makkah Hotel",
        requiresBus: true,
      },
    ],
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "2098-12-31",
      syarikah: "Provider Unit",
      paymentStatus: "Paid",
      makkahHotels: [
        {
          id: "m-1",
          hotelName: "Makkah Hotel",
          agreementNumber: "M-1",
          pax: 50,
          status: "Approved",
          stayStartIso: "2099-01-01",
          stayEndIso: "2099-01-03",
        },
      ],
      madinahHotels: [],
      raudhahAppointments: [],
    },
  });

  const summary = resolveGroupCompleteness(completeGroup);
  const hasPaxMismatch = summary.issues.some((issue) => issue.key === "pax-mismatch");
  assert.equal(hasPaxMismatch, false);

  const incompleteGroup = {
    ...completeGroup,
    visaSetup: {
      ...completeGroup.visaSetup!,
      makkahHotels: [
        {
          ...completeGroup.visaSetup!.makkahHotels[0],
          pax: 40,
        },
      ],
    },
  };
  const summaryIncomplete = resolveGroupCompleteness(incompleteGroup);
  const hasPaxMismatchIncomplete = summaryIncomplete.issues.some((issue) => issue.key === "pax-mismatch");
  assert.equal(hasPaxMismatchIncomplete, true);
}

function testGroupCompletenessCalculatesDailyPaxCorrectly(): void {
  // Test sequential agreements
  const sequentialGroup = createBaseGroup({
    code: "UNIT-SEQ",
    pax: 46,
    itinerary: [], // simplify
    visaSetup: {
      visaStatus: "Draft",
      syarikah: "",
      paymentStatus: "Unpaid",
      makkahHotels: [
        { id: "m-1", hotelName: "H1", agreementNumber: "A1", pax: 23, status: "Approved", stayStartIso: "2024-01-22", stayEndIso: "2024-01-25" },
        { id: "m-2", hotelName: "H2", agreementNumber: "A2", pax: 23, status: "Approved", stayStartIso: "2024-01-25", stayEndIso: "2024-01-26" },
      ],
      madinahHotels: [],
      raudhahAppointments: [],
    },
  });
  
  // They cover 23 pax each but on different nights, so max coverage is 23. Group needs 46, so mismatch = true.
  assert.equal(
    resolveGroupCompleteness(sequentialGroup).issues.some((i) => i.key === "pax-mismatch"),
    true,
  );

  // Test overlapping agreements
  const overlappingGroup = createBaseGroup({
    code: "UNIT-OVR",
    pax: 30,
    itinerary: [],
    visaSetup: {
      visaStatus: "Draft",
      syarikah: "",
      paymentStatus: "Unpaid",
      makkahHotels: [
        { id: "m-1", hotelName: "H1", agreementNumber: "A1", pax: 23, status: "Approved", stayStartIso: "2024-01-22", stayEndIso: "2024-01-25" },
        { id: "m-2", hotelName: "H2", agreementNumber: "A2", pax: 7, status: "Approved", stayStartIso: "2024-01-22", stayEndIso: "2024-01-25" },
      ],
      madinahHotels: [],
      raudhahAppointments: [],
    },
  });

  // They cover the same nights and sum to 30. Group needs 30. Mismatch = false.
  assert.equal(
    resolveGroupCompleteness(overlappingGroup).issues.some((i) => i.key === "pax-mismatch"),
    false,
  );
}

function testItineraryDateToleranceWarning(): void {
  const baseGroup = createBaseGroup({
    code: "TOLERANCE-TEST",
    pax: 45,
    itinerary: [
      {
        date: "01 Jan",
        year: "2099",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Arrival Trip",
        meta: "08:00 | Airport",
        icon: "flight_land",
        isoDate: "2099-01-01",
        time: "08:00",
        from: "JED Airport",
        to: "Makkah Hotel",
        requiresBus: true,
      },
      {
        date: "05 Jan",
        year: "2099",
        category: "Departure",
        categoryKey: "departure",
        title: "Departure Trip",
        meta: "21:00 | Hotel to Airport",
        icon: "flight_takeoff",
        isoDate: "2099-01-05",
        time: "21:00",
        from: "Madinah Hotel",
        to: "MED Airport",
        requiresBus: true,
      },
    ],
  });

  // 1. Exact match: Makkah Jan 1-3, Madinah Jan 3-5 -> No date-mismatch warning.
  const exactGroup: GroupData = {
    ...baseGroup,
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "2098-12-31",
      syarikah: "Provider Unit",
      paymentStatus: "Paid",
      makkahHotels: [
        { id: "m-1", hotelName: "H1", agreementNumber: "A1", pax: 45, status: "Approved", stayStartIso: "2099-01-01", stayEndIso: "2099-01-03" },
      ],
      madinahHotels: [
        { id: "d-1", hotelName: "H2", agreementNumber: "A2", pax: 45, status: "Approved", stayStartIso: "2099-01-03", stayEndIso: "2099-01-05" },
      ],
      raudhahAppointments: [],
    },
  };
  assert.equal(
    resolveGroupCompleteness(exactGroup).issues.some((i) => i.key === "date-mismatch"),
    false,
  );

  // 2. 1-day difference in arrival (starts Jan 2) -> No date-mismatch warning.
  const diffArrival1DayGroup: GroupData = {
    ...baseGroup,
    visaSetup: {
      ...exactGroup.visaSetup!,
      makkahHotels: [
        { ...exactGroup.visaSetup!.makkahHotels[0], stayStartIso: "2099-01-02" },
      ],
    },
  };
  assert.equal(
    resolveGroupCompleteness(diffArrival1DayGroup).issues.some((i) => i.key === "date-mismatch"),
    false,
  );

  // 3. 1-day difference in departure (ends Jan 4) -> No date-mismatch warning.
  const diffDeparture1DayGroup: GroupData = {
    ...baseGroup,
    visaSetup: {
      ...exactGroup.visaSetup!,
      madinahHotels: [
        { ...exactGroup.visaSetup!.madinahHotels[0], stayEndIso: "2099-01-04" },
      ],
    },
  };
  assert.equal(
    resolveGroupCompleteness(diffDeparture1DayGroup).issues.some((i) => i.key === "date-mismatch"),
    false,
  );

  // 4. 2-day difference in arrival (starts Jan 3) -> Warning.
  const diffArrival2DaysGroup: GroupData = {
    ...baseGroup,
    visaSetup: {
      ...exactGroup.visaSetup!,
      makkahHotels: [
        { ...exactGroup.visaSetup!.makkahHotels[0], stayStartIso: "2099-01-03" },
      ],
    },
  };
  assert.equal(
    resolveGroupCompleteness(diffArrival2DaysGroup).issues.some((i) => i.key === "date-mismatch"),
    true,
  );

  // 5. 2-day difference in departure (ends Jan 3) -> Warning.
  const diffDeparture2DaysGroup: GroupData = {
    ...baseGroup,
    visaSetup: {
      ...exactGroup.visaSetup!,
      madinahHotels: [
        { ...exactGroup.visaSetup!.madinahHotels[0], stayEndIso: "2099-01-03" },
      ],
    },
  };
  assert.equal(
    resolveGroupCompleteness(diffDeparture2DaysGroup).issues.some((i) => i.key === "date-mismatch"),
    true,
  );
}

function testTransportModeHelpersAndBusDeparture(): void {
  // Allowed modes + defaults per category.
  assert.deepEqual(getAllowedTransportModes("arrival"), ["flight", "bus"]);
  assert.deepEqual(getAllowedTransportModes("transfer"), ["bus", "train"]);
  assert.deepEqual(getAllowedTransportModes("city-tour"), []);
  assert.equal(getDefaultTransportMode("departure"), "flight");
  assert.equal(getDefaultTransportMode("transfer"), "bus");

  // Explicit mode wins.
  assert.equal(resolveTransportMode(createBaseItineraryItem({ categoryKey: "departure", transportMode: "bus" })), "bus");

  // Legacy inference: arrival/departure default to flight; transfer to bus;
  // train recovered from the legacy flag and from split-segment category labels.
  assert.equal(resolveTransportMode(createBaseItineraryItem({ categoryKey: "arrival", icon: "flight_land" })), "flight");
  assert.equal(resolveTransportMode(createBaseItineraryItem({ categoryKey: "transfer", category: "Transfer" })), "bus");
  assert.equal(
    resolveTransportMode(createBaseItineraryItem({ categoryKey: "transfer", transferByTrain: true })),
    "train",
  );
  assert.equal(
    resolveTransportMode(
      createBaseItineraryItem({ categoryKey: "transfer", category: "Transfer - Arrival Station Pickup" }),
    ),
    "train",
  );

  // Icons.
  assert.equal(getTransportModeIcon("flight", "arrival"), "flight_land");
  assert.equal(getTransportModeIcon("flight", "departure"), "flight_takeoff");
  assert.equal(getTransportModeIcon("bus", "transfer"), "directions_bus");
  assert.equal(getTransportModeIcon("train", "transfer"), "train");
  assert.equal(resolveItineraryIcon(createBaseItineraryItem({ categoryKey: "city-tour" })), "tour");
  assert.equal(
    resolveItineraryIcon(createBaseItineraryItem({ categoryKey: "departure", transportMode: "bus" })),
    "directions_bus",
  );

  // A bus departure clears the flight number and reflects the bus mode/icon.
  const busDeparture = buildItineraryItemFromEditForm(createBaseItineraryItem({ categoryKey: "departure" }), {
    date: "2026-04-12",
    time: "07:00",
    category: "departure",
    transportMode: "bus",
    flightNumber: "SV-999",
    hotelName: "Madinah Hotel",
    fromHotelName: "",
    from: "Madinah",
    to: "Amman",
    cityTourCity: "",
    requiresBus: false,
    notes: "",
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "06:00",
  });
  assert.equal(busDeparture.transportMode, "bus");
  assert.equal(busDeparture.flightNumber, "");
  assert.equal(busDeparture.icon, "directions_bus");
  assert.equal(busDeparture.requiresBus, true);
  assert.equal(busDeparture.transferByTrain, false);
}

describe("app-domain", () => {
  runCase("transport mode helpers and bus departure", testTransportModeHelpersAndBusDeparture);
  runCase("raudhah appointment normalization", testResolveValidRaudhahAppointmentsNormalization);
  runCase("route helper behavior", testRouteHelpersForCategorySpecificBehavior);
  runCase("transfer train expansion", testTransferTrainExpansionCreatesTwoChecklistSegments);
  runCase("visa tracking row builder", testBuildVisaTrackingRowsUsesItineraryBoundariesAndStatuses);
  runCase("group completeness helper", testGroupCompletenessFlagsMissingPartsAndMismatches);
  runCase("itinerary date tolerance warning", testItineraryDateToleranceWarning);
  runCase("group completeness calculates daily pax correctly", testGroupCompletenessCalculatesDailyPaxCorrectly);
  runCase("agreement pax exceeding group pax does not mismatch", testAgreementPaxExceedsGroupPaxDoesNotMismatch);
  runCase("checklist item builder", testBuildChecklistItemsFiltersDateWindowAndUsesDeparturePickupTime);
  runCase("checklist keeps visa only window items", testBuildChecklistItemsKeepsVisaOnlyGroupInsideWindow);
  runCase("checklist merges linked groups", testBuildChecklistItemsMergesLinkedGroups);
  runCase("overview/status helpers", testOverviewAndStatusNormalizationHelpers);
  runCase("form/category helpers", testFormFactoryAndCategoryHelpers);
  runCase("schedule editing helpers", testScheduleEditingAndCityInferenceHelpers);
  runCase("display/checklist/scroll helpers", testDisplayChecklistAndScrollHelpers);
});
