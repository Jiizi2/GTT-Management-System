export type BackendInvoiceStatus = "Paid" | "Pending" | "Overdue" | "Cancelled";
export type BackendDataSource = "memory" | "prisma";

import { clearAuthSession, getAuthAccessToken } from "../shared/auth-session";

export type BackendInvoiceClient = {
  id: string;
  name: string;
  sortOrder: number;
  label: string;
  groupCode?: string;
  groupName?: string;
};

export type BackendInvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientLabel: string;
  clientInitials: string;
  groupCode?: string;
  groupName?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  status: BackendInvoiceStatus;
  monthKey: string;
};

export type CreateBackendInvoicePayload = {
  clientId?: string;
  clientName?: string;
  groupCode?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  status?: BackendInvoiceStatus;
  notes?: string;
};

export type UpdateBackendInvoicePayload = {
  clientId?: string;
  clientName?: string;
  groupCode?: string;
  issuedDateIso?: string;
  dueDateIso?: string;
  amount?: number;
  status?: BackendInvoiceStatus;
  notes?: string;
};

type BackendInvoiceClientRecord = {
  id?: unknown;
  name?: unknown;
  sortOrder?: unknown;
  label?: unknown;
  groupCode?: unknown;
  groupName?: unknown;
};

type BackendInvoiceRecord = {
  id?: unknown;
  invoiceNumber?: unknown;
  clientId?: unknown;
  clientName?: unknown;
  clientLabel?: unknown;
  clientInitials?: unknown;
  groupCode?: unknown;
  groupName?: unknown;
  issuedDateIso?: unknown;
  dueDateIso?: unknown;
  amount?: unknown;
  status?: unknown;
  monthKey?: unknown;
};

function resolveBackendApiBaseUrl(): string {
  const customUrl = (globalThis as { __GTT_API_BASE_URL__?: string }).__GTT_API_BASE_URL__;
  if (customUrl?.trim()) {
    return customUrl.trim().replace(/\/+$/, "");
  }

  const hostname = globalThis.location?.hostname ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:3001/api";
  }

  return "/api";
}

