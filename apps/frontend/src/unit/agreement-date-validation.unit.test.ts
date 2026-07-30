import assert from "node:assert/strict";
import { describe } from "vitest";
import { validateConnectedAgreementDates } from "../shared/agreement-date-validation.js";
import type { GroupAgreementHotel } from "../shared/app-domain.js";
import { runCase } from "../test/run-case.js";

/**
 * The rule itself has ~10 scenarios in the smoke suite, exercised against the
 * wizard's form shape. These cases pin the part that is new: the same rule now
 * runs against persisted GroupAgreementHotel records, which is what the live
 * agreement UI passes in.
 */
function createAgreement(overrides: Partial<GroupAgreementHotel> = {}): GroupAgreementHotel {
  return {
    id: "agr-1",
    hotelName: "Swissotel Al Maqam",
    agreementNumber: "AG-001",
    pax: 40,
    status: "Approved",
    stayStartIso: "2026-06-10",
    stayEndIso: "2026-06-13",
    ...overrides,
  };
}

describe("agreement-date-validation", () => {
  runCase("accepts contiguous Makkah to Madinah stays", async () => {
    const result = validateConnectedAgreementDates(
      [createAgreement({ id: "mak-1", stayStartIso: "2026-06-10", stayEndIso: "2026-06-13" })],
      [createAgreement({ id: "mad-1", stayStartIso: "2026-06-13", stayEndIso: "2026-06-17" })],
    );

    assert.equal(result.hasWarning, false);
    assert.equal(result.crossCityWarning, null);
    assert.equal(result.cityWarnings.makkah, null);
    assert.equal(result.cityWarnings.madinah, null);
  });

  runCase("warns when Madinah starts after Makkah ends", async () => {
    const result = validateConnectedAgreementDates(
      [createAgreement({ id: "mak-1", stayStartIso: "2026-06-10", stayEndIso: "2026-06-13" })],
      [createAgreement({ id: "mad-1", stayStartIso: "2026-06-15", stayEndIso: "2026-06-19" })],
    );

    assert.equal(result.hasWarning, true);
    assert.ok(result.crossCityWarning?.includes("2026-06-13"));
    assert.ok(result.crossCityWarning?.includes("2026-06-15"));
  });

  runCase("warns on a gap between two hotels in the same city", async () => {
    const result = validateConnectedAgreementDates(
      [
        createAgreement({ id: "mak-1", stayStartIso: "2026-06-10", stayEndIso: "2026-06-12" }),
        createAgreement({ id: "mak-2", stayStartIso: "2026-06-14", stayEndIso: "2026-06-16" }),
      ],
      [],
    );

    assert.equal(result.hasWarning, true);
    assert.ok(result.cityWarnings.makkah?.includes("Makkah"));
    assert.equal(result.cityWarnings.madinah, null);
  });

  runCase("stays silent when there is nothing to compare", async () => {
    assert.equal(validateConnectedAgreementDates([], []).hasWarning, false);
    assert.equal(validateConnectedAgreementDates([createAgreement()], []).hasWarning, false);
  });

  runCase("ignores agreements with missing or malformed dates", async () => {
    const result = validateConnectedAgreementDates(
      [
        createAgreement({ id: "mak-1", stayStartIso: "2026-06-10", stayEndIso: "2026-06-13" }),
        createAgreement({ id: "mak-2", stayStartIso: "", stayEndIso: "" }),
      ],
      [createAgreement({ id: "mad-1", stayStartIso: "2026-06-13", stayEndIso: "2026-06-17" })],
    );

    assert.equal(result.hasWarning, false);
  });

  runCase("treats split-pax hotels sharing one window as a single segment", async () => {
    const result = validateConnectedAgreementDates(
      [
        createAgreement({ id: "mak-1", pax: 20, stayStartIso: "2026-06-10", stayEndIso: "2026-06-13" }),
        createAgreement({ id: "mak-2", pax: 20, stayStartIso: "2026-06-10", stayEndIso: "2026-06-13" }),
      ],
      [createAgreement({ id: "mad-1", stayStartIso: "2026-06-13", stayEndIso: "2026-06-17" })],
    );

    assert.equal(result.hasWarning, false);
  });
});
