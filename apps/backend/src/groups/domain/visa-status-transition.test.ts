import { describe, expect, it } from "vitest";
import { VisaStatus } from "@prisma/client";
import { resolveAgreementDrivenVisaStatus } from "./visa-status-transition";

describe("resolveAgreementDrivenVisaStatus", () => {
  it("moves DRAFT to PENDING once an agreement is present", () => {
    expect(resolveAgreementDrivenVisaStatus(VisaStatus.DRAFT, true)).toBe(VisaStatus.PENDING);
  });

  it("moves PENDING back to DRAFT when the last agreement is gone", () => {
    expect(resolveAgreementDrivenVisaStatus(VisaStatus.PENDING, false)).toBe(VisaStatus.DRAFT);
  });

  it("never auto-changes an ISSUED visa", () => {
    expect(resolveAgreementDrivenVisaStatus(VisaStatus.ISSUED, true)).toBe(VisaStatus.ISSUED);
    expect(resolveAgreementDrivenVisaStatus(VisaStatus.ISSUED, false)).toBe(VisaStatus.ISSUED);
  });

  it("leaves a status untouched when it already matches the agreement state", () => {
    expect(resolveAgreementDrivenVisaStatus(VisaStatus.PENDING, true)).toBe(VisaStatus.PENDING);
    expect(resolveAgreementDrivenVisaStatus(VisaStatus.DRAFT, false)).toBe(VisaStatus.DRAFT);
  });

  it("defaults a missing status to DRAFT and advances it when agreements exist", () => {
    expect(resolveAgreementDrivenVisaStatus(null, true)).toBe(VisaStatus.PENDING);
    expect(resolveAgreementDrivenVisaStatus(undefined, false)).toBe(VisaStatus.DRAFT);
  });
});
