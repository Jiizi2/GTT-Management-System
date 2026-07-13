import type { SessionAccessTier } from "./app-domain.js";

export const AUTH_STATE_CHANGED_EVENT = "gtt-auth-state-changed";

const AUTH_SESSION_STORAGE_KEY = "gtt-auth-session-v2";

export type AuthSessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  accessTier: SessionAccessTier;
};

export type AuthSession = {
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
  const accessTier = record.accessTier === "admin" || record.accessTier === "super-admin" ? record.accessTier : null;

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
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt.trim() : "";
  const rememberSession = Boolean(record.rememberSession);
  const user = coerceAuthSessionUser(record.user);

  if (!expiresAt || !user) {
    return null;
  }

  const expiresAtDate = new Date(expiresAt);
  if (Number.isNaN(expiresAtDate.getTime())) {
    return null;
  }

  return {
    expiresAt: expiresAtDate.toISOString(),
    rememberSession,
    user,
  };
}

function readStorageValue(storage: Storage | undefined, key: string): string | null {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function clearStorageValue(storage: Storage | undefined, key: string): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(key);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }
}

function getWindowStorage(): { local?: Storage; session?: Storage } {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    local: window.localStorage,
    session: window.sessionStorage,
  };
}

function readRawPersistedSession(): string | null {
  const storage = getWindowStorage();
  return (
    readStorageValue(storage.session, AUTH_SESSION_STORAGE_KEY) ??
    readStorageValue(storage.local, AUTH_SESSION_STORAGE_KEY)
  );
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

export function persistAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedSession = coerceAuthSession(session);
  if (!normalizedSession) {
    throw new Error("Cannot persist invalid auth session.");
  }

  clearStorageValue(window.localStorage, AUTH_SESSION_STORAGE_KEY);
  clearStorageValue(window.sessionStorage, AUTH_SESSION_STORAGE_KEY);

  try {
    const storageTarget = normalizedSession.rememberSession ? window.localStorage : window.sessionStorage;
    storageTarget.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(normalizedSession));
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
    window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors in restricted browser contexts.
  }

  dispatchAuthStateChanged();
}
