import { type LoginCredentials } from "../pages/login-page.js";
import { resolveBackendApiBaseUrl } from "../shared/backend-api-base.js";
import { coerceAuthSession, type AuthSession } from "../shared/auth-session.js";

function extractBackendErrorMessage(status: number, payload: unknown, fallbackText: string): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  if (fallbackText.trim()) {
    return fallbackText.trim();
  }

  return `Authentication failed (${status}).`;
}

export async function loginWithBackend(credentials: LoginCredentials): Promise<AuthSession> {
  const response = await fetch(`${resolveBackendApiBaseUrl()}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      identifier: credentials.identifier.trim(),
      password: credentials.password,
      rememberSession: credentials.rememberSession,
    }),
  });

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, payload, responseText));
  }

  const session = coerceAuthSession(payload);
  if (!session) {
    throw new Error("Authentication response is invalid.");
  }

  return session;
}

export async function fetchCurrentSessionFromBackend(): Promise<AuthSession | null> {
  const response = await fetch(`${resolveBackendApiBaseUrl()}/auth/session`, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  const responseText = await response.text();
  let payload: unknown = null;
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, payload, responseText));
  }

  const session = coerceAuthSession(payload);
  if (!session) {
    throw new Error("Session response is invalid.");
  }

  return session;
}

export async function logoutFromBackend(): Promise<void> {
  await fetch(`${resolveBackendApiBaseUrl()}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
