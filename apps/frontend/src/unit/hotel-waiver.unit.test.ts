import assert from "node:assert/strict";
import { describe } from "vitest";
import type { VisaTrackingRow } from "../shared/app-domain-types.js";
import { hasMissingHotelAllocation } from "../shared/visa-domain.js";
import { runCase } from "../test/run-case.js";

function makeRow(overrides: Partial<VisaTrackingRow>): VisaTrackingRow {
  return {
    id: "row",
    groupCode: "G1",
    groupName: "Group 1",
    pax: 40,
    packageName: "Reguler",
    issuedDateIso: "",
    departureIso: "2026-08-01",
    returnIso: "2026-08-10",
    visaStatus: "Pending",
    paymentStatus: "Unpaid",
    raudhahLabel: "Not Set",
    raudhahHint: "",
    raudhahTone: "muted",
    makkahVerified: 40,
    madinahVerified: 0,
    makkahHotelWaived: false,
    madinahHotelWaived: false,
    ...overrides,
  };
}

describe("hotel waiver", () => {
  runCase("flags a city whose verified pax is short of the group pax", () => {
    assert.equal(hasMissingHotelAllocation(makeRow({ madinahVerified: 0 })), true);
  });

  runCase("does not flag a short city once it is waived", () => {
    assert.equal(
      hasMissingHotelAllocation(makeRow({ madinahVerified: 0, madinahHotelWaived: true })),
      false,
    );
  });

  runCase("still flags the other city even when one city is waived", () => {
    assert.equal(
      hasMissingHotelAllocation(makeRow({ makkahVerified: 10, madinahVerified: 0, madinahHotelWaived: true })),
      true,
    );
  });

  runCase("is fully clear when both cities are covered or waived", () => {
    assert.equal(
      hasMissingHotelAllocation(makeRow({ makkahVerified: 40, madinahVerified: 0, madinahHotelWaived: true })),
      false,
    );
  });
});
