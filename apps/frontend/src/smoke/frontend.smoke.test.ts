import { describe } from "vitest";
import {
  buildChecklistItemsFromGroups,
  buildVisaTrackingRowsFromGroups,
  formatScheduleDate,
  getLocalIsoDateWithOffset,
  hasMissingHotelAllocation,
  isVisaRowActionRequired,
  mobileItems,
  normalizeGroupStatus,
  sidebarAccountItem,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  sidebarItems,
  type GroupData,
  type InputItineraryFormState,
  type InputItineraryItem,
} from "../shared/app-domain.js";
import {
  buildInputItineraryValidationState,
  buildDefaultItineraryNotes,
  buildTimelineAndNextActivity,
  calculateItineraryDurationDays,
  resolveEffectiveGroupIdentityState,
} from "../pages/add-group-workspace-helpers.js";
import {
  buildAgreementItineraryPrefill,
  buildNewGroupPayload,
  getAgreementSaveValidationError,
  validateConnectedAgreementDates,
} from "../pages/new-group-screen-helpers.js";
import { runCase } from "../test/run-case.js";

function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected '${String(expected)}', got '${String(actual)}'.`);
  }
}

function assertTruthy(value: unknown, message?: string): void {
  if (!value) {
    throw new Error(message ?? "Expected value to be truthy.");
  }
}

function assertStringArrayEqual(actual: string[], expected: string[], message?: string): void {
  const actualKey = JSON.stringify(actual);
  const expectedKey = JSON.stringify(expected);
  if (actualKey !== expectedKey) {
    throw new Error(message ?? `Expected ${expectedKey}, got ${actualKey}.`);
  }
}

function createSmokeGroup(): GroupData {
  const transferIso = getLocalIsoDateWithOffset(0);
  const departureIso = getLocalIsoDateWithOffset(1);
  const transferDate = formatScheduleDate(transferIso);
  const departureDate = formatScheduleDate(departureIso);

  return {
    code: "SMK-001",
    name: "Smoke Test Group",
    status: "Active",
    tone: "active",
    pax: 40,
    totalBuses: 1,
    packageName: "Standard Gold",
    durationDays: 8,
    timeline: [
      {
        date: transferDate.date,
        title: "Transfer to Madinah",
        isCurrent: true,
        nextActivity: "Transfer by train",
      },
      {
        date: departureDate.date,
        title: "Return Flight",
      },
    ],
    nextActivity: {
      title: "Transfer by train",
      date: transferDate.date,
      time: "08:00",
      icon: "train",
    },
    itinerary: [
      {
        date: transferDate.date,
        year: transferDate.year,
        category: "Transfer",
        categoryKey: "transfer",
        title: "Transfer Makkah -> Madinah",
        meta: "08:00 AM | Makkah -> Madinah",
        icon: "swap_horiz",
        isoDate: transferIso,
        time: "08:00",
        from: "Makkah",
        to: "Madinah",
        requiresBus: true,
        transferByTrain: true,
        trainDepartureTime: "08:00",
        destinationPickupTime: "09:15",
      },
      {
        date: departureDate.date,
        year: departureDate.year,
        category: "Departure",
        categoryKey: "departure",
        title: "Departure to airport",
        meta: "10:10 PM | Madinah Hotel -> MED Airport",
        icon: "flight_takeoff",
        isoDate: departureIso,
        time: "22:10",
        from: "Madinah Hotel",
        to: "MED Airport",
        requiresBus: true,
        hotelPickupRequestTime: "19:00",
      },
    ],
    notes: ["Smoke test fixture"],
    musyrif: {
      name: "Smoke Musyrif",
      phone: "+62 000 0000",
      avatar: "https://example.com/avatar.png",
    },
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "2026-08-10",
      syarikah: "Smoke Provider",
      paymentStatus: "Paid",
      busStatus: "Visa+",
      makkahHotels: [
        {
          id: "mak-1",
          hotelName: "Swissotel Al Maqam",
          agreementNumber: "SMK-MAK-1",
          pax: 40,
          status: "Approved",
          stayStartIso: transferIso,
          stayEndIso: departureIso,
        },
      ],
      madinahHotels: [
        {
          id: "mad-1",
          hotelName: "Pullman Zamzam Madinah",
          agreementNumber: "SMK-MAD-1",
          pax: 40,
          status: "Approved",
          stayStartIso: departureIso,
          stayEndIso: getLocalIsoDateWithOffset(3),
        },
      ],
      raudhahAppointments: [
        {
          id: "rau-1",
          dateIso: departureIso,
          status: "After",
        },
      ],
    },
  };
}

async function testNavigationItems(): Promise<void> {
  assertStringArrayEqual(
    sidebarItems.map((item) => item.id),
    ["overview", "checklist", "visa", "agreement-inbox", "invoice", "raudhah-reminder"],
  );
  assertEqual(sidebarAccountItem.id, "profile");
  assertStringArrayEqual(
    mobileItems.map((item) => item.id),
    ["overview", "checklist", "visa", "profile"],
  );
}

async function testChecklistFlow(): Promise<void> {
  const group = createSmokeGroup();
  const checklistItems = buildChecklistItemsFromGroups([group]);

  // Transfer-by-train should be expanded into two checklist entries + one departure entry.
  assertEqual(checklistItems.length, 3);
  const scheduledTimes = checklistItems.map((item) => item.scheduledTime);
  assertEqual(scheduledTimes.includes("08:00"), true);
  assertEqual(scheduledTimes.includes("09:15"), true);
  assertEqual(scheduledTimes.includes("19:00"), true);

  const departureItem = checklistItems.find((item) => item.activity.trim().toLowerCase() === "departure");
  assertTruthy(departureItem);
  assertEqual(departureItem?.scheduledTime, "19:00");
}

async function testChecklistWindowFiltering(): Promise<void> {
  const baseGroup = createSmokeGroup();
  const farFutureIso = getLocalIsoDateWithOffset(7);
  const dayAfterTomorrowIso = getLocalIsoDateWithOffset(2);
  const farFutureDate = formatScheduleDate(farFutureIso);
  const dayAfterTomorrowDate = formatScheduleDate(dayAfterTomorrowIso);

  const farFutureOnlyGroup: GroupData = {
    ...baseGroup,
    code: "SMK-OUTSIDE-WINDOW",
    itinerary: [
      {
        date: farFutureDate.date,
        year: farFutureDate.year,
        category: "Departure",
        categoryKey: "departure",
        title: "Outside Window Departure",
        meta: "10:00 AM | Outside schedule window",
        icon: "flight_takeoff",
        isoDate: farFutureIso,
        time: "10:00",
        from: "Madinah Hotel",
        to: "MED Airport",
        requiresBus: true,
        hotelPickupRequestTime: "07:00",
      },
    ],
  };

  const checklistItemsOutsideWindow = buildChecklistItemsFromGroups([farFutureOnlyGroup]);
  assertEqual(
    checklistItemsOutsideWindow.length,
    0,
    "Checklist should ignore itinerary outside H-1 window (today until H+2).",
  );

  const mixedWindowGroup: GroupData = {
    ...baseGroup,
    code: "SMK-MIXED-WINDOW",
    itinerary: [...baseGroup.itinerary, ...farFutureOnlyGroup.itinerary],
  };
  const checklistItemsMixedWindow = buildChecklistItemsFromGroups([mixedWindowGroup]);
  assertEqual(
    checklistItemsMixedWindow.length >= 1,
    true,
    "Checklist should still include itinerary that falls inside H-1 window.",
  );

  const visaOnlyWindowGroup: GroupData = {
    ...baseGroup,
    code: "SMK-VISA-ONLY-H2",
    visaSetup: baseGroup.visaSetup
      ? {
          ...baseGroup.visaSetup,
          busStatus: undefined,
        }
      : undefined,
    itinerary: [
      {
        date: dayAfterTomorrowDate.date,
        year: dayAfterTomorrowDate.year,
        category: "Departure",
        categoryKey: "departure",
        title: "Visa Only H+2 Departure",
        meta: "11:30 PM | H+2 schedule",
        icon: "flight_takeoff",
        isoDate: dayAfterTomorrowIso,
        time: "23:30",
        from: "Madinah Hotel",
        to: "MED Airport",
        requiresBus: true,
        hotelPickupRequestTime: "20:30",
      },
    ],
  };

  const visaOnlyChecklistItems = buildChecklistItemsFromGroups([visaOnlyWindowGroup]);
  assertEqual(
    visaOnlyChecklistItems.length,
    1,
    "Checklist should keep Visa Only groups visible when itinerary is inside H-1 window.",
  );
  assertEqual(
    visaOnlyChecklistItems[0]?.tripDate,
    dayAfterTomorrowIso,
    "Checklist should still include H+2 trips for early notice.",
  );
}

async function testVisaFlow(): Promise<void> {
  const group = createSmokeGroup();
  const rows = buildVisaTrackingRowsFromGroups([group]);
  assertEqual(rows.length, 1);

  const row = rows[0];
  assertEqual(row.groupCode, group.code);
  assertEqual(row.visaStatus, "Issued");
  assertEqual(row.issuedDateIso, "2026-08-10");
  assertEqual(row.paymentStatus, "Paid");
  assertEqual(row.makkahVerified, group.pax);
  assertEqual(row.madinahVerified, group.pax);
  assertEqual(hasMissingHotelAllocation(row), false);
  assertEqual(isVisaRowActionRequired(row), false);
}

async function testVisaFlowUnsortedItineraryBounds(): Promise<void> {
  const group = createSmokeGroup();
  group.durationDays = 3;
  group.visaSetup = undefined;
  group.itinerary = [
    {
      date: "12 Aug",
      year: "2026",
      category: "Transfer",
      categoryKey: "transfer",
      title: "Late Transfer",
      meta: "06:30 PM | Makkah -> Madinah",
      icon: "swap_horiz",
      isoDate: "2026-08-12",
      time: "18:30",
      from: "Makkah",
      to: "Madinah",
      requiresBus: true,
    },
    {
      date: "10 Aug",
      year: "2026",
      category: "Arrival",
      categoryKey: "arrival",
      title: "Early Arrival",
      meta: "05:45 AM | JED Airport -> Makkah Hotel",
      icon: "flight_land",
      isoDate: "2026-08-10",
      time: "05:45",
      from: "JED Airport",
      to: "Makkah Hotel",
      requiresBus: true,
    },
    {
      date: "12 Aug",
      year: "2026",
      category: "Activity",
      categoryKey: "activity",
      title: "Morning Activity",
      meta: "06:00 AM | Madinah",
      icon: "event",
      isoDate: "2026-08-12",
      time: "06:00",
      from: "Madinah Hotel",
      to: "Madinah",
      requiresBus: false,
    },
  ];

  const rows = buildVisaTrackingRowsFromGroups([group]);
  assertEqual(rows.length, 1);
  assertEqual(rows[0].departureIso, "2026-08-10");
  assertEqual(rows[0].returnIso, "2026-08-12");

  // Ensure aggregation does not mutate source order.
  assertEqual(group.itinerary[0].title, "Late Transfer");
}

async function testOverviewItineraryScenarioCoverage(): Promise<void> {
  const arrivalIso = getLocalIsoDateWithOffset(2);
  const makkahCityTourIso = getLocalIsoDateWithOffset(3);
  const transferIso = getLocalIsoDateWithOffset(4);
  const madinahCityTourIso = getLocalIsoDateWithOffset(5);
  const departureIso = getLocalIsoDateWithOffset(7);

  const createItineraryItem = ({
    isoDate,
    category,
    categoryKey,
    title,
    meta,
    icon,
    time,
    from,
    to,
    cityTourCity,
  }: {
    isoDate: string;
    category: string;
    categoryKey: string;
    title: string;
    meta: string;
    icon: string;
    time: string;
    from: string;
    to: string;
    cityTourCity?: string;
  }) => {
    const formattedDate = formatScheduleDate(isoDate);
    return {
      date: formattedDate.date,
      year: formattedDate.year,
      category,
      categoryKey,
      title,
      meta,
      icon,
      isoDate,
      time,
      from,
      to,
      cityTourCity: cityTourCity ?? "",
      requiresBus: true,
    };
  };

  const itineraryLibrary = {
    arrival: createItineraryItem({
      isoDate: arrivalIso,
      category: "Arrival",
      categoryKey: "arrival",
      title: "Arrival and transfer to Makkah hotel",
      meta: "07:15 | JED Airport -> Makkah Hotel",
      icon: "flight_land",
      time: "07:15",
      from: "JED Airport",
      to: "Makkah Hotel",
    }),
    transfer: createItineraryItem({
      isoDate: transferIso,
      category: "Transfer",
      categoryKey: "transfer",
      title: "Transfer from Makkah to Madinah",
      meta: "08:30 | Makkah Hotel -> Madinah Hotel",
      icon: "airport_shuttle",
      time: "08:30",
      from: "Makkah Hotel",
      to: "Madinah Hotel",
    }),
    departure: createItineraryItem({
      isoDate: departureIso,
      category: "Departure",
      categoryKey: "departure",
      title: "Departure to airport",
      meta: "21:45 | Madinah Hotel -> MED Airport",
      icon: "flight_takeoff",
      time: "21:45",
      from: "Madinah Hotel",
      to: "MED Airport",
    }),
    makkahCityTour: createItineraryItem({
      isoDate: makkahCityTourIso,
      category: "City Tour",
      categoryKey: "city-tour",
      title: "Makkah City Tour",
      meta: "09:00 | Makkah Hotel -> Masjidil Haram",
      icon: "tour",
      time: "09:00",
      from: "Makkah Hotel",
      to: "Masjidil Haram",
      cityTourCity: "Makkah",
    }),
    madinahCityTour: createItineraryItem({
      isoDate: madinahCityTourIso,
      category: "City Tour",
      categoryKey: "city-tour",
      title: "Madinah City Tour",
      meta: "09:30 | Madinah Hotel -> Masjid Nabawi",
      icon: "tour",
      time: "09:30",
      from: "Madinah Hotel",
      to: "Masjid Nabawi",
      cityTourCity: "Madinah",
    }),
  };

  const scenarioDefinitions: Array<{
    code: string;
    categories: Array<keyof typeof itineraryLibrary>;
    expectedDepartureIso: string;
    expectedReturnIso: string;
  }> = [
    {
      code: "OVR-ARR-ONLY",
      categories: ["arrival"],
      expectedDepartureIso: arrivalIso,
      expectedReturnIso: arrivalIso,
    },
    {
      code: "OVR-ARR-DEP",
      categories: ["arrival", "departure"],
      expectedDepartureIso: arrivalIso,
      expectedReturnIso: departureIso,
    },
    {
      code: "OVR-ARR-TRF-DEP",
      categories: ["arrival", "transfer", "departure"],
      expectedDepartureIso: arrivalIso,
      expectedReturnIso: departureIso,
    },
    {
      code: "OVR-FULL-TRIP",
      categories: ["arrival", "makkahCityTour", "transfer", "madinahCityTour", "departure"],
      expectedDepartureIso: arrivalIso,
      expectedReturnIso: departureIso,
    },
  ];

  const scenarioGroups: GroupData[] = scenarioDefinitions.map((scenario) => {
    const baseGroup = createSmokeGroup();
    const itinerary = scenario.categories.map((category) => itineraryLibrary[category]);
    const firstItineraryDate = formatScheduleDate(scenario.expectedDepartureIso);
    const lastItineraryDate = formatScheduleDate(scenario.expectedReturnIso);

    return {
      ...baseGroup,
      code: scenario.code,
      name: `Overview ${scenario.code}`,
      durationDays: Math.max(
        1,
        Math.floor(
          (Date.parse(`${scenario.expectedReturnIso}T00:00:00Z`) -
            Date.parse(`${scenario.expectedDepartureIso}T00:00:00Z`)) /
            86_400_000,
        ) + 1,
      ),
      arrivalDate: scenario.expectedDepartureIso,
      returnDate: scenario.expectedReturnIso,
      timeline: [
        {
          date: firstItineraryDate.date,
          title: "Timeline Start",
        },
        {
          date: lastItineraryDate.date,
          title: "Timeline End",
          isCurrent: true,
          nextActivity: "Overview scenario",
        },
      ],
      nextActivity: {
        title: itinerary[0].title,
        date: firstItineraryDate.date,
        time: itinerary[0].time ?? "",
        icon: itinerary[0].icon,
      },
      itinerary,
      visaSetup: undefined,
    };
  });

  const normalizedGroups = scenarioGroups.map((group) => normalizeGroupStatus(group));
  const rows = buildVisaTrackingRowsFromGroups(normalizedGroups);
  assertEqual(rows.length, scenarioDefinitions.length);

  const groupsByCode = new Map(normalizedGroups.map((group) => [group.code, group]));
  const rowsByCode = new Map(rows.map((row) => [row.groupCode, row]));

  for (const scenario of scenarioDefinitions) {
    const normalizedGroup = groupsByCode.get(scenario.code);
    const row = rowsByCode.get(scenario.code);

    assertTruthy(normalizedGroup, `Missing normalized group for ${scenario.code}`);
    assertTruthy(row, `Missing overview row for ${scenario.code}`);
    assertEqual(normalizedGroup?.itinerary.length ?? 0, scenario.categories.length);
    assertEqual(row?.departureIso, scenario.expectedDepartureIso);
    assertEqual(row?.returnIso, scenario.expectedReturnIso);
  }
}

async function testVisaAgreementHelpers(): Promise<void> {
  const group = createSmokeGroup();
  group.code = "SMK-889";
  group.durationDays = 9;
  group.visaSetup = {
    visaStatus: "Issued",
    issuedDate: "2026-08-10",
    syarikah: "Smoke Provider",
    paymentStatus: "Paid",
    busStatus: "Visa+",
    makkahHotels: [
      {
        id: "mak-1",
        hotelName: "Makkah Hotel",
        agreementNumber: "AG-MAK-CUSTOM",
        pax: 40,
        status: "Approved",
        stayStartIso: "2026-08-10",
        stayEndIso: "2026-08-12",
      },
    ],
    madinahHotels: [
      {
        id: "mad-1",
        hotelName: "Madinah Hotel",
        agreementNumber: "AG-MAD-CUSTOM",
        pax: 40,
        status: "Approved",
        stayStartIso: "2026-08-13",
        stayEndIso: "2026-08-16",
      },
    ],
    raudhahAppointments: [],
  };

  const row = {
    groupCode: group.code,
    departureIso: "2026-08-10",
    returnIso: "2026-08-16",
  };

  const range = resolveVisaAgreementDateRange(row, group.durationDays, group);
  assertEqual(range.makkahStartIso, "2026-08-10");
  assertEqual(range.makkahEndIso, "2026-08-12");
  assertEqual(range.madinahStartIso, "2026-08-13");
  assertEqual(range.madinahEndIso, "2026-08-16");

  assertEqual(resolveVisaAgreementNumber({ groupCode: group.code }, group, "makkah"), "AG-MAK-CUSTOM");
  assertEqual(resolveVisaAgreementNumber({ groupCode: group.code }, group, "madinah"), "AG-MAD-CUSTOM");

  const fallbackMakkahAgreement = resolveVisaAgreementNumber({ groupCode: "SMK-X9" }, undefined, "makkah");
  const fallbackMadinahAgreement = resolveVisaAgreementNumber({ groupCode: "SMK-X9" }, undefined, "madinah");
  assertEqual(fallbackMakkahAgreement, "Agreement pending");
  assertEqual(fallbackMadinahAgreement, "Agreement pending");
}

async function testItinerarySummaryHelpers(): Promise<void> {
  const items: InputItineraryItem[] = [
    {
      id: "smk-item-1",
      date: "2026-08-10",
      time: "05:45",
      category: "Arrival",
      categoryKey: "arrival",
      from: "JED Airport",
      to: "Makkah Hotel",
      cityTourCity: "",
      flightNumber: "SV-827",
      requiresBus: true,
      notes: "Airport handling confirmed",
      icon: "flight_land",
      transferByTrain: false,
      trainDepartureTime: "",
      destinationPickupTime: "",
      hotelPickupRequestTime: "",
    },
    {
      id: "smk-item-2",
      date: "2026-08-12",
      time: "18:30",
      category: "Transfer",
      categoryKey: "transfer",
      from: "Makkah",
      to: "Madinah",
      cityTourCity: "",
      flightNumber: "",
      requiresBus: true,
      notes: "Bus coordinator standby",
      icon: "swap_horiz",
      transferByTrain: false,
      trainDepartureTime: "",
      destinationPickupTime: "",
      hotelPickupRequestTime: "",
    },
  ];

  const summary = buildTimelineAndNextActivity(items);
  assertTruthy(summary);
  assertEqual(summary?.timeline.length, 2);
  assertEqual(summary?.timeline[1].isCurrent, true);
  assertEqual(summary?.nextActivity.icon, "flight_land");

  const singleSummary = buildTimelineAndNextActivity([items[0]], "2026-08-20");
  assertTruthy(singleSummary);
  assertEqual(singleSummary?.timeline[1].title, "Next activity to be confirmed");
  assertEqual(singleSummary?.timeline[1].nextActivity, "Awaiting operator update");
  assertEqual(singleSummary?.timeline[1].date, formatScheduleDate("2026-08-20").date);

  const notes = buildDefaultItineraryNotes(items);
  assertEqual(notes.length, 2);
  assertEqual(notes[0], "Airport handling confirmed");
  assertEqual(notes[1], "Bus coordinator standby");

  const fallbackNotes = buildDefaultItineraryNotes([
    { ...items[0], notes: "   " },
    { ...items[1], notes: "   " },
  ]);
  assertEqual(fallbackNotes.length, 1);
  assertEqual(fallbackNotes[0], "Itinerary drafted by operator and ready for operations review.");

  const durationDays = calculateItineraryDurationDays(items);
  assertEqual(durationDays, 3);
}

async function testEffectiveIdentityModeHelpers(): Promise<void> {
  const scheduleOnly = resolveEffectiveGroupIdentityState({
    sectionMode: "schedule-only",
    identityDraft: {
      groupCode: "DRAFT-001",
      groupName: "Draft Group",
      packageName: "Draft Package",
      pax: 45,
      totalBuses: 2,
      startDate: "2026-09-01",
      endDate: "2026-09-09",
      musyrifName: "Draft Musyrif",
      musyrifPhone: "0800",
    },
    itineraryPrefill: {
      startDate: "2026-08-01",
      endDate: "2026-08-09",
    },
    groupNumber: "LOCAL-001",
    groupName: "Local Group",
    packageType: "Local Package",
    paxCount: "40",
    totalBusRequired: "1",
    startDate: "2026-07-01",
    endDate: "2026-07-09",
    musyrifName: "Local Musyrif",
    musyrifPhone: "0700",
    busStatus: "Visa+",
  });

  assertEqual(scheduleOnly.isScheduleOnlyMode, true);
  assertEqual(scheduleOnly.isIdentityOnlyMode, false);
  assertEqual(scheduleOnly.effectiveGroupCode, "DRAFT-001");
  assertEqual(scheduleOnly.effectiveGroupName, "Draft Group");
  assertEqual(scheduleOnly.effectivePackageType, "Draft Package");
  assertEqual(scheduleOnly.effectivePaxCountValue, "45");
  assertEqual(scheduleOnly.effectiveTotalBusRequiredValue, "2");
  assertEqual(scheduleOnly.effectiveStartDate, "2026-09-01");
  assertEqual(scheduleOnly.effectiveEndDate, "2026-09-09");
  assertEqual(scheduleOnly.effectiveMusyrifName, "Draft Musyrif");
  assertEqual(scheduleOnly.effectiveMusyrifPhone, "0800");

  const scheduleOnlyWithPrefillFallback = resolveEffectiveGroupIdentityState({
    sectionMode: "schedule-only",
    identityDraft: {
      groupCode: "DRAFT-002",
    },
    itineraryPrefill: {
      startDate: "2026-10-10",
      endDate: "2026-10-16",
    },
    groupNumber: "LOCAL-002",
    groupName: "Local Group 2",
    packageType: "Local Package 2",
    paxCount: "30",
    totalBusRequired: "1",
    startDate: "2026-07-10",
    endDate: "2026-07-16",
    musyrifName: "Local 2",
    musyrifPhone: "0710",
    busStatus: "Visa+",
  });

  assertEqual(scheduleOnlyWithPrefillFallback.effectiveStartDate, "2026-10-10");
  assertEqual(scheduleOnlyWithPrefillFallback.effectiveEndDate, "2026-10-16");
  assertEqual(scheduleOnlyWithPrefillFallback.effectivePaxCountValue, "30");
  assertEqual(scheduleOnlyWithPrefillFallback.effectiveTotalBusRequiredValue, "1");

  const identityOnly = resolveEffectiveGroupIdentityState({
    sectionMode: "identity-only",
    identityDraft: {
      groupCode: "DRAFT-003",
      groupName: "Ignored Draft",
    },
    itineraryPrefill: null,
    groupNumber: "LOCAL-003",
    groupName: "Local Group 3",
    packageType: "Local Package 3",
    paxCount: "50",
    totalBusRequired: "2",
    startDate: "2026-11-01",
    endDate: "2026-11-09",
    musyrifName: "Local 3",
    musyrifPhone: "0720",
    busStatus: "Visa Only",
  });

  assertEqual(identityOnly.isIdentityOnlyMode, true);
  assertEqual(identityOnly.isScheduleOnlyMode, false);
  assertEqual(identityOnly.effectiveGroupCode, "LOCAL-003");
  assertEqual(identityOnly.effectiveGroupName, "Local Group 3");
}

async function testInputValidationHelpers(): Promise<void> {
  const baseForm: InputItineraryFormState = {
    date: "2026-09-01",
    time: "08:00",
    category: "arrival",
    hotelName: "Makkah Hotel",
    from: "JED Airport",
    to: "Makkah Hotel",
    cityTourCity: "",
    flightNumber: "SV-001",
    requiresBus: true,
    notes: "",
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };

  const readyState = buildInputItineraryValidationState({
    effectiveGroupCode: "G-READY",
    effectiveGroupName: "Ready Group",
    effectivePackageType: "Gold Package",
    effectivePaxCountValue: "80",
    effectiveTotalBusRequiredValue: "2",
    effectiveStartDate: "2026-09-01",
    effectiveEndDate: "2026-09-08",
    effectiveMusyrifName: "Musyrif Ready",
    effectiveMusyrifPhone: "0812",
    form: baseForm,
  });
  assertEqual(readyState.minimumBusCount, 2);
  assertEqual(readyState.isGroupReadyForItinerary, true);
  assertEqual(readyState.isFormDisabled, false);
  assertEqual(readyState.showFlightNumberField, true);

  const transferTrainState = buildInputItineraryValidationState({
    effectiveGroupCode: "G-TRAIN",
    effectiveGroupName: "Train Group",
    effectivePackageType: "Gold Package",
    effectivePaxCountValue: "30",
    effectiveTotalBusRequiredValue: "1",
    effectiveStartDate: "2026-09-01",
    effectiveEndDate: "2026-09-08",
    effectiveMusyrifName: "Musyrif Train",
    effectiveMusyrifPhone: "0813",
    form: {
      ...baseForm,
      category: "transfer",
      time: "09:00",
      transferByTrain: true,
      trainDepartureTime: "09:00",
      destinationPickupTime: "",
      from: "Makkah",
      to: "Madinah",
      flightNumber: "",
    },
  });
  assertEqual(transferTrainState.showTransferTrainFields, true);
  assertEqual(transferTrainState.isFormDisabled, true);

  const belowMinimumState = buildInputItineraryValidationState({
    effectiveGroupCode: "G-MIN",
    effectiveGroupName: "Min Group",
    effectivePackageType: "Silver Package",
    effectivePaxCountValue: "101",
    effectiveTotalBusRequiredValue: "2",
    effectiveStartDate: "2026-09-01",
    effectiveEndDate: "2026-09-08",
    effectiveMusyrifName: "Musyrif Min",
    effectiveMusyrifPhone: "0814",
    form: baseForm,
  });
  assertEqual(belowMinimumState.minimumBusCount, 3);
  assertEqual(belowMinimumState.isTotalBusBelowMinimum, true);
  assertEqual(belowMinimumState.isGroupReadyForItinerary, false);
}

async function testNewGroupPrefillFromAgreements(): Promise<void> {
  const prefill = buildAgreementItineraryPrefill(
    [
      {
        id: "mak-1",
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-MAK-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
    [
      {
        id: "mad-1",
        hotelName: "Pullman Zamzam Madinah",
        agreementNumber: "AG-MAD-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-13",
        stayEndIso: "2026-07-16",
      },
    ],
  );

  assertTruthy(prefill);
  assertEqual(prefill?.startDate, "2026-07-10");
  assertEqual(prefill?.endDate, "2026-07-16");
  assertEqual(prefill?.trips?.["base-arrival"]?.to, "Swissotel Al Maqam");
  assertEqual(prefill?.trips?.["base-transfer"]?.to, "Pullman Zamzam Madinah");
}

async function testNewGroupPrefillUsesFirstPopulatedAgreement(): Promise<void> {
  const prefill = buildAgreementItineraryPrefill(
    [
      {
        id: "mak-empty",
        hotelName: "",
        agreementNumber: "",
        pax: "",
        status: "Waiting for Approval",
        stayStartIso: "",
        stayEndIso: "",
      },
      {
        id: "mak-real",
        hotelName: "Makkah Skyline Hotel",
        agreementNumber: "AG-MAK-REAL",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-08-01",
        stayEndIso: "2026-08-03",
      },
    ],
    [
      {
        id: "mad-real",
        hotelName: "Madinah Noor Hotel",
        agreementNumber: "AG-MAD-REAL",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-08-03",
        stayEndIso: "2026-08-06",
      },
    ],
  );

  assertTruthy(prefill);
  assertEqual(prefill?.trips?.["base-arrival"]?.to, "Makkah Skyline Hotel");
  assertEqual(prefill?.trips?.["base-transfer"]?.to, "Madinah Noor Hotel");
}

async function testAgreementSaveValidation(): Promise<void> {
  const blankAgreementError = getAgreementSaveValidationError(
    [
      {
        id: "mak-blank",
        hotelName: "",
        agreementNumber: "",
        pax: "",
        status: "Waiting for Approval",
        stayStartIso: "",
        stayEndIso: "",
      },
    ],
    [
      {
        id: "mad-blank",
        hotelName: "",
        agreementNumber: "",
        pax: "",
        status: "Waiting for Approval",
        stayStartIso: "",
        stayEndIso: "",
      },
    ],
  );
  assertTruthy(blankAgreementError);

  const incompleteAgreementError = getAgreementSaveValidationError(
    [
      {
        id: "mak-incomplete",
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
    [],
  );
  assertEqual(incompleteAgreementError, "Makkah hotel 1: agreement number wajib diisi.");

  const disconnectedAgreementError = getAgreementSaveValidationError(
    [
      {
        id: "mak-disconnected",
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-MAK-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
    [
      {
        id: "mad-disconnected",
        hotelName: "Pullman Zamzam Madinah",
        agreementNumber: "AG-MAD-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-13",
        stayEndIso: "2026-07-16",
      },
    ],
  );
  assertTruthy(Boolean(disconnectedAgreementError));

  const connectedAgreementError = getAgreementSaveValidationError(
    [
      {
        id: "mak-connected",
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-MAK-2",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
    [
      {
        id: "mad-connected",
        hotelName: "Pullman Zamzam Madinah",
        agreementNumber: "AG-MAD-2",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-12",
        stayEndIso: "2026-07-16",
      },
    ],
  );
  assertEqual(connectedAgreementError, null);
}

async function testConnectedAgreementDateValidation(): Promise<void> {
  const multiMakkahConnectedToMadinah = validateConnectedAgreementDates(
    [
      {
        id: "mak-a",
        hotelName: "Makkah Hotel 1",
        agreementNumber: "AG-MAK-A",
        pax: "25",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
      {
        id: "mak-b",
        hotelName: "Makkah Hotel 2",
        agreementNumber: "AG-MAK-B",
        pax: "20",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-11",
      },
    ],
    [
      {
        id: "mad-a",
        hotelName: "Madinah Hotel 1",
        agreementNumber: "AG-MAD-A",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-11",
        stayEndIso: "2026-07-13",
      },
    ],
  );
  assertEqual(multiMakkahConnectedToMadinah.hasWarning, false);
  assertEqual(multiMakkahConnectedToMadinah.cityWarnings.makkah, null);
  assertEqual(multiMakkahConnectedToMadinah.cityWarnings.madinah, null);
  assertEqual(multiMakkahConnectedToMadinah.crossCityWarning, null);

  const splitPaxSameDateConnected = validateConnectedAgreementDates(
    [
      {
        id: "mak-split-1",
        hotelName: "Makkah Hotel Split 1",
        agreementNumber: "AG-MAK-SPLIT-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
      {
        id: "mak-split-2",
        hotelName: "Makkah Hotel Split 2",
        agreementNumber: "AG-MAK-SPLIT-2",
        pax: "5",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
    ],
    [
      {
        id: "mad-split-1",
        hotelName: "Madinah Hotel Split 1",
        agreementNumber: "AG-MAD-SPLIT-1",
        pax: "50",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
  );
  assertEqual(splitPaxSameDateConnected.hasWarning, false);
  assertEqual(splitPaxSameDateConnected.cityWarnings.makkah, null);
  assertEqual(splitPaxSameDateConnected.cityWarnings.madinah, null);
  assertEqual(splitPaxSameDateConnected.crossCityWarning, null);

  const makkahMadinahMakkahConnected = validateConnectedAgreementDates(
    [
      {
        id: "mak-mm-1",
        hotelName: "Makkah Hotel MM1",
        agreementNumber: "AG-MAK-MM1",
        pax: "20",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
      {
        id: "mak-mm-2",
        hotelName: "Makkah Hotel MM2",
        agreementNumber: "AG-MAK-MM2",
        pax: "25",
        status: "Approved",
        stayStartIso: "2026-07-12",
        stayEndIso: "2026-07-14",
      },
    ],
    [
      {
        id: "mad-mm-1",
        hotelName: "Madinah Hotel MM1",
        agreementNumber: "AG-MAD-MM1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
  );
  assertEqual(makkahMadinahMakkahConnected.hasWarning, false);
  assertEqual(makkahMadinahMakkahConnected.cityWarnings.makkah, null);
  assertEqual(makkahMadinahMakkahConnected.cityWarnings.madinah, null);
  assertEqual(makkahMadinahMakkahConnected.crossCityWarning, null);

  const madinahFirstConnectedToMakkah = validateConnectedAgreementDates(
    [
      {
        id: "mak-c",
        hotelName: "Makkah Hotel 3",
        agreementNumber: "AG-MAK-C",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-11",
        stayEndIso: "2026-07-13",
      },
    ],
    [
      {
        id: "mad-c",
        hotelName: "Madinah Hotel 3",
        agreementNumber: "AG-MAD-C",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-11",
      },
    ],
  );
  assertEqual(madinahFirstConnectedToMakkah.hasWarning, false);
  assertEqual(madinahFirstConnectedToMakkah.cityWarnings.makkah, null);
  assertEqual(madinahFirstConnectedToMakkah.cityWarnings.madinah, null);
  assertEqual(madinahFirstConnectedToMakkah.crossCityWarning, null);

  const connectedDates = validateConnectedAgreementDates(
    [
      {
        id: "mak-1",
        hotelName: "Makkah Hotel A",
        agreementNumber: "AG-MAK-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
    ],
    [
      {
        id: "mad-1",
        hotelName: "Madinah Hotel A",
        agreementNumber: "AG-MAD-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
  );
  assertEqual(connectedDates.hasWarning, false);
  assertEqual(connectedDates.crossCityWarning, null);
  assertEqual(connectedDates.cityWarnings.makkah, null);
  assertEqual(connectedDates.cityWarnings.madinah, null);

  const disconnectedCities = validateConnectedAgreementDates(
    [
      {
        id: "mak-2",
        hotelName: "Makkah Hotel B",
        agreementNumber: "AG-MAK-2",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
    ],
    [
      {
        id: "mad-2",
        hotelName: "Madinah Hotel B",
        agreementNumber: "AG-MAD-2",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-11",
        stayEndIso: "2026-07-12",
      },
    ],
  );
  assertEqual(disconnectedCities.hasWarning, true);
  assertTruthy(Boolean(disconnectedCities.crossCityWarning));

  const disconnectedMakkah = validateConnectedAgreementDates(
    [
      {
        id: "mak-3",
        hotelName: "Makkah Hotel C",
        agreementNumber: "AG-MAK-3",
        pax: "20",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
      {
        id: "mak-4",
        hotelName: "Makkah Hotel D",
        agreementNumber: "AG-MAK-4",
        pax: "25",
        status: "Approved",
        stayStartIso: "2026-07-11",
        stayEndIso: "2026-07-12",
      },
    ],
    [],
  );
  assertEqual(disconnectedMakkah.hasWarning, true);
  assertTruthy(Boolean(disconnectedMakkah.cityWarnings.makkah));

  const madinahFirstDisconnectedFromMakkah = validateConnectedAgreementDates(
    [
      {
        id: "mak-d",
        hotelName: "Makkah Hotel 4",
        agreementNumber: "AG-MAK-D",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-12",
        stayEndIso: "2026-07-14",
      },
    ],
    [
      {
        id: "mad-d",
        hotelName: "Madinah Hotel 4",
        agreementNumber: "AG-MAD-D",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
    ],
  );
  assertEqual(madinahFirstDisconnectedFromMakkah.hasWarning, true);
  assertTruthy(Boolean(madinahFirstDisconnectedFromMakkah.crossCityWarning));

  const makkahMadinahMakkahWithGap = validateConnectedAgreementDates(
    [
      {
        id: "mak-gap-1",
        hotelName: "Makkah Hotel Gap1",
        agreementNumber: "AG-MAK-GAP1",
        pax: "20",
        status: "Approved",
        stayStartIso: "2026-07-08",
        stayEndIso: "2026-07-10",
      },
      {
        id: "mak-gap-2",
        hotelName: "Makkah Hotel Gap2",
        agreementNumber: "AG-MAK-GAP2",
        pax: "25",
        status: "Approved",
        stayStartIso: "2026-07-13",
        stayEndIso: "2026-07-14",
      },
    ],
    [
      {
        id: "mad-gap-1",
        hotelName: "Madinah Hotel Gap1",
        agreementNumber: "AG-MAD-GAP1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
  );
  assertEqual(makkahMadinahMakkahWithGap.hasWarning, true);
  assertTruthy(
    Boolean(makkahMadinahMakkahWithGap.cityWarnings.makkah) || Boolean(makkahMadinahMakkahWithGap.crossCityWarning),
  );
}

async function testNewGroupPayloadBuild(): Promise<void> {
  const payload = buildNewGroupPayload({
    resolvedGroupCode: "SMK-NEW-01",
    resolvedGroupName: "Smoke New Group",
    safePax: 45,
    visaStatus: "Pending",
    syarikahName: "Smoke Syarikah",
    busStatus: "Visa+",
    paymentStatus: "Unpaid",
    makkahHotels: [
      {
        id: "mak-1",
        hotelName: "Swissotel Al Maqam",
        agreementNumber: "AG-MAK-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-10",
        stayEndIso: "2026-07-12",
      },
    ],
    madinahHotels: [
      {
        id: "mad-1",
        hotelName: "Pullman Zamzam Madinah",
        agreementNumber: "AG-MAD-1",
        pax: "45",
        status: "Approved",
        stayStartIso: "2026-07-13",
        stayEndIso: "2026-07-16",
      },
    ],
    raudhahDates: [
      {
        id: "rau-1",
        dateIso: "2026-07-14",
        status: "After",
      },
    ],
    itineraryDraft: {
      totalBuses: 2,
      packageName: "Smoke Draft Package",
      notes: ["Draft note"],
    },
  });

  assertEqual(payload.code, "SMK-NEW-01");
  assertEqual(payload.name, "Smoke New Group");
  assertEqual(payload.pax, 45);
  assertEqual(payload.totalBuses, 2);
  assertEqual(payload.packageName, "Smoke Draft Package");
  assertTruthy(payload.itinerary.length >= 3);
  assertTruthy((payload.visaSetup?.makkahHotels.length ?? 0) >= 1);
  assertTruthy((payload.visaSetup?.madinahHotels.length ?? 0) >= 1);
  assertEqual(payload.visaSetup?.visaStatus, "Pending");
}

describe("frontend smoke", () => {
  runCase("navigation metadata", testNavigationItems);
  runCase("checklist generation", testChecklistFlow);
  runCase("checklist H-1 window filtering", testChecklistWindowFiltering);
  runCase("visa tracking aggregation", testVisaFlow);
  runCase("visa tracking unsorted itinerary bounds", testVisaFlowUnsortedItineraryBounds);
  runCase("overview itinerary scenario coverage", testOverviewItineraryScenarioCoverage);
  runCase("visa agreement helper rules", testVisaAgreementHelpers);
  runCase("itinerary summary helper rules", testItinerarySummaryHelpers);
  runCase("effective identity mode helper rules", testEffectiveIdentityModeHelpers);
  runCase("input validation helper rules", testInputValidationHelpers);
  runCase("new group prefill builder", testNewGroupPrefillFromAgreements);
  runCase("new group prefill skips blank agreement cards", testNewGroupPrefillUsesFirstPopulatedAgreement);
  runCase("agreement save validation", testAgreementSaveValidation);
  runCase("connected agreement date validation", testConnectedAgreementDateValidation);
  runCase("new group payload builder", testNewGroupPayloadBuild);
});
