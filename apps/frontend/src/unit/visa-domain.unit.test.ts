import assert from "node:assert/strict";
import { describe } from "vitest";
import type { GroupAgreementHotel, GroupData, VisaTrackingRow } from "../shared/app-domain.js";
import {
  buildVisaAgreementNumber,
  formatVisaDateWithYear,
  formatVisaLongDate,
  formatVisaShortDate,
  generateWhatsappCopyText,
  getGroupAgreementHotelsByCity,
  hasMissingHotelAllocation,
  isIsoDateValue,
  isVisaRowActionRequired,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
  shiftIsoDate,
} from "../shared/visa-domain.js";
import { runCase } from "../test/run-case.js";

function createAgreementHotel(overrides: Partial<GroupAgreementHotel> = {}): GroupAgreementHotel {
  return {
    id: "hotel-1",
    hotelName: "Hotel Unit",
    agreementNumber: "AG-001",
    pax: 40,
    status: "Approved",
    stayStartIso: "2026-04-10",
    stayEndIso: "2026-04-12",
    ...overrides,
  };
}

function createGroupWithVisaHotels(args: {
  makkahHotels: GroupAgreementHotel[];
  madinahHotels: GroupAgreementHotel[];
}): GroupData {
  return {
    code: "UNIT-VISA",
    name: "Unit Visa Group",
    status: "Active",
    tone: "active",
    pax: 40,
    totalBuses: 1,
    packageName: "Unit Package",
    durationDays: 9,
    arrivalDate: "2026-04-10",
    returnDate: "2026-04-18",
    timeline: [
      { date: "10 Apr", title: "Arrival" },
      { date: "18 Apr", title: "Return" },
    ],
    nextActivity: {
      title: "Arrival",
      date: "10 Apr",
      time: "08:00",
      icon: "flight_land",
    },
    itinerary: [],
    notes: [],
    musyrif: {
      name: "Ust. Unit",
      phone: "081234",
      avatar: "https://example.com/avatar.png",
    },
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "2026-04-09",
      syarikah: "Provider Unit",
      paymentStatus: "Paid",
      makkahHotels: args.makkahHotels,
      madinahHotels: args.madinahHotels,
      raudhahAppointments: [],
    },
    checklistAssignments: [],
  };
}

function createVisaRow(overrides: Partial<VisaTrackingRow> = {}): VisaTrackingRow {
  return {
    id: "row-1",
    groupCode: "9017001001",
    groupName: "Row Unit",
    pax: 40,
    packageName: "Unit Package",
    issuedDateIso: "2026-04-09",
    departureIso: "2026-04-10",
    returnIso: "2026-04-18",
    visaStatus: "Issued",
    paymentStatus: "Paid",
    raudhahLabel: "Not Set",
    raudhahHint: "Appointment pending",
    raudhahTone: "muted",
    makkahVerified: 40,
    madinahVerified: 40,
    outstandingAmount: 0,
    ...overrides,
  };
}

function testShiftAndDateFormatters(): void {
  assert.equal(shiftIsoDate("", 2), "");
  assert.equal(shiftIsoDate("bad-date", 2), "bad-date");
  assert.equal(shiftIsoDate("2026-04-10", 2), "2026-04-12");

  assert.equal(formatVisaShortDate(""), "-");
  assert.equal(formatVisaShortDate("bad-date"), "bad-date");
  assert.equal(formatVisaShortDate("2026-04-10"), "10 Apr");

  assert.equal(formatVisaLongDate(""), "-");
  assert.equal(formatVisaLongDate("bad-date"), "bad-date");
  const longDate = formatVisaLongDate("2026-04-10");
  assert.equal(longDate.includes("2026"), true);
  assert.equal(longDate.toLowerCase().includes("april"), true);

  assert.equal(formatVisaDateWithYear(""), "-");
  assert.equal(formatVisaDateWithYear("bad-date"), "bad-date");
  assert.equal(formatVisaDateWithYear("2026-04-10"), "10 Apr 2026");
}

