import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  AUTH_STATE_CHANGED_EVENT,
  clearAuthSession,
  coerceAuthSession,
  persistAuthSession,
  readPersistedAuthSession,
  type AuthSession,
} from "../shared/auth-session.js";
import { runCase } from "../test/run-case.js";
import { createWindowMock, MemoryStorage } from "../test/with-mock-window.js";

const AUTH_SESSION_STORAGE_KEY = "gtt-auth-session-v2";
const LEGACY_AUTH_ACCESS_TOKEN_STORAGE_KEY = "gtt-auth-access-token-v1";
const LEGACY_SESSION_ACCESS_TIER_STORAGE_KEY = "gtt-session-access-tier-v1";

function withMockWindow<T>(
  fn: (context: {
    localStorage: MemoryStorage;
    sessionStorage: MemoryStorage;
    countAuthStateEvents: () => number;
  }) => T,
): T {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const windowMock = createWindowMock();
  let authStateEventCount = 0;

  windowMock.addEventListener(AUTH_STATE_CHANGED_EVENT, () => {
    authStateEventCount += 1;
  });

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: windowMock,
  });

  try {
    return fn({
      localStorage: windowMock.localStorage,
      sessionStorage: windowMock.sessionStorage,
      countAuthStateEvents: () => authStateEventCount,
    });
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        writable: true,
        value: previousWindow,
      });
    }
  }
}

function testCoerceAuthSessionValidation(): void {
  const normalized = coerceAuthSession({
    expiresAt: "2026-08-10T07:00:00.000Z",
    rememberSession: 1,
    user: {
      id: "usr-100",
      name: "Operator One",
      username: "operator.one",
      email: "operator.one@example.com",
      accessTier: "admin",
    },
  });
  assert.ok(normalized);
  assert.equal(normalized?.rememberSession, true);
  assert.equal(normalized?.expiresAt, "2026-08-10T07:00:00.000Z");

  assert.equal(
    coerceAuthSession({
      rememberSession: false,
      user: {
        id: "usr-100",
        name: "Operator One",
        username: "operator.one",
        email: "operator.one@example.com",
        accessTier: "admin",
      },
    }),
    null,
  );

  assert.equal(
    coerceAuthSession({
      expiresAt: "not-a-date",
      rememberSession: false,
      user: {
        id: "usr-100",
        name: "Operator One",
        username: "operator.one",
        email: "operator.one@example.com",
        accessTier: "admin",
      },
    }),
    null,
  );
}

function testPersistReadAndClearRememberedAuthSession(): void {
  withMockWindow(({ localStorage, sessionStorage, countAuthStateEvents }) => {
    const validSession: AuthSession = {
      expiresAt: "2099-01-01T00:00:00.000Z",
      rememberSession: true,
      user: {
        id: "usr-200",
        name: "Operator Two",
        username: "operator.two",
        email: "operator.two@example.com",
        accessTier: "super-admin",
      },
    };

    persistAuthSession(validSession);
    assert.equal(countAuthStateEvents(), 1);
    assert.equal(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);

    const rawStoredSession = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    assert.ok(rawStoredSession);
    const parsed = JSON.parse(rawStoredSession ?? "{}") as { expiresAt?: string; accessToken?: string };
    assert.equal(parsed.expiresAt, validSession.expiresAt);
    assert.equal(parsed.accessToken, undefined);

    assert.equal(readPersistedAuthSession()?.user.username, "operator.two");

    clearAuthSession();
    assert.equal(countAuthStateEvents(), 2);
    assert.equal(localStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
    assert.equal(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  });
}

function testPersistEphemeralSessionUsesSessionStorageAndPurgesLegacyKeys(): void {
  withMockWindow(({ localStorage, sessionStorage }) => {
    localStorage.setItem(LEGACY_AUTH_ACCESS_TOKEN_STORAGE_KEY, "legacy-token");
    localStorage.setItem(LEGACY_SESSION_ACCESS_TIER_STORAGE_KEY, "admin");

    persistAuthSession({
      expiresAt: "2099-02-01T00:00:00.000Z",
      rememberSession: false,
      user: {
        id: "usr-201",
        name: "Operator Three",
        username: "operator.three",
        email: "operator.three@example.com",
        accessTier: "admin",
      },
    });

    assert.equal(localStorage.getItem(LEGACY_AUTH_ACCESS_TOKEN_STORAGE_KEY), null);
    assert.equal(localStorage.getItem(LEGACY_SESSION_ACCESS_TIER_STORAGE_KEY), null);
    assert.equal(localStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
    assert.notEqual(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
  });
}

function testReadPersistedSessionRejectsInvalidAndExpiredData(): void {
  withMockWindow(({ localStorage, sessionStorage, countAuthStateEvents }) => {
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, "{ this-is-not-json");
    assert.equal(readPersistedAuthSession(), null);
    assert.equal(localStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
    assert.equal(countAuthStateEvents() >= 1, true);

    const expiredSession: AuthSession = {
      expiresAt: "2020-01-01T00:00:00.000Z",
      rememberSession: false,
      user: {
        id: "usr-300",
        name: "Expired User",
        username: "expired.user",
        email: "expired.user@example.com",
        accessTier: "admin",
      },
    };
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(expiredSession));
    localStorage.setItem(LEGACY_AUTH_ACCESS_TOKEN_STORAGE_KEY, "legacy-token");
    localStorage.setItem(LEGACY_SESSION_ACCESS_TIER_STORAGE_KEY, expiredSession.user.accessTier);

    assert.equal(readPersistedAuthSession(), null);
    assert.equal(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY), null);
    assert.equal(localStorage.getItem(LEGACY_AUTH_ACCESS_TOKEN_STORAGE_KEY), null);
    assert.equal(localStorage.getItem(LEGACY_SESSION_ACCESS_TIER_STORAGE_KEY), null);
  });
}

describe("auth session", () => {
  runCase("coercion validation", testCoerceAuthSessionValidation);
  runCase("persist/read/clear remembered flow", testPersistReadAndClearRememberedAuthSession);
  runCase("ephemeral storage and legacy purge", testPersistEphemeralSessionUsesSessionStorageAndPurgesLegacyKeys);
  runCase("invalid/expired persistence guard", testReadPersistedSessionRejectsInvalidAndExpiredData);
});
