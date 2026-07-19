import assert from "node:assert/strict";
import { describe } from "vitest";
import type { GroupData, VisaTrackingRow } from "../shared/app-domain-types.js";
import {
  buildVisaTrackingRowsFromGroups,
  calculateIssuedVisaStatistics,
} from "../shared/group-visa-domain.js";
import { runCase } from "../test/run-case.js";

function visaRow(overrides: Partial<VisaTrackingRow>): VisaTrackingRow {
  return {
    id: "visa-row",
    groupCode: "490000001",
    groupName: "Test Group",
    pax: 10,
    packageName: "Visa Only",
    issuedDateIso: "",
    departureIso: "2026-08-01",
    returnIso: "2026-08-10",
    visaStatus: "Draft",
    paymentStatus: "Unpaid",
    raudhahLabel: "Not Set",
    raudhahHint: "Appointment pending",
    raudhahTone: "muted",
    makkahVerified: 0,
    madinahVerified: 0,
    ...overrides,
  };
}

function issuedGroupWithoutDate(): GroupData {
  return {
    code: "490000009",
    name: "Issued Without Date",
    status: "ACTIVE",
    tone: "active",
    pax: 12,
    packageName: "Visa Only",
    durationDays: 10,
    arrivalDate: "2026-08-20",
    returnDate: "2026-08-29",
    timeline: [{ date: "-", title: "-" }, { date: "-", title: "-" }],
    nextActivity: { title: "-", date: "-", time: "-", icon: "schedule" },
    itinerary: [],
    notes: [],
    musyrif: { name: "-", phone: "-", avatar: "" },
    visaSetup: {
      visaStatus: "Issued",
      issuedDate: "",
      syarikah: "Provider",
      paymentStatus: "Paid",
      makkahHotels: [],
      madinahHotels: [],
      raudhahAppointments: [],
    },
  };
}

describe("issued visa statistics", () => {
  runCase("calculates selected month and overall totals from issuedDate", () => {
    const statistics = calculateIssuedVisaStatistics(
      [
        visaRow({ id: "jul-1", pax: 10, visaStatus: "Issued", issuedDateIso: "2026-07-05" }),
        visaRow({ id: "jul-2", pax: 15, visaStatus: "Issued", issuedDateIso: "2026-07-22" }),
        visaRow({ id: "aug", pax: 20, visaStatus: "Issued", issuedDateIso: "2026-08-02" }),
        visaRow({ id: "missing", pax: 7, visaStatus: "Issued", issuedDateIso: "" }),
        visaRow({ id: "pending", pax: 30, visaStatus: "Pending", issuedDateIso: "2026-07-09" }),
      ],
      "2026-07",
    );

    assert.deepEqual(statistics, {
      selectedMonthPax: 25,
      selectedMonthGroups: 2,
      overallPax: 52,
      overallGroups: 4,
      missingIssuedDateGroups: 1,
    });
  });

  runCase("does not replace a missing issuedDate with the departure date", () => {
    const [row] = buildVisaTrackingRowsFromGroups([issuedGroupWithoutDate()], {
      getItineraryIsoDate: (item) => item.isoDate ?? "",
      parseTimeForInput: (value) => value,
      getLocalIsoDateWithOffset: () => "2026-08-20",
      resolveValidRaudhahAppointments: () => [],
    });

    assert.equal(row.visaStatus, "Issued");
    assert.equal(row.departureIso, "2026-08-20");
    assert.equal(row.issuedDateIso, "");
  });

  runCase("includes every issued record when all months is selected", () => {
    const statistics = calculateIssuedVisaStatistics(
      [
        visaRow({ id: "dated", pax: 10, visaStatus: "Issued", issuedDateIso: "2026-07-05" }),
        visaRow({ id: "missing", pax: 7, visaStatus: "Issued", issuedDateIso: "" }),
        visaRow({ id: "pending", pax: 30, visaStatus: "Pending", issuedDateIso: "" }),
      ],
      "all",
    );

    assert.equal(statistics.selectedMonthPax, 17);
    assert.equal(statistics.selectedMonthGroups, 2);
  });
});
