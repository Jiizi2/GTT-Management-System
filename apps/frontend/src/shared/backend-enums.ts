import type {
  AgreementApprovalStatus,
  BusStatus,
  ChecklistAssignmentStatus,
  GroupLifecycleStatus,
  GroupRaudhahStatus,
  GroupVisaSetup,
  VisaPaymentStatus,
  VisaStatus,
} from "./app-domain";

export type BackendAgreementApprovalStatus = "WAITING" | "APPROVED" | "REJECTED";
export type BackendChecklistAssignmentStatus = "NOT_COMPLETE" | "ASSIGNED";
export type BackendGroupLifecycleStatus = GroupLifecycleStatus;
export type BackendGroupTone = "ACTIVE" | "INACTIVE";
export type BackendRaudhahStatus = "FREE" | "AFTER" | "BEFORE";
export type BackendVisaBusStatus = "VISA_ONLY" | "VISA_PLUS";
export type BackendVisaPaymentStatus = "PAID" | "UNPAID" | "PARTIAL";
export type BackendVisaStatus = "DRAFT" | "PENDING" | "ISSUED";

export const backendGroupLifecycleStatuses = [
  "ENTRY_ONLY",
  "ACTIVE",
  "INACTIVE",
  "COMPLETED",
  "ARCHIVED",
] as const satisfies readonly BackendGroupLifecycleStatus[];

export function mapVisaStatusToBackend(status: VisaStatus): BackendVisaStatus {
  if (status === "Issued") {
    return "ISSUED";
  }

  if (status === "Pending") {
    return "PENDING";
  }

  return "DRAFT";
}

export function mapBackendVisaStatus(value: string | undefined): GroupVisaSetup["visaStatus"] {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "ISSUED") {
    return "Issued";
  }

  if (normalized === "PENDING") {
    return "Pending";
  }

  return "Draft";
}

export function mapPaymentStatusToBackend(status: VisaPaymentStatus): BackendVisaPaymentStatus {
  if (status === "Paid") {
    return "PAID";
  }

  if (status === "Partial") {
    return "PARTIAL";
  }

  return "UNPAID";
}

export function mapBackendPaymentStatus(value: string | undefined): GroupVisaSetup["paymentStatus"] {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "PAID") {
    return "Paid";
  }

  if (normalized === "PARTIAL") {
    return "Partial";
  }

  return "Unpaid";
}

export function mapBusStatusToBackend(status: BusStatus | undefined): BackendVisaBusStatus | undefined {
  if (status === "Visa+") {
    return "VISA_PLUS";
  }

  if (status === "Visa Only") {
    return "VISA_ONLY";
  }

  return undefined;
}

export function mapBackendBusStatus(value: string | null | undefined): GroupVisaSetup["busStatus"] {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "VISA_PLUS" || normalized === "VISA+" || normalized === "VISA PLUS") {
    return "Visa+";
  }

  if (normalized === "VISA_ONLY" || normalized === "VISA ONLY") {
    return "Visa Only";
  }

  return undefined;
}

export function mapAgreementStatusToBackend(status: AgreementApprovalStatus): BackendAgreementApprovalStatus {
  if (status === "Approved") {
    return "APPROVED";
  }

  if (status === "Rejected") {
    return "REJECTED";
  }

  return "WAITING";
}

export function mapBackendAgreementStatus(value: string | undefined): AgreementApprovalStatus {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "APPROVED") {
    return "Approved";
  }

  if (normalized === "REJECTED") {
    return "Rejected";
  }

  return "Waiting for Approval";
}

export function mapRaudhahStatusToBackend(status: GroupRaudhahStatus): BackendRaudhahStatus {
  if (status === "After") {
    return "AFTER";
  }

  if (status === "Before") {
    return "BEFORE";
  }

  return "FREE";
}

export function mapBackendRaudhahStatus(value: string | undefined): GroupRaudhahStatus {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized === "AFTER") {
    return "After";
  }

  if (normalized === "BEFORE") {
    return "Before";
  }

  return "Free";
}

export function mapChecklistStatusToBackend(status: ChecklistAssignmentStatus): BackendChecklistAssignmentStatus {
  return status === "Assigned" ? "ASSIGNED" : "NOT_COMPLETE";
}

export function mapBackendChecklistStatus(value: string | undefined): ChecklistAssignmentStatus {
  return value?.trim().toUpperCase() === "ASSIGNED" ? "Assigned" : "Not Complete";
}

export function mapBackendLifecycleStatusToLabel(value: unknown): string | undefined {
  if (value === "ENTRY_ONLY") {
    return "Entry Only";
  }
  if (value === "ACTIVE") {
    return "Active";
  }
  if (value === "INACTIVE") {
    return "In Active";
  }
  if (value === "COMPLETED") {
    return "Completed";
  }
  if (value === "ARCHIVED") {
    return "Archived";
  }

  return undefined;
}
