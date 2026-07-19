import {
  VisaApplicationAgreementStatus,
  VisaApplicationDocumentStatus,
  VisaApplicationNusukStatus,
  VisaApplicationPaymentStatus,
  VisaApplicationStatus,
  VisaApplicationVisaStatus,
} from "@prisma/client";

export type VisaApplicationFacets = {
  documentStatus: VisaApplicationDocumentStatus;
  agreementStatus: VisaApplicationAgreementStatus;
  nusukStatus: VisaApplicationNusukStatus;
  paymentStatus: VisaApplicationPaymentStatus;
  visaStatus: VisaApplicationVisaStatus;
};

export function deriveVisaApplicationStatus(value: VisaApplicationFacets): VisaApplicationStatus {
  if (value.visaStatus === VisaApplicationVisaStatus.COMPLETED) return VisaApplicationStatus.COMPLETED;
  if (value.visaStatus === VisaApplicationVisaStatus.ISSUED) return VisaApplicationStatus.VISA_ISSUED;
  if (value.visaStatus === VisaApplicationVisaStatus.PROCESSING) return VisaApplicationStatus.VISA_PROCESSING;
  if (value.paymentStatus === VisaApplicationPaymentStatus.COMPLETED) return VisaApplicationStatus.PAYMENT_COMPLETED;
  if (value.visaStatus === VisaApplicationVisaStatus.SUBMITTED) return VisaApplicationStatus.VISA_SUBMITTED;
  if (
    value.documentStatus === VisaApplicationDocumentStatus.VERIFIED &&
    value.agreementStatus === VisaApplicationAgreementStatus.APPROVED &&
    value.nusukStatus === VisaApplicationNusukStatus.GROUP_CREATED
  ) {
    return VisaApplicationStatus.READY_TO_SEND;
  }
  if (value.nusukStatus === VisaApplicationNusukStatus.GROUP_CREATED) return VisaApplicationStatus.GROUP_CREATED;
  if (value.nusukStatus === VisaApplicationNusukStatus.PASSENGER_ENTERED) {
    return VisaApplicationStatus.PASSENGER_ENTERED;
  }
  if (value.agreementStatus === VisaApplicationAgreementStatus.WAITING_APPROVAL) {
    return VisaApplicationStatus.WAITING_HOTEL_AGREEMENT;
  }
  if (value.documentStatus === VisaApplicationDocumentStatus.VERIFIED) {
    return VisaApplicationStatus.DOCUMENT_VERIFIED;
  }
  if (value.documentStatus === VisaApplicationDocumentStatus.NEED_REVISION) {
    return VisaApplicationStatus.NEED_REVISION;
  }
  return VisaApplicationStatus.WAITING_DOCUMENT;
}

export function hasReachedVisaSubmission(status: VisaApplicationVisaStatus): boolean {
  const submittedStatuses: readonly VisaApplicationVisaStatus[] = [
    VisaApplicationVisaStatus.SUBMITTED,
    VisaApplicationVisaStatus.PROCESSING,
    VisaApplicationVisaStatus.ISSUED,
    VisaApplicationVisaStatus.COMPLETED,
  ];
  return submittedStatuses.includes(status);
}
