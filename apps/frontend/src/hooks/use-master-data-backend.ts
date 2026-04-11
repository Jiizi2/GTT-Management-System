import { resolveBackendApiBaseUrl } from "../shared/backend-api-base";
import { clearAuthSession } from "../shared/auth-session";

export type MasterDataCategoryKey =
  | "invoice-issuing-office"
  | "invoice-status"
  | "invoice-client-name"
  | "bank-disbursement"
  | "user-role"
  | "role-catalog"
  | "saudi-city";

export type MasterDataCategory = {
  key: MasterDataCategoryKey;
  label: string;
  description: string;
  totalOptions: number;
  activeOptions: number;
};

export type MasterDataOption = {
  id: string;
  categoryKey: MasterDataCategoryKey;
  value: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateMasterDataOptionPayload = {
  categoryKey: MasterDataCategoryKey;
  value?: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateMasterDataOptionPayload = {
  value?: string;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sortOrder?: number;
  isActive?: boolean;
};

async function fetchBackend(endpoint: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(endpoint, {
    ...init,
    credentials: "include",
    headers: new Headers(init?.headers),
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
}

function readString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
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

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function resolveCategoryKey(value: unknown): MasterDataCategoryKey | null {
  const normalized = readString(value).toLowerCase();
  switch (normalized) {
    case "invoice-issuing-office":
    case "invoice-status":
    case "invoice-client-name":
    case "bank-disbursement":
    case "user-role":
    case "role-catalog":
    case "saudi-city":
      return normalized;
    default:
      return null;
  }
}

function mapCategory(value: unknown): MasterDataCategory | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const key = resolveCategoryKey(record.key);
  if (!key) {
    return null;
  }

  return {
    key,
    label: readString(record.label, key),
    description: readString(record.description),
    totalOptions: Math.max(0, Math.round(readNumber(record.totalOptions, 0))),
    activeOptions: Math.max(0, Math.round(readNumber(record.activeOptions, 0))),
  };
}

function mapOption(value: unknown): MasterDataOption | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record.id);
  const categoryKey = resolveCategoryKey(record.categoryKey);
  const optionValue = readString(record.value);
  const label = readString(record.label);

  if (!id || !categoryKey || !optionValue || !label) {
    return null;
  }

  const metadata =
    record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
      ? (record.metadata as Record<string, unknown>)
      : undefined;

  return {
    id,
    categoryKey,
    value: optionValue,
    label,
    description: readString(record.description) || undefined,
    metadata,
    sortOrder: Math.max(1, Math.round(readNumber(record.sortOrder, 1))),
    isActive: readBoolean(record.isActive, true),
    createdAt: readString(record.createdAt),
    updatedAt: readString(record.updatedAt),
  };
}

async function parseResponseJson(response: Response): Promise<unknown> {
  const responseText = await response.text();
  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return responseText;
  }
}

function extractBackendErrorMessage(status: number, payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }

    if (Array.isArray(message)) {
      const firstText = message.find((entry) => typeof entry === "string" && entry.trim());
      if (typeof firstText === "string" && firstText.trim()) {
        return firstText.trim();
      }
    }
  }

  if (fallback.trim()) {
    return fallback.trim();
  }

  return `Master data request failed (${status}).`;
}

export async function fetchMasterDataCategoriesFromBackend({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<MasterDataCategory[]> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/master-data/categories`, {
    method: "GET",
    signal,
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, payload, ""));
  }

  if (!Array.isArray(payload)) {
    throw new Error("Master data categories response is invalid.");
  }

  return payload
    .map((item) => mapCategory(item))
    .filter((item): item is MasterDataCategory => item !== null);
}

export async function fetchMasterDataOptionsFromBackend({
  categoryKey,
  includeInactive,
  signal,
}: {
  categoryKey: MasterDataCategoryKey;
  includeInactive?: boolean;
  signal?: AbortSignal;
}): Promise<MasterDataOption[]> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const query = new URLSearchParams({ categoryKey });
  if (includeInactive) {
    query.set("includeInactive", "true");
  }

  const response = await fetchBackend(`${apiBaseUrl}/master-data/options?${query.toString()}`, {
    method: "GET",
    signal,
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, payload, ""));
  }

  if (!Array.isArray(payload)) {
    throw new Error("Master data options response is invalid.");
  }

  return payload
    .map((item) => mapOption(item))
    .filter((item): item is MasterDataOption => item !== null)
    .sort((left, right) => {
      const sortOrderDiff = left.sortOrder - right.sortOrder;
      if (sortOrderDiff !== 0) {
        return sortOrderDiff;
      }

      return left.label.localeCompare(right.label);
    });
}

export async function createMasterDataOptionInBackend(
  payload: CreateMasterDataOptionPayload,
): Promise<MasterDataOption> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/master-data/options`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const responsePayload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, responsePayload, ""));
  }

  const mappedOption = mapOption(responsePayload);
  if (!mappedOption) {
    throw new Error("Master data create response is invalid.");
  }

  return mappedOption;
}

export async function updateMasterDataOptionInBackend(
  optionId: string,
  payload: UpdateMasterDataOptionPayload,
): Promise<MasterDataOption> {
  const normalizedOptionId = optionId.trim();
  if (!normalizedOptionId) {
    throw new Error("Master data update failed: option id is required.");
  }

  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/master-data/options/${encodeURIComponent(normalizedOptionId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const responsePayload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, responsePayload, ""));
  }

  const mappedOption = mapOption(responsePayload);
  if (!mappedOption) {
    throw new Error("Master data update response is invalid.");
  }

  return mappedOption;
}