function testAgreementNumberIsoValidationAndCityHotelSelection(): void {
  assert.equal(buildVisaAgreementNumber("AB-123", "makkah"), "202600012365865716");
  assert.equal(buildVisaAgreementNumber("9017001001", "madinah"), "202600100177824519");

  assert.equal(isIsoDateValue("2026-04-10"), true);
  assert.equal(isIsoDateValue("2026-4-10"), false);
  assert.equal(isIsoDateValue("10-04-2026"), false);

  const makkahHotel = createAgreementHotel({
    id: "mak-1",
    agreementNumber: "  MAK-CUSTOM-001  ",
  });
  const madinahHotel = createAgreementHotel({
    id: "mad-1",
    agreementNumber: "MAD-CUSTOM-001",
  });
  const group = createGroupWithVisaHotels({
    makkahHotels: [makkahHotel],
    madinahHotels: [madinahHotel],
  });

  assert.deepEqual(getGroupAgreementHotelsByCity(undefined, "makkah"), []);
  assert.equal(getGroupAgreementHotelsByCity(group, "makkah")[0].id, "mak-1");
  assert.equal(getGroupAgreementHotelsByCity(group, "madinah")[0].id, "mad-1");

  const row = createVisaRow({
    groupCode: "9017001001",
  });
  assert.equal(resolveVisaAgreementNumber(row, group, "makkah"), "MAK-CUSTOM-001");
  assert.equal(
    resolveVisaAgreementNumber(
      row,
      createGroupWithVisaHotels({
        makkahHotels: [createAgreementHotel({ agreementNumber: "   " })],
        madinahHotels: [],
      }),
      "makkah",
    ),
    "Agreement pending",
  );
  assert.equal(resolveVisaAgreementNumber(row, undefined, "madinah"), "Agreement pending");
}

function testResolveVisaAgreementDateRangeFallbackAndCustomNormalization(): void {
  const collapsedFallback = resolveVisaAgreementDateRange(
    {
      departureIso: "2026-04-10",
      returnIso: "2026-04-10",
    },
    2,
  );
  assert.deepEqual(collapsedFallback, {
    makkahStartIso: "2026-04-10",
    makkahEndIso: "2026-04-10",
    madinahStartIso: "2026-04-10",
    madinahEndIso: "2026-04-10",
  });

  const returnBeforeDepartureFallback = resolveVisaAgreementDateRange(
    {
      departureIso: "2026-04-10",
      returnIso: "2026-04-09",
    },
    1,
  );
  assert.deepEqual(returnBeforeDepartureFallback, {
    makkahStartIso: "2026-04-10",
    makkahEndIso: "2026-04-11",
    madinahStartIso: "2026-04-12",
    madinahEndIso: "2026-04-16",
  });

  const customGroup = createGroupWithVisaHotels({
    makkahHotels: [
      createAgreementHotel({
        id: "mak-custom",
        stayStartIso: "2026-04-12",
        stayEndIso: "2026-04-11",
      }),
      createAgreementHotel({
        id: "mak-invalid",
        stayStartIso: "bad-date",
        stayEndIso: "also-bad",
      }),
    ],
    madinahHotels: [
      createAgreementHotel({
        id: "mad-custom",
        stayStartIso: "2026-04-20",
        stayEndIso: "2026-04-09",
      }),
    ],
  });
  const customRange = resolveVisaAgreementDateRange(
    {
      departureIso: "2026-04-10",
      returnIso: "2026-04-18",
    },
    9,
    customGroup,
  );
  assert.deepEqual(customRange, {
    makkahStartIso: "2026-04-12",
    makkahEndIso: "2026-04-12",
    madinahStartIso: "2026-04-20",
    madinahEndIso: "2026-04-20",
  });
}

function testProviderAndActionRequirementHelpers(): void {
  assert.equal(resolveVisaProvider("VIP Platinum"), "Al-Tayyar");
  assert.equal(resolveVisaProvider("Premium Gold"), "Al-Tayyar");
  assert.equal(resolveVisaProvider("Silver Package"), "Rawaf Mina");
  assert.equal(resolveVisaProvider("Regular Package"), "Nusuk Services");

  const healthyRow = createVisaRow();
  assert.equal(hasMissingHotelAllocation(healthyRow), false);
  assert.equal(isVisaRowActionRequired(healthyRow), false);

  const missingHotelRow = createVisaRow({
    makkahVerified: 39,
  });
  assert.equal(hasMissingHotelAllocation(missingHotelRow), true);
  assert.equal(isVisaRowActionRequired(missingHotelRow), false);

  const unpaidRow = createVisaRow({
    paymentStatus: "Partial",
  });
  assert.equal(isVisaRowActionRequired(unpaidRow), false);

  const draftRow = createVisaRow({
    visaStatus: "Draft",
  });
  assert.equal(isVisaRowActionRequired(draftRow), true);
}

