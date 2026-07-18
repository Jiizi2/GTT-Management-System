import { describe, expect, it } from "vitest";
import type { VisaApplication } from "../agent/data/contracts";
import { buildWorkflow, getBlockingIssue, getCurrentStepLabels } from "../agent/pages/visa-applications-page";

function application(overrides: Partial<VisaApplication> = {}): VisaApplication {
  return {
    id: "visa-1",
    applicationNumber: "AA-240701",
    departureDate: "2026-07-20T00:00:00.000Z",
    returnDate: "2026-07-30T00:00:00.000Z",
    departureCity: "Jakarta",
    providerName: null,
    packageName: "Umrah July",
    passengerCount: 30,
    status: "WAITING_DOCUMENT",
    documentStatus: "WAITING_DOCUMENT",
    agreementStatus: "NOT_STARTED",
    nusukStatus: "NOT_STARTED",
    paymentStatus: "NOT_STARTED",
    visaStatus: "NOT_STARTED",
    nusukGroupNumber: null,
    nusukReferenceNumber: null,
    adminNote: null,
    submittedAt: null,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
    agent: { code: "AA", name: "Agent A" },
    documents: [],
    ...overrides,
  };
}

describe("Agent Visa Process workflow resolver", () => {
  it("does not treat unknown initial data as completed", () => {
    const value = application();
    const steps = buildWorkflow(value);
    expect(steps.filter((step) => step.completed)).toHaveLength(0);
    expect(getCurrentStepLabels(steps)).toEqual(["Passport Received"]);
    expect(getBlockingIssue(value)?.responsible).toBe("Agent & Visa Team");
  });

  it("shows Nusuk and Hotel Agreement as parallel current steps", () => {
    const steps = buildWorkflow(
      application({
        status: "DOCUMENT_VERIFIED",
        documentStatus: "VERIFIED",
        agreementStatus: "WAITING_APPROVAL",
        nusukStatus: "PASSENGER_ENTRY",
      }),
    );
    expect(getCurrentStepLabels(steps)).toEqual(["Nusuk Entry", "Hotel Agreement"]);
  });

  it("resolves a completed workflow consistently", () => {
    const value = application({
      status: "COMPLETED",
      documentStatus: "VERIFIED",
      agreementStatus: "APPROVED",
      nusukStatus: "GROUP_CREATED",
      paymentStatus: "COMPLETED",
      visaStatus: "COMPLETED",
    });
    const steps = buildWorkflow(value);
    expect(steps.every((step) => step.completed)).toBe(true);
    expect(getCurrentStepLabels(steps)).toEqual([]);
    expect(getBlockingIssue(value)).toBeNull();
  });
});
