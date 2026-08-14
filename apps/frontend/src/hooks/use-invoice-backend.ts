export type BackendInvoiceStatus = "Paid" | "Pending" | "Overdue" | "Cancelled" | "Partially Paid";
export type BackendDataSource = "memory" | "prisma";

import { fetchBackendParsed } from "../shared/api-client";
import { formatBackendRequestError } from "../shared/api-error";
import { clampMoney } from "../shared/money";

export type BackendInvoiceClient = {
  id: string;
  name: string;
  sortOrder: number;
  label: string;
  groupCode?: string;
  groupName?: string;
};

export type BackendInvoiceItem = {
  description: string;
  pax: number;
  currency: "IDR" | "USD" | "SAR";
  unitPrice: number;
  totalPrice: number;
  totalPriceIdr: number;
};

export type BackendInvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  agentId: string;
  agentName: string;
  clientName: string;
  clientLabel: string;
  clientInitials: string;
  groupCode?: string;
  groupName?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  discountIdr: number;
  status: BackendInvoiceStatus;
  monthKey: string;
  recipientName?: string;
  notes?: string;
  description?: string;
  items?: BackendInvoiceItem[];
  version?: number;
};

export type CreateBackendInvoicePayload = {
  agentId: string;
  clientId?: string;
  clientName?: string;
  groupCode?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr?: number;
  discountIdr?: number;
  status?: BackendInvoiceStatus;
  notes?: string;
  description?: string;
  recipientName?: string;
  items?: BackendInvoiceItem[];
  version?: number;
};

export type UpdateBackendInvoicePayload = {
  agentId?: string;
  clientId?: string;
  clientName?: string;
  groupCode?: string;
  issuedDateIso?: string;
  dueDateIso?: string;
  amount?: number;
  downPaymentIdr?: number;
  discountIdr?: number;
  status?: BackendInvoiceStatus;
  notes?: string;
  description?: string;
  recipientName?: string;
  items?: BackendInvoiceItem[];
  version?: number;
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
  agentId?: unknown;
  agentName?: unknown;
  clientName?: unknown;
  clientLabel?: unknown;
  clientInitials?: unknown;
  groupCode?: unknown;
  groupName?: unknown;
  issuedDateIso?: unknown;
  dueDateIso?: unknown;
  amount?: unknown;
  downPaymentIdr?: unknown;
  discountIdr?: unknown;
  status?: unknown;
  monthKey?: unknown;
  recipientName?: unknown;
  notes?: unknown;
  description?: unknown;
  items?: unknown;
  version?: unknown;
};

type BackendInvoiceItemRecord = {
  description?: unknown;
  pax?: unknown;
  currency?: unknown;
  unitPrice?: unknown;
  totalPrice?: unknown;
  totalPriceIdr?: unknown;
};

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

function mapInvoiceStatusForBackend(value: BackendInvoiceStatus): "PAID" | "PENDING" | "OVERDUE" | "CANCELLED" {
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

function mapBackendInvoiceItem(record: BackendInvoiceItemRecord): BackendInvoiceItem | null {
  const description = readString(record.description);
  const currency = readString(record.currency).toUpperCase();
  // pax is a head count, not money — it stays an integer.
  const pax = Math.max(0, Math.round(readNumber(record.pax, 0)));
  const unitPrice = clampMoney(readNumber(record.unitPrice, 0));
  const totalPrice = clampMoney(readNumber(record.totalPrice, pax * unitPrice));
  const totalPriceIdr = clampMoney(readNumber(record.totalPriceIdr, totalPrice));

  if (!description || (currency !== "IDR" && currency !== "USD" && currency !== "SAR") || pax <= 0 || unitPrice <= 0) {
    return null;
  }

  return {
    description,
    pax,
    currency,
    unitPrice,
    totalPrice,
    totalPriceIdr,
  };
}

function normalizeBackendInvoiceItems(items: BackendInvoiceItem[] | undefined): BackendInvoiceItem[] | undefined {
  if (!items) {
    return undefined;
  }

  return items
    .map((item) => mapBackendInvoiceItem(item as BackendInvoiceItemRecord))
    .filter((item): item is BackendInvoiceItem => item !== null);
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
  const monthKeyFromDueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateIso) ? dueDateIso.slice(0, 7) : "unknown";
  const status = mapBackendInvoiceStatus(record.status);
  const amount = clampMoney(readNumber(record.amount, 0));
  const rawDownPaymentIdr = clampMoney(readNumber(record.downPaymentIdr, 0));
  const downPaymentIdr = rawDownPaymentIdr > 0 ? Math.min(rawDownPaymentIdr, amount) : status === "Paid" ? amount : 0;
  const discountIdr = clampMoney(readNumber(record.discountIdr, 0));
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
    agentId: readString(record.agentId, "agent_gtt_direct"),
    agentName: readString(record.agentName, "GTT Direct"),
    clientName,
    clientLabel: readString(record.clientLabel, clientName),
    clientInitials: readString(record.clientInitials, defaultClientInitials || "NA"),
    groupCode: readOptionalString(record.groupCode),
    groupName: readOptionalString(record.groupName),
    issuedDateIso: readString(record.issuedDateIso),
    dueDateIso,
    amount,
    downPaymentIdr,
    discountIdr,
    status,
    monthKey: readString(record.monthKey, monthKeyFromDueDate),
    recipientName: readOptionalString(record.recipientName),
    notes: readOptionalString(record.notes),
    description: readOptionalString(record.description),
    items: Array.isArray(record.items)
      ? (record.items
          .map((item) => mapBackendInvoiceItem(item as BackendInvoiceItemRecord))
          .filter((item): item is BackendInvoiceItem => item !== null) ?? undefined)
      : undefined,
    version: record.version !== undefined ? readNumber(record.version) : undefined,
  };
}

