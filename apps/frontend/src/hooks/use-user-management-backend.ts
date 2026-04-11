import { resolveBackendApiBaseUrl } from "../shared/backend-api-base.js";
import { clearAuthSession } from "../shared/auth-session.js";

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
  hasPassword: boolean;
  updatedAt?: string;
};

export type UpdateManagedUserPayload = {
  name: string;
  email: string;
  roleId: BackendManagedUserRole;
};

export type CreateManagedUserPayload = UpdateManagedUserPayload & {
  password?: string;
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
  const hasPassword = record.hasPassword === true;
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt.trim() : "";

  if (!id || !name || !email) {
    return null;
  }

  return {
    id,
    name,
    email,
    roleId,
    hasPassword,
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

export async function createManagedUserInBackend(
  payload: CreateManagedUserPayload,
): Promise<BackendManagedUser> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/auth/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      roleId: payload.roleId,
      password: payload.password?.trim() ? payload.password.trim() : undefined,
    }),
  });
  const responsePayload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, responsePayload, ""));
  }

  const managedUser = mapManagedUser(responsePayload);
  if (!managedUser) {
    throw new Error("User create response is invalid.");
  }

  return managedUser;
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

export async function deleteManagedUserInBackend(userId: string): Promise<void> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/auth/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  const responsePayload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, responsePayload, ""));
  }
}

export async function setManagedUserPasswordInBackend(
  userId: string,
  password: string,
): Promise<BackendManagedUser> {
  const apiBaseUrl = resolveBackendApiBaseUrl();
  const response = await fetchBackend(`${apiBaseUrl}/auth/users/${encodeURIComponent(userId)}/password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: password.trim(),
    }),
  });
  const responsePayload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, responsePayload, ""));
  }

  const managedUser = mapManagedUser(responsePayload);
  if (!managedUser) {
    throw new Error("User password response is invalid.");
  }

  return managedUser;
}
