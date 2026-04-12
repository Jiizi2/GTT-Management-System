import { fetchBackendParsed } from "../shared/api-client.js";
import { extractBackendErrorMessage } from "../shared/api-error.js";

export type BackendManagedUserRole = "super-admin" | "admin" | "finance-manager" | "customer-support";

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

function resolveRoleId(value: unknown): BackendManagedUserRole {
  if (value === "super-admin" || value === "admin" || value === "finance-manager" || value === "customer-support") {
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

export async function fetchManagedUsersFromBackend({
  signal,
}: {
  signal?: AbortSignal;
} = {}): Promise<BackendManagedUser[]> {
  const { response, payload, responseText } = await fetchBackendParsed("/auth/users", {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(
      extractBackendErrorMessage(response.status, payload, responseText, "User management request failed"),
    );
  }

  if (!Array.isArray(payload)) {
    throw new Error("User list response is invalid.");
  }

  return payload.map((item) => mapManagedUser(item)).filter((item): item is BackendManagedUser => item !== null);
}

export async function createManagedUserInBackend(payload: CreateManagedUserPayload): Promise<BackendManagedUser> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed("/auth/users", {
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

  if (!response.ok) {
    throw new Error(
      extractBackendErrorMessage(response.status, responsePayload, responseText, "User management request failed"),
    );
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
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/auth/users/${encodeURIComponent(userId)}`, {
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

  if (!response.ok) {
    throw new Error(
      extractBackendErrorMessage(response.status, responsePayload, responseText, "User management request failed"),
    );
  }

  const managedUser = mapManagedUser(responsePayload);
  if (!managedUser) {
    throw new Error("User update response is invalid.");
  }

  return managedUser;
}

export async function deleteManagedUserInBackend(userId: string): Promise<void> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/auth/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      extractBackendErrorMessage(response.status, responsePayload, responseText, "User management request failed"),
    );
  }
}

export async function setManagedUserPasswordInBackend(userId: string, password: string): Promise<BackendManagedUser> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/auth/users/${encodeURIComponent(userId)}/password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password: password.trim(),
    }),
  });

  if (!response.ok) {
    throw new Error(
      extractBackendErrorMessage(response.status, responsePayload, responseText, "User management request failed"),
    );
  }

  const managedUser = mapManagedUser(responsePayload);
  if (!managedUser) {
    throw new Error("User password response is invalid.");
  }

  return managedUser;
}