function testGenerateWhatsappCopyText(): void {
  const group = createGroupWithVisaHotels({
    makkahHotels: [
      {
        id: "mak-1",
        hotelName: "Swissotel",
        agreementNumber: "18014399405337794",
        pax: 40,
        status: "Approved",
        stayStartIso: "2026-03-28",
        stayEndIso: "2026-03-31",
      },
    ],
    madinahHotels: [
      {
        id: "mad-1",
        hotelName: "Burj Almarjan",
        agreementNumber: "15762599591351269",
        pax: 40,
        status: "Approved",
        stayStartIso: "2026-03-23",
        stayEndIso: "2026-03-28",
      },
    ],
  });

  group.code = "902133273";
  group.pax = 5;
  group.visaSetup!.busStatus = undefined; // default to VISA ONLY
  group.itinerary = [
    {
      date: "22 Mar",
      year: "2026",
      category: "Arrival",
      title: "Landing JED",
      meta: "07:30 | QR1190",
      icon: "flight_land",
      flightNumber: "QR1190",
      isoDate: "2026-03-22",
      time: "07:30",
      from: "DOH",
      to: "JED",
    },
    {
      date: "14 Apr",
      year: "2026",
      category: "Departure",
      title: "Departure JED",
      meta: "12:55 | SV822",
      icon: "flight_takeoff",
      flightNumber: "SV822",
      isoDate: "2026-04-14",
      time: "12:55",
      from: "JED",
      to: "CGK",
    },
  ];

  const copiedText = generateWhatsappCopyText(group);
  
  assert.equal(copiedText.includes("NEED MOFA VISA ONLY GROUP CODE"), true);
  assert.equal(copiedText.includes("902133273 ( 05 ) PAX"), true);
  assert.equal(copiedText.includes("DOH - JED / QR1190 / 07.30 / 22 MAR 2026"), true);
  assert.equal(copiedText.includes("JED - CGK / SV822 / 12.55 / 14 APR 2026"), true);
  assert.equal(copiedText.includes("BRN MAKKAH\nSwissotel\n28/03/2026 - 31/03/2026\n18014399405337794"), true);
  assert.equal(copiedText.includes("BRN MADINAH\nBurj Almarjan\n23/03/2026 - 28/03/2026\n15762599591351269"), true);

  // Test with familyGroups
  const childGroup: GroupData = {
    ...group,
    code: "902133274",
    pax: 12,
  };
  const familyText = generateWhatsappCopyText(group, [group, childGroup]);
  assert.equal(familyText.includes("NEED MOFA VISA ONLY GROUP CODE"), true);
  assert.equal(familyText.includes("902133273 - 902133274 ( 17 ) PAX"), true);

  // Test with completely empty data (should yield placeholders)
  const emptyGroup: GroupData = {
    code: "",
    name: "",
    status: "",
    tone: "active",
    pax: 0,
    packageName: "",
    durationDays: 0,
    timeline: [{ date: "", title: "" }, { date: "", title: "" }],
    nextActivity: { title: "", date: "", time: "", icon: "" },
    itinerary: [],
    notes: [],
    musyrif: { name: "", phone: "", avatar: "" },
  };

  const emptyText = generateWhatsappCopyText(emptyGroup);
  assert.equal(emptyText.includes("NEED MOFA VISA ONLY GROUP CODE"), true);
  assert.equal(emptyText.includes("[GROUP_CODE] ( 00 ) PAX"), true);
  assert.equal(emptyText.includes("[DEP] - [ARR] / [FLIGHT_NO] / [FLIGHT_TIME] / [FLIGHT_DATE]"), true);
  assert.equal(emptyText.includes("BRN MAKKAH\n[HOTEL MAKKAH NAME]\n[START_DATE] - [END_DATE]\n[BRN_CODE]"), true);
  assert.equal(emptyText.includes("BRN MADINAH\n[HOTEL MADINAH NAME]\n[START_DATE] - [END_DATE]\n[BRN_CODE]"), true);
}

describe("visa-domain", () => {
  runCase("shift and formatter behavior", testShiftAndDateFormatters);
  runCase("agreement number and city helpers", testAgreementNumberIsoValidationAndCityHotelSelection);
  runCase(
    "agreement date range fallback and custom normalization",
    testResolveVisaAgreementDateRangeFallbackAndCustomNormalization,
  );
  runCase("provider and action requirement helpers", testProviderAndActionRequirementHelpers);
  runCase("generate whatsapp copy text template", testGenerateWhatsappCopyText);
});
