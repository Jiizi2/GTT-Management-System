import assert from "node:assert/strict";
import { describe } from "vitest";
import { fetchCurrentSessionFromBackend, loginWithBackend, logoutFromBackend } from "../hooks/use-auth-backend.js";
import { runCase } from "../test/run-case.js";
import { withMockFetch } from "../test/with-mock-fetch.js";
import { withApiBaseOverride } from "../test/with-api-base-override.js";
import { withLocationHostname } from "../test/with-location-hostname.js";

function createSessionResponseJson(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    expiresAt: "2099-01-01T00:00:00.000Z",
    rememberSession: true,
    user: {
      id: "dev-admin",
      name: "Dev Admin",
      username: "dev.admin",
      email: "admin.dev@ghaniya.local",
      accessTier: "admin",
    },
    ...overrides,
  });
}

async function testLoginUsesCustomApiBaseUrlAndNormalizesIdentifier(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api///", async () => {
    await withMockFetch(
      async () =>
        new Response(createSessionResponseJson(), {
          status: 200,
        }),
      async (calls) => {
        const session = await loginWithBackend({
          identifier: "  dev.admin  ",
          password: "DevAdmin#2026",
          rememberSession: true,
        });

        assert.equal(session.user.username, "dev.admin");
        assert.equal(calls.length, 1);
        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/auth/login");
        assert.equal(calls[0].init?.credentials, "include");

        const parsedBody = JSON.parse(String(calls[0].init?.body ?? "{}")) as {
          identifier?: string;
          rememberSession?: boolean;
        };
        assert.equal(parsedBody.identifier, "dev.admin");
        assert.equal(parsedBody.rememberSession, true);
      },
    );
  });
}

async function testLoginFallsBackToLocalhostApiBaseUrl(): Promise<void> {
  await withApiBaseOverride(undefined, async () => {
    await withLocationHostname("localhost", async () => {
      await withMockFetch(
        async () =>
          new Response(createSessionResponseJson(), {
            status: 200,
          }),
        async (calls) => {
          await loginWithBackend({
            identifier: "dev.superadmin",
            password: "DevSuperAdmin#2026",
            rememberSession: false,
          });
          assert.equal(String(calls[0].input), "http://localhost:3001/api/auth/login");
        },
      );
    });
  });
}

async function testLoginPreservesLoopbackHostnameForCookieAuth(): Promise<void> {
  await withApiBaseOverride(undefined, async () => {
    await withLocationHostname("127.0.0.1", async () => {
      await withMockFetch(
        async () =>
          new Response(createSessionResponseJson(), {
            status: 200,
          }),
        async (calls) => {
          await loginWithBackend({
            identifier: "dev.superadmin",
            password: "DevSuperAdmin#2026",
            rememberSession: false,
          });
          assert.equal(String(calls[0].input), "http://127.0.0.1:3001/api/auth/login");
        },
      );
    });
  });
}

async function testLoginReturnsStructuredBackendErrorMessage(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(JSON.stringify({ message: "Invalid username/email or password." }), {
          status: 401,
        }),
      async () => {
        await assert.rejects(
          () =>
            loginWithBackend({
              identifier: "dev.admin",
              password: "wrong-password",
              rememberSession: false,
            }),
          /Invalid username\/email or password/i,
        );
      },
    );
  });
}

async function testLoginUsesFallbackTextWhenBackendErrorPayloadIsUnknown(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response("Server unavailable", {
          status: 503,
        }),
      async () => {
        await assert.rejects(
          () =>
            loginWithBackend({
              identifier: "dev.admin",
              password: "DevAdmin#2026",
              rememberSession: false,
            }),
          /Server unavailable/i,
        );
      },
    );
  });
}

async function testLoginRejectsInvalidSessionPayload(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify({
            expiresAt: "",
          }),
          {
            status: 200,
          },
        ),
      async () => {
        await assert.rejects(
          () =>
            loginWithBackend({
              identifier: "dev.admin",
              password: "DevAdmin#2026",
              rememberSession: true,
            }),
          /Authentication response is invalid/i,
        );
      },
    );
  });
}

async function testFetchCurrentSessionHandlesUnauthorizedAndValidPayload(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async ({ input }) => {
        if (String(input).endsWith("/auth/session")) {
          return new Response(createSessionResponseJson({ rememberSession: false }), {
            status: 200,
          });
        }

        return new Response(null, { status: 500 });
      },
      async (calls) => {
        const session = await fetchCurrentSessionFromBackend();
        assert.equal(session?.rememberSession, false);
        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/auth/session");
        assert.equal(calls[0].init?.credentials, "include");
      },
    );

    await withMockFetch(
      async () => new Response(null, { status: 401 }),
      async () => {
        const session = await fetchCurrentSessionFromBackend();
        assert.equal(session, null);
      },
    );
  });
}

async function testLogoutUsesCredentialedPost(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () => new Response(null, { status: 204 }),
      async (calls) => {
        await logoutFromBackend();
        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/auth/logout");
        assert.equal(calls[0].init?.method, "POST");
        assert.equal(calls[0].init?.credentials, "include");
      },
    );
  });
}

describe("use-auth-backend", () => {
  runCase("custom api base url", testLoginUsesCustomApiBaseUrlAndNormalizesIdentifier);
  runCase("localhost fallback url", testLoginFallsBackToLocalhostApiBaseUrl);
  runCase("preserves loopback hostname", testLoginPreservesLoopbackHostnameForCookieAuth);
  runCase("structured error message", testLoginReturnsStructuredBackendErrorMessage);
  runCase("fallback error message", testLoginUsesFallbackTextWhenBackendErrorPayloadIsUnknown);
  runCase("invalid payload handling", testLoginRejectsInvalidSessionPayload);
  runCase("restore flow", testFetchCurrentSessionHandlesUnauthorizedAndValidPayload);
  runCase("credentialed request", testLogoutUsesCredentialedPost);
});
