import { VisaStatus } from "@prisma/client";

/**
 * Auto-advances a group's Ops visa status based on whether it has any hotel
 * agreement assigned, so the team does not have to flip the status by hand.
 *
 * Rules (agreed with ops):
 * - The final ISSUED step stays manual — never auto-changed here.
 * - First agreement of any city moves DRAFT → PENDING ("Diproses").
 * - Removing the last agreement moves PENDING back to DRAFT.
 * - A manually chosen status is otherwise left untouched.
 */
export function resolveAgreementDrivenVisaStatus(
  current: VisaStatus | null | undefined,
  hasAgreement: boolean,
): VisaStatus {
  const status = current ?? VisaStatus.DRAFT;
  if (status === VisaStatus.ISSUED) {
    return status;
  }
  if (hasAgreement && status === VisaStatus.DRAFT) {
    return VisaStatus.PENDING;
  }
  if (!hasAgreement && status === VisaStatus.PENDING) {
    return VisaStatus.DRAFT;
  }
  return status;
}
