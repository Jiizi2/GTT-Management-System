import type { SessionAccessTier } from "./app-domain.js";

export const AUTH_STATE_CHANGED_EVENT = "gtt-auth-state-changed";

const AUTH_SESSION_STORAGE_KEY = "gtt-auth-session-v1";
const AUTH_ACCESS_TOKEN_STORAGE_KEY = "gtt-auth-access-token-v1";
const SESSION_ACCESS_TIER_STORAGE_KEY = "gtt-session-access-tier-v1";

export type AuthSessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  accessTier: SessionAccessTier;
};

export type AuthSession = {
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: string;
  rememberSession: boolean;
  user: AuthSessionUser;
};

function dispatchAuthStateChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_STATE_CHANGED_EVENT));
}

function coerceAuthSessionUser(value: unknown): AuthSessionUser | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const accessTier =
    record.accessTier === "admin" || record.accessTier === "super-admin"
      ? record.accessTier
      : null;

  if (!id || !name || !username || !email || !accessTier) {
    return null;
  }

  return {
    id,
    name,
    username,
    email,
    accessTier,
  };
}

export function coerceAuthSession(value: unknown): AuthSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const accessToken = typeof record.accessToken === "string" ? record.accessToken.trim() : "";
  const tokenType = record.tokenType === "Bearer" ? "Bearer" : null;
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt.trim() : "";
  const rememberSession = Boolean(record.rememberSession);
  const user = coerceAuthSessionUser(record.user);

  if (!accessToken || !tokenType || !expiresAt || !user) {
    return null;
  }

  const expiresAtDate = new Date(expiresAt);
  if (Number.isNaN(expiresAtDate.getTime())) {
    return null;
  }

  return {
    accessToken,
    tokenType,
    expiresAt: expiresAtDate.toISOString(),
    rememberSession,
    user,
  };
}

function readRawPersistedSession(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readPersistedAuthSession(): AuthSession | null {
  const raw = readRawPersistedSession();
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const session = coerceAuthSession(parsed);
    if (!session) {
      clearAuthSession();
      return null;
    }

    const expiresAtMs = new Date(session.expiresAt).getTime();
    if (expiresAtMs <= Date.now()) {
      clearAuthSession();
      return null;
    }

    return session;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function getAuthAccessToken(): string | null {
  const session = readPersistedAuthSession();
  return session?.accessToken ?? null;
}

export function persistAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSession = coerceAuthSession(session);
  if (!normalizedSession) {
    throw new Error("Cannot persist invalid auth session.");
  }

  try {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
    window.localStorage.setItem(AUTH_ACCESS_TOKEN_STORAGE_KEY, normalizedSession.accessToken);
    window.localStorage.setItem(SESSION_ACCESS_TIER_STORAGE_KEY, normalizedSession.user.accessTier);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }

  dispatchAuthStateChanged();
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_ACCESS_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_ACCESS_TIER_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }

  dispatchAuthStateChanged();
}