function createAuthorizedHeaders(initialHeaders?: HeadersInit): Headers {
  const headers = new Headers(initialHeaders);
  const accessToken = getAuthAccessToken();
  if (accessToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

async function fetchBackend(endpoint: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(endpoint, {
    ...init,
    headers: createAuthorizedHeaders(init?.headers),
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
}

function mapBackendDataSource(value: unknown): BackendDataSource {
  const normalized = readString(value).toLowerCase();
  return normalized === "prisma" ? "prisma" : "memory";
}

function readString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readOptionalString(value: unknown): string | undefined {
  const parsed = readString(value, "");
  return parsed.length > 0 ? parsed : undefined;
}

function readNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function mapBackendInvoiceClient(record: BackendInvoiceClientRecord): BackendInvoiceClient | null {
  const id = readString(record.id);
  const name = readString(record.name);
  if (!id || !name) {
    return null;
  }

  const sortOrder = Math.max(1, Math.round(readNumber(record.sortOrder, 1)));
  const label = readString(record.label, `${String(sortOrder).padStart(2, "0")}. ${name}`);

  return {
    id,
    name,
    sortOrder,
    label,
    groupCode: readOptionalString(record.groupCode),
    groupName: readOptionalString(record.groupName),
  };
}

function mapBackendInvoiceStatus(value: unknown): BackendInvoiceStatus {
  const normalized = readString(value).toLowerCase();
  if (normalized === "cancelled") {
    return "Cancelled";
  }

  if (normalized === "paid") {
    return "Paid";
  }

  if (normalized === "overdue") {
    return "Overdue";
  }

  return "Pending";
}

function mapInvoiceStatusForBackend(
  value: BackendInvoiceStatus,
): "PAID" | "PENDING" | "OVERDUE" | "CANCELLED" {
  if (value === "Cancelled") {
    return "CANCELLED";
  }

  if (value === "Paid") {
    return "PAID";
  }

  if (value === "Overdue") {
    return "OVERDUE";
  }

  return "PENDING";
}

function mapBackendInvoice(record: BackendInvoiceRecord): BackendInvoiceRow | null {
  const id = readString(record.id);
  const invoiceNumber = readString(record.invoiceNumber);
  const clientId = readString(record.clientId);
  const clientName = readString(record.clientName);

  if (!id || !invoiceNumber || !clientId || !clientName) {
    return null;
  }

  const dueDateIso = readString(record.dueDateIso);
  const monthKeyFromDueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateIso)
    ? dueDateIso.slice(0, 7)
    : "unknown";
  const defaultClientInitials = clientName
    .split(/\s+/)
    .map((chunk) => chunk[0]?.toUpperCase())
    .filter((chunk): chunk is string => Boolean(chunk))
    .slice(0, 2)
    .join("");

  return {
    id,
    invoiceNumber,
    clientId,
    clientName,
    clientLabel: readString(record.clientLabel, clientName),
    clientInitials: readString(record.clientInitials, defaultClientInitials || "NA"),
    groupCode: readOptionalString(record.groupCode),
    groupName: readOptionalString(record.groupName),
    issuedDateIso: readString(record.issuedDateIso),
    dueDateIso,
    amount: Math.max(0, Math.round(readNumber(record.amount, 0))),
    status: mapBackendInvoiceStatus(record.status),
    monthKey: readString(record.monthKey, monthKeyFromDueDate),
  };
}

export async function fetchInvoiceClientsFromBackend({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<BackendInvoiceClient[]> {
  const response = await fetchBackend(`${resolveBackendApiBaseUrl()}/invoices/clients`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Backend invoice client fetch failed (${response.status}): ${errorMessage}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Backend invoice client fetch failed: response is not an array.");
  }

  return payload
    .map((item) => mapBackendInvoiceClient(item as BackendInvoiceClientRecord))
    .filter((item): item is BackendInvoiceClient => item !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function fetchInvoiceBackendDataSource({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<BackendDataSource> {
  const response = await fetchBackend(`${resolveBackendApiBaseUrl()}/health`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Backend health check failed (${response.status}): ${errorMessage}`);
  }

  const payload = (await response.json()) as { dataSource?: unknown };
  return mapBackendDataSource(payload.dataSource);
}

export async function fetchInvoicesFromBackend({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<BackendInvoiceRow[]> {
  const response = await fetchBackend(`${resolveBackendApiBaseUrl()}/invoices`, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Backend invoice fetch failed (${response.status}): ${errorMessage}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error("Backend invoice fetch failed: response is not an array.");
  }

  return payload
    .map((item) => mapBackendInvoice(item as BackendInvoiceRecord))
    .filter((item): item is BackendInvoiceRow => item !== null);
}

export async function createInvoiceInBackend(
  payload: CreateBackendInvoicePayload,
): Promise<BackendInvoiceRow> {
  const normalizedClientId = payload.clientId?.trim() ?? "";
  const normalizedClientName = payload.clientName?.trim() ?? "";
  if (!normalizedClientId && !normalizedClientName) {
    throw new Error("Backend invoice create failed: missing clientId or clientName.");
  }

  const response = await fetchBackend(`${resolveBackendApiBaseUrl()}/invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: normalizedClientId || undefined,
      clientName: normalizedClientName || undefined,
      groupCode: payload.groupCode?.trim() || undefined,
      issuedDate: payload.issuedDateIso.trim(),
      dueDate: payload.dueDateIso.trim(),
      amount: Math.max(0, Math.round(payload.amount)),
      status: payload.status ? mapInvoiceStatusForBackend(payload.status) : undefined,
      notes: payload.notes?.trim() || undefined,
    }),
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Backend invoice create failed (${response.status}): ${errorMessage}`);
  }

  const created = mapBackendInvoice((await response.json()) as BackendInvoiceRecord);
  if (!created) {
    throw new Error("Backend invoice create failed: invalid response payload.");
  }

  return created;
}

export async function updateInvoiceInBackend(
  invoiceId: string,
  payload: UpdateBackendInvoicePayload,
): Promise<BackendInvoiceRow> {
  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    throw new Error("Backend invoice update failed: missing invoice id.");
  }

  const requestBody: Record<string, unknown> = {};
  if (payload.clientId !== undefined) {
    requestBody.clientId = payload.clientId.trim();
  }
  if (payload.clientName !== undefined) {
    requestBody.clientName = payload.clientName.trim();
  }
  if (payload.groupCode !== undefined) {
    requestBody.groupCode = payload.groupCode.trim();
  }
  if (payload.issuedDateIso !== undefined) {
    requestBody.issuedDate = payload.issuedDateIso.trim();
  }
  if (payload.dueDateIso !== undefined) {
    requestBody.dueDate = payload.dueDateIso.trim();
  }
  if (payload.amount !== undefined) {
    requestBody.amount = Math.max(0, Math.round(payload.amount));
  }
  if (payload.status !== undefined) {
    requestBody.status = mapInvoiceStatusForBackend(payload.status);
  }
  if (payload.notes !== undefined) {
    requestBody.notes = payload.notes.trim();
  }

  const response = await fetchBackend(`${resolveBackendApiBaseUrl()}/invoices/${normalizedInvoiceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Backend invoice update failed (${response.status}): ${errorMessage}`);
  }

  const updated = mapBackendInvoice((await response.json()) as BackendInvoiceRecord);
  if (!updated) {
    throw new Error("Backend invoice update failed: invalid response payload.");
  }

  return updated;
}
