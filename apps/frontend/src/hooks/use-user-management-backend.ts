import { clearAuthSession, getAuthAccessToken } from "../shared/auth-session";

export type BackendManagedUserRole =
  | "super-admin"
  | "admin"
  | "finance-manager"
  | "customer-support";

export type BackendManagedUser = {
  id: string;
  name: string;
  email: string;
  roleId: BackendManagedUserRole;
  updatedAt?: string;
};

export type UpdateManagedUserPayload = {
  name: string;
  email: string;
  roleId: BackendManagedUserRole;
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

function resolveRoleId(value: unknown): BackendManagedUserRole {
  if (
    value === "super-admin" ||
    value === "admin" ||
    value === "finance-manager" ||
    value === "customer-support"
  ) {
    return value;
  }

  return "admin";
}

function mapManagedUser(value: unknown): BackendManagedUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
  const roleId = resolveRoleId(record.roleId);
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt.trim() : "";

  if (!id || !name || !email) {
    return null;
  }

  return {
    id,
    name,
    email,
    roleId,
    updatedAt: updatedAt || undefined,
  };
}

function extractBackendErrorMessage(status: number, payload: unknown, fallbackText: string): string {
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

  if (fallbackText.trim()) {
    return fallbackText.trim();
  }

  return `User management request failed (${status}).`;
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

export async function fetchManagedUsersFromBackend({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<BackendManagedUser[]> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/auth/users`, {
    method: "GET",
    signal,
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, payload, ""));
  }

  if (!Array.isArray(payload)) {
    throw new Error("User list response is invalid.");
  }

  return payload
    .map((item) => mapManagedUser(item))
    .filter((item): item is BackendManagedUser => item !== null);
}

export async function updateManagedUserInBackend(
  userId: string,
  payload: UpdateManagedUserPayload,
): Promise<BackendManagedUser> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/auth/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      roleId: payload.roleId,
    }),
  });
  const responsePayload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, responsePayload, ""));
  }

  const managedUser = mapManagedUser(responsePayload);
  if (!managedUser) {
    throw new Error("User update response is invalid.");
  }

  return managedUser;
}
