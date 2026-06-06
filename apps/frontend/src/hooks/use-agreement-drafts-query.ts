import { useQuery } from "@tanstack/react-query";
import type { AgreementApprovalStatus, HotelAgreementDraft, HotelAgreementDraftFormState } from "../shared/app-domain";
import { fetchBackendParsed } from "../shared/api-client";
import { formatBackendRequestError } from "../shared/api-error";
import { agreementDraftQueryKeys } from "../shared/query-keys";

export type AgreementDraftStatusFilter = "all" | "assigned" | "unassigned";

type BackendHotelAgreementDraftRecord = {
  id?: string;
  city?: string;
  agentName?: string | null;
  hotelName?: string;
  agreementNumber?: string;
  pax?: number;
  status?: string;
  stayStart?: string | Date;
  stayEnd?: string | Date;
  notes?: string | null;
  groupCode?: string | null;
  assignmentStatus?: string;
  assignedAt?: string | Date | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function toIsoDateTime(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return readString(value);
}

function mapBackendAgreementStatus(value: string | undefined): AgreementApprovalStatus {
  const upper = value?.trim().toUpperCase();
  if (upper === "APPROVED") {
    return "Approved";
  }
  if (upper === "REJECTED") {
    return "Rejected";
  }
  return "Waiting for Approval";
}

function mapAgreementStatusToBackend(status: AgreementApprovalStatus): "WAITING" | "APPROVED" | "REJECTED" {
  if (status === "Approved") {
    return "APPROVED";
  }
  if (status === "Rejected") {
    return "REJECTED";
  }
  return "WAITING";
}

function mapBackendDraft(record: BackendHotelAgreementDraftRecord): HotelAgreementDraft | null {
  const id = readString(record.id);
  if (!id) {
    return null;
  }

  const city = readString(record.city).toUpperCase() === "MADINAH" ? "madinah" : "makkah";
  const groupCode = readString(record.groupCode ?? "", "");
  const assignmentStatus =
    readString(record.assignmentStatus).toUpperCase() === "ASSIGNED" || groupCode ? "Assigned" : "Unassigned";

  return {
    id,
    city,
    agentName: readString(record.agentName ?? "", ""),
    hotelName: readString(record.hotelName),
    agreementNumber: readString(record.agreementNumber),
    pax: Math.max(1, readNumber(record.pax, 1)),
    status: mapBackendAgreementStatus(record.status),
    stayStartIso: toIsoDate(record.stayStart),
    stayEndIso: toIsoDate(record.stayEnd),
    notes: readString(record.notes ?? "", ""),
    groupCode: groupCode || undefined,
    assignmentStatus,
    assignedAtIso: toIsoDateTime(record.assignedAt) || undefined,
    createdAtIso: toIsoDateTime(record.createdAt),
    updatedAtIso: toIsoDateTime(record.updatedAt),
  };
}

function buildDraftPayload(form: HotelAgreementDraftFormState) {
  const parsedPax = Number.parseInt(form.pax, 10);
  return {
    city: form.city === "madinah" ? "MADINAH" : "MAKKAH",
    agentName: form.agentName.trim() || undefined,
    hotelName: form.hotelName.trim(),
    agreementNumber: form.agreementNumber.trim(),
    pax: Number.isFinite(parsedPax) ? parsedPax : 1,
    status: mapAgreementStatusToBackend(form.status),
    stayStart: form.stayStartIso.trim(),
    stayEnd: form.stayEndIso.trim(),
    notes: form.notes.trim() || undefined,
  };
}

export async function fetchAgreementDraftsFromBackend({
  signal,
  query,
  status,
}: {
  signal?: AbortSignal;
  query?: string;
  status?: AgreementDraftStatusFilter;
} = {}): Promise<HotelAgreementDraft[]> {
  const searchParams = new URLSearchParams();
  const normalizedQuery = query?.trim() ?? "";
  if (normalizedQuery) {
    searchParams.set("q", normalizedQuery);
  }
  if (status && status !== "all") {
    searchParams.set("status", status);
  }

  const endpoint =
    searchParams.size > 0 ? `/visa/agreement-drafts?${searchParams.toString()}` : "/visa/agreement-drafts";
  const { response, payload, responseText } = await fetchBackendParsed(endpoint, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Draft fetch failed"));
  }

  if (!Array.isArray(payload)) {
    throw new Error("Draft fetch failed: response is not an array.");
  }

  return payload
    .map((item) => mapBackendDraft(item as BackendHotelAgreementDraftRecord))
    .filter((item): item is HotelAgreementDraft => item !== null);
}

export async function saveAgreementDraftInBackend({
  draftId,
  draft,
}: {
  draftId?: string;
  draft: HotelAgreementDraftFormState;
}): Promise<HotelAgreementDraft> {
  const endpoint = draftId ? `/visa/agreement-drafts/${encodeURIComponent(draftId)}` : "/visa/agreement-drafts";
  const { response, payload, responseText } = await fetchBackendParsed(endpoint, {
    method: draftId ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildDraftPayload(draft)),
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Draft save failed"));
  }

  const mappedDraft = mapBackendDraft(payload as BackendHotelAgreementDraftRecord);
  if (!mappedDraft) {
    throw new Error("Draft save failed: response is not a draft record.");
  }

  return mappedDraft;
}

export async function deleteAgreementDraftInBackend(draftId: string): Promise<void> {
  const { response, payload, responseText } = await fetchBackendParsed(
    `/visa/agreement-drafts/${encodeURIComponent(draftId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Draft delete failed"));
  }
}

export async function assignAgreementDraftInBackend({
  draftId,
  groupCode,
}: {
  draftId: string;
  groupCode: string;
}): Promise<HotelAgreementDraft> {
  const { response, payload, responseText } = await fetchBackendParsed(
    `/visa/agreement-drafts/${encodeURIComponent(draftId)}/assign`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupCode: groupCode.trim().toUpperCase(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Draft assign failed"));
  }

  const mappedDraft = mapBackendDraft(payload as BackendHotelAgreementDraftRecord);
  if (!mappedDraft) {
    throw new Error("Draft assign failed: response is not a draft record.");
  }

  return mappedDraft;
}

export async function unassignAgreementDraftInBackend(draftId: string): Promise<HotelAgreementDraft> {
  const { response, payload, responseText } = await fetchBackendParsed(
    `/visa/agreement-drafts/${encodeURIComponent(draftId)}/unassign`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Draft unassign failed"));
  }

  const mappedDraft = mapBackendDraft(payload as BackendHotelAgreementDraftRecord);
  if (!mappedDraft) {
    throw new Error("Draft unassign failed: response is not a draft record.");
  }

  return mappedDraft;
}

export function useAgreementDraftsQuery(query: string, status: AgreementDraftStatusFilter, enabled = true) {
  const normalizedQuery = query.trim();
  return useQuery({
    queryKey: agreementDraftQueryKeys.list(normalizedQuery, status),
    queryFn: ({ signal }) =>
      fetchAgreementDraftsFromBackend({
        signal,
        query: normalizedQuery,
        status,
      }),
    enabled,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
