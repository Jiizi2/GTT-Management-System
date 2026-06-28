import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  mapVisaHotelEditFormToBackendPayload,
  mapGroupIdentityDraftToBackendPayload,
} from "../hooks/groups-backend-payload.js";
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

function testGroupIdentityDraftPayloadMapsBusStatus(): void {
  const payload1 = mapGroupIdentityDraftToBackendPayload({
    groupCode: "TEST-01",
    groupName: "Test Group",
    packageName: "Test Package",
    pax: 10,
    totalBuses: 1,
    arrivalDate: "2026-04-01",
    returnDate: "2026-04-10",
    durationDays: 10,
    busStatus: "Visa+",
  });
  assert.equal(payload1.busStatus, "VISA_PLUS");

  const payload2 = mapGroupIdentityDraftToBackendPayload({
    groupCode: "TEST-02",
    pax: 10,
    busStatus: "Visa Only",
  });
  assert.equal(payload2.busStatus, "VISA_ONLY");

  const payload3 = mapGroupIdentityDraftToBackendPayload({
    groupCode: "TEST-03",
    pax: 10,
    busStatus: undefined,
  });
  assert.equal(payload3.busStatus, undefined);
}

describe("groups-backend-payload", () => {
  runCase("visa hotel payload preserves source draft id", testVisaHotelPayloadPreservesSourceDraftId);
  runCase("group identity draft payload maps busStatus", testGroupIdentityDraftPayloadMapsBusStatus);
});
