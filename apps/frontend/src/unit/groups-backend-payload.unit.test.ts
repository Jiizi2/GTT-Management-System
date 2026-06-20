import assert from "node:assert/strict";
import { describe } from "vitest";
import { mapVisaHotelEditFormToBackendPayload } from "../hooks/groups-backend-payload.js";
import { runCase } from "../test/run-case.js";

function testVisaHotelPayloadPreservesSourceDraftId(): void {
  const payload = mapVisaHotelEditFormToBackendPayload("makkah", {
    sourceDraftId: " draft-source-1 ",
    hotelName: " Swissotel ",
    agreementNumber: " AG-001 ",
    pax: "40",
    status: "Approved",
    stayStartIso: "2026-04-01",
    stayEndIso: "2026-04-05",
  });

  assert.equal(payload.city, "MAKKAH");
  assert.equal(payload.sourceDraftId, "draft-source-1");
  assert.equal(payload.hotelName, "Swissotel");
  assert.equal(payload.agreementNumber, "AG-001");
  assert.equal(payload.pax, 40);
  assert.equal(payload.status, "APPROVED");
}

describe("groups-backend-payload", () => {
  runCase("visa hotel payload preserves source draft id", testVisaHotelPayloadPreservesSourceDraftId);
});