export async function fetchInvoiceClientsFromBackend({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<BackendInvoiceClient[]> {
  const { response, payload, responseText } = await fetchBackendParsed("/invoices/clients", {
    method: "GET",
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, payload, responseText, "Backend invoice client fetch failed"),
    );
  }

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
  const { response, payload, responseText } = await fetchBackendParsed("/health", {
    method: "GET",
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Backend health check failed"));
  }

  return mapBackendDataSource((payload as { dataSource?: unknown } | null)?.dataSource);
}

export async function fetchInvoicesFromBackend({
  page,
  limit,
  signal,
}: {
  page?: number;
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<BackendInvoiceRow[] | { data: BackendInvoiceRow[]; total: number; page: number; limit: number; totalPages: number }> {
  console.log(`[${new Date().toISOString()}] GET invoices request start`);
  const getStartTime = performance.now();

  const queryParams = new URLSearchParams();
  if (page !== undefined) queryParams.set("page", String(page));
  if (limit !== undefined) queryParams.set("limit", String(limit));
  const queryString = queryParams.toString();
  const url = queryString ? `/invoices?${queryString}` : "/invoices";

  const { response, payload, responseText } = await fetchBackendParsed(url, {
    method: "GET",
    signal,
    cache: "no-store",
  });
  const duration = Math.round(performance.now() - getStartTime);

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Backend invoice fetch failed"));
  }

  if (page !== undefined || limit !== undefined) {
    const paginated = payload as { data?: unknown; total?: unknown; page?: unknown; limit?: unknown; totalPages?: unknown };
    const rows = Array.isArray(paginated.data)
      ? paginated.data
          .map((item) => mapBackendInvoice(item as BackendInvoiceRecord))
          .filter((item): item is BackendInvoiceRow => item !== null)
      : [];
    return {
      data: rows,
      total: typeof paginated.total === "number" ? paginated.total : 0,
      page: typeof paginated.page === "number" ? paginated.page : 1,
      limit: typeof paginated.limit === "number" ? paginated.limit : 20,
      totalPages: typeof paginated.totalPages === "number" ? paginated.totalPages : 1,
    };
  }

  if (!Array.isArray(payload)) {
    throw new Error("Backend invoice fetch failed: response is not an array.");
  }

  return payload
    .map((item) => mapBackendInvoice(item as BackendInvoiceRecord))
    .filter((item): item is BackendInvoiceRow => item !== null);
}

export async function createInvoiceInBackend(payload: CreateBackendInvoicePayload): Promise<BackendInvoiceRow> {
  const normalizedClientId = payload.clientId?.trim() ?? "";
  const normalizedClientName = payload.clientName?.trim() ?? "";
  if (!normalizedClientId && !normalizedClientName) {
    throw new Error("Backend invoice create failed: missing clientId or clientName.");
  }

  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed("/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      clientId: normalizedClientId || undefined,
      agentId: payload.agentId.trim(),
      clientName: normalizedClientName || undefined,
      groupCode: payload.groupCode?.trim() || undefined,
      issuedDate: payload.issuedDateIso.trim(),
      dueDate: payload.dueDateIso.trim(),
      amount: clampMoney(payload.amount),
      downPaymentIdr: payload.downPaymentIdr !== undefined ? clampMoney(payload.downPaymentIdr) : undefined,
      discountIdr: payload.discountIdr !== undefined ? clampMoney(payload.discountIdr) : undefined,
      status: payload.status ? mapInvoiceStatusForBackend(payload.status) : undefined,
      notes: payload.notes?.trim() || undefined,
      description: payload.description?.trim() || undefined,
      recipientName: payload.recipientName?.trim() || undefined,
      items: normalizeBackendInvoiceItems(payload.items),
    }),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Backend invoice create failed"),
    );
  }

  const created = mapBackendInvoice(responsePayload as BackendInvoiceRecord);
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
  if (payload.agentId !== undefined) requestBody.agentId = payload.agentId.trim();
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
    requestBody.amount = clampMoney(payload.amount);
  }
  if (payload.downPaymentIdr !== undefined) {
    requestBody.downPaymentIdr = clampMoney(payload.downPaymentIdr);
  }
  if (payload.discountIdr !== undefined) {
    requestBody.discountIdr = clampMoney(payload.discountIdr);
  }
  if (payload.status !== undefined) {
    requestBody.status = mapInvoiceStatusForBackend(payload.status);
  }
  if (payload.notes !== undefined) {
    requestBody.notes = payload.notes.trim();
  }
  if (payload.description !== undefined) {
    requestBody.description = payload.description.trim();
  }
  if (payload.recipientName !== undefined) {
    requestBody.recipientName = payload.recipientName.trim();
  }
  if (payload.items !== undefined) {
    requestBody.items = normalizeBackendInvoiceItems(payload.items);
  }
  if (payload.version !== undefined) {
    requestBody.version = payload.version;
  }

  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/invoices/${normalizedInvoiceId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Backend invoice update failed"),
    );
  }

  const updated = mapBackendInvoice(responsePayload as BackendInvoiceRecord);
  if (!updated) {
    throw new Error("Backend invoice update failed: invalid response payload.");
  }

  return updated;
}

export async function deleteInvoiceInBackend(invoiceId: string): Promise<void> {
  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    throw new Error("Backend invoice delete failed: missing invoice id.");
  }

  const { response, payload, responseText } = await fetchBackendParsed(`/invoices/${normalizedInvoiceId}`, {
    method: "DELETE",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, payload, responseText, "Backend invoice delete failed"),
    );
  }
}
