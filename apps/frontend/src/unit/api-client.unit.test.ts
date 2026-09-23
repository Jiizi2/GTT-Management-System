import assert from "node:assert/strict";
import { describe } from "vitest";
import { fetchBackend } from "../shared/api-client.js";
import { AUTH_STATE_CHANGED_EVENT } from "../shared/auth-session.js";
import { runCase } from "../test/run-case.js";
import { withApiBaseOverride } from "../test/with-api-base-override.js";
import { withMockFetch } from "../test/with-mock-fetch.js";
import { createWindowMock } from "../test/with-mock-window.js";

const AUTH_SESSION_STORAGE_KEY = "gtt-auth-session-v2";

async function withAuthWindow(fn: (context: { authEvents: () => number; hasSession: () => boolean }) => Promise<void>): Promise<void> {
  const previousWindow = (globalThis as { window?: unknown }).window;
  const windowMock = createWindowMock();
  let authEventCount = 0;
  windowMock.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, "persisted-session");
  windowMock.addEventListener(AUTH_STATE_CHANGED_EVENT, () => {
    authEventCount += 1;
  });
  Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: windowMock });

  try {
    await fn({
      authEvents: () => authEventCount,
      hasSession: () => windowMock.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) !== null,
    });
  } finally {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.defineProperty(globalThis, "window", { configurable: true, writable: true, value: previousWindow });
  }
}

async function testAuthProbeUnauthorizedDoesNotBroadcastSessionChanges(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withAuthWindow(async ({ authEvents, hasSession }) => {
      await withMockFetch(
        async () => new Response(null, { status: 401 }),
        async (calls) => {
          await fetchBackend("/auth/login", { method: "POST" });
          await fetchBackend("/auth/session");
          assert.equal(calls.length, 2);
          assert.equal(authEvents(), 0);
          assert.equal(hasSession(), true);
        },
      );
    });
  });
}

async function testProtectedUnauthorizedStillClearsSession(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withAuthWindow(async ({ authEvents, hasSession }) => {
      await withMockFetch(
        async () => new Response(null, { status: 401 }),
        async () => {
          await fetchBackend("/groups");
          assert.equal(authEvents(), 1);
          assert.equal(hasSession(), false);
        },
      );
    });
  });
}

async function testRelativeAuthProbeDoesNotThrow(): Promise<void> {
  await withApiBaseOverride(undefined, async () => {
    await withAuthWindow(async ({ authEvents, hasSession }) => {
      await withMockFetch(
        async () => new Response(null, { status: 401 }),
        async (calls) => {
          await fetchBackend("/auth/login", { method: "POST" });
          assert.equal(calls.length, 1);
          assert.equal(calls[0]?.input, "/api/auth/login");
          assert.equal(authEvents(), 0);
          assert.equal(hasSession(), true);
        },
      );
    });
  });
}

describe("api client unauthorized handling", () => {
  runCase("auth probes stay silent", testAuthProbeUnauthorizedDoesNotBroadcastSessionChanges);
  runCase("relative auth probes stay silent", testRelativeAuthProbeDoesNotThrow);
  runCase("protected request clears session", testProtectedUnauthorizedStillClearsSession);
});
