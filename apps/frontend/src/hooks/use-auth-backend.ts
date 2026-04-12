import { type LoginCredentials } from "../pages/login-page.js";
import { fetchBackend, parseBackendResponse } from "../shared/api-client.js";
import { extractBackendErrorMessage } from "../shared/api-error.js";
import { coerceAuthSession, type AuthSession } from "../shared/auth-session.js";

export async function loginWithBackend(credentials: LoginCredentials): Promise<AuthSession> {
  const response = await fetchBackend("/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      identifier: credentials.identifier.trim(),
      password: credentials.password,
      rememberSession: credentials.rememberSession,
    }),
  });
  const { payload, responseText } = await parseBackendResponse(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, payload, responseText, "Authentication failed"));
  }

  const session = coerceAuthSession(payload);
  if (!session) {
    throw new Error("Authentication response is invalid.");
  }

  return session;
}

export async function fetchCurrentSessionFromBackend(): Promise<AuthSession | null> {
  const response = await fetchBackend("/auth/session", {
    method: "GET",
  });

  if (response.status === 401) {
    return null;
  }
  const { payload, responseText } = await parseBackendResponse(response);

  if (!response.ok) {
    throw new Error(extractBackendErrorMessage(response.status, payload, responseText, "Authentication failed"));
  }

  const session = coerceAuthSession(payload);
  if (!session) {
    throw new Error("Session response is invalid.");
  }

  return session;
}

export async function logoutFromBackend(): Promise<void> {
  await fetchBackend("/auth/logout", {
    method: "POST",
  });
}
