import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  mapAgreementStatusToBackend,
  mapBackendAgreementStatus,
  mapBackendBusStatus,
  mapBackendChecklistStatus,
  mapBackendLifecycleStatusToLabel,
  mapBackendPaymentStatus,
  mapBackendRaudhahStatus,
  mapBackendVisaStatus,
  mapBusStatusToBackend,
  mapChecklistStatusToBackend,
  mapPaymentStatusToBackend,
  mapRaudhahStatusToBackend,
  mapVisaStatusToBackend,
} from "../shared/backend-enums.js";
import { runCase } from "../test/run-case.js";

function testVisaAndPaymentStatusRoundTrips(): void {
  assert.equal(mapVisaStatusToBackend("Draft"), "DRAFT");
  assert.equal(mapVisaStatusToBackend("Pending"), "PENDING");
  assert.equal(mapVisaStatusToBackend("Issued"), "ISSUED");
  assert.equal(mapBackendVisaStatus("DRAFT"), "Draft");
  assert.equal(mapBackendVisaStatus("PENDING"), "Pending");
  assert.equal(mapBackendVisaStatus("ISSUED"), "Issued");

  assert.equal(mapPaymentStatusToBackend("Unpaid"), "UNPAID");
  assert.equal(mapPaymentStatusToBackend("Partial"), "PARTIAL");
  assert.equal(mapPaymentStatusToBackend("Paid"), "PAID");
  assert.equal(mapBackendPaymentStatus("UNPAID"), "Unpaid");
  assert.equal(mapBackendPaymentStatus("PARTIAL"), "Partial");
  assert.equal(mapBackendPaymentStatus("PAID"), "Paid");
}

function testAgreementStatusRoundTripsIncludingRejected(): void {
  assert.equal(mapAgreementStatusToBackend("Waiting for Approval"), "WAITING");
  assert.equal(mapAgreementStatusToBackend("Approved"), "APPROVED");
  assert.equal(mapAgreementStatusToBackend("Rejected"), "REJECTED");
  assert.equal(mapBackendAgreementStatus("WAITING"), "Waiting for Approval");
  assert.equal(mapBackendAgreementStatus("APPROVED"), "Approved");
  assert.equal(mapBackendAgreementStatus("REJECTED"), "Rejected");
}

function testBusRaudhahAndChecklistStatusRoundTrips(): void {
  assert.equal(mapBusStatusToBackend("Visa Only"), "VISA_ONLY");
  assert.equal(mapBusStatusToBackend("Visa+"), "VISA_PLUS");
  assert.equal(mapBusStatusToBackend(undefined), undefined);
  assert.equal(mapBackendBusStatus("VISA_ONLY"), "Visa Only");
  assert.equal(mapBackendBusStatus("VISA_PLUS"), "Visa+");

  assert.equal(mapRaudhahStatusToBackend("Free"), "FREE");
  assert.equal(mapRaudhahStatusToBackend("After"), "AFTER");
  assert.equal(mapRaudhahStatusToBackend("Before"), "BEFORE");
  assert.equal(mapBackendRaudhahStatus("FREE"), "Free");
  assert.equal(mapBackendRaudhahStatus("AFTER"), "After");
  assert.equal(mapBackendRaudhahStatus("BEFORE"), "Before");

  assert.equal(mapChecklistStatusToBackend("Not Complete"), "NOT_COMPLETE");
  assert.equal(mapChecklistStatusToBackend("Assigned"), "ASSIGNED");
  assert.equal(mapBackendChecklistStatus("NOT_COMPLETE"), "Not Complete");
  assert.equal(mapBackendChecklistStatus("ASSIGNED"), "Assigned");
}

function testLifecycleStatusLabels(): void {
  assert.equal(mapBackendLifecycleStatusToLabel("ENTRY_ONLY"), "Entry Only");
  assert.equal(mapBackendLifecycleStatusToLabel("ACTIVE"), "Active");
  assert.equal(mapBackendLifecycleStatusToLabel("INACTIVE"), "In Active");
  assert.equal(mapBackendLifecycleStatusToLabel("COMPLETED"), "Completed");
  assert.equal(mapBackendLifecycleStatusToLabel("ARCHIVED"), "Archived");
  assert.equal(mapBackendLifecycleStatusToLabel("UNKNOWN"), undefined);
}

describe("backend enum mappings", () => {
  runCase("visa and payment status round trips", testVisaAndPaymentStatusRoundTrips);
  runCase("agreement status round trips including rejected", testAgreementStatusRoundTripsIncludingRejected);
  runCase("bus raudhah and checklist status round trips", testBusRaudhahAndChecklistStatusRoundTrips);
  runCase("lifecycle status labels", testLifecycleStatusLabels);
});
