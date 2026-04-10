import assert from "node:assert/strict";
import {
  fetchCurrentSessionFromBackend,
  loginWithBackend,
  logoutFromBackend,
} from "../hooks/use-auth-backend.js";

type FetchFn = typeof fetch;

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

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

function withMockFetch<T>(
  implementation: (call: FetchCall) => Promise<Response>,
  fn: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch as FetchFn;

  (globalThis as { fetch: FetchFn }).fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return implementation({ input, init });
  }) as FetchFn;

  return fn(calls).finally(() => {
    (globalThis as { fetch: FetchFn }).fetch = originalFetch;
  });
}

function withApiBaseOverride<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const key = "__GTT_API_BASE_URL__";
  const holder = globalThis as { [key: string]: unknown };
  const previous = holder[key];

  if (value === undefined) {
    delete holder[key];
  } else {
    holder[key] = value;
  }

  return fn().finally(() => {
    if (previous === undefined) {
      delete holder[key];
    } else {
      holder[key] = previous;
    }
  });
}

function withLocationHostname<T>(hostname: string, fn: () => Promise<T>): Promise<T> {
  const previous = (globalThis as { location?: unknown }).location;
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    writable: true,
    value: { hostname },
  });

  return fn().finally(() => {
    if (previous === undefined) {
      delete (globalThis as { location?: unknown }).location;
    } else {
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        writable: true,
        value: previous,
      });
    }
  });
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
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

async function main(): Promise<void> {
  await runCase("loginWithBackend custom api base url", testLoginUsesCustomApiBaseUrlAndNormalizesIdentifier);
  await runCase("loginWithBackend localhost fallback url", testLoginFallsBackToLocalhostApiBaseUrl);
  await runCase("loginWithBackend preserves loopback hostname", testLoginPreservesLoopbackHostnameForCookieAuth);
  await runCase("loginWithBackend structured error message", testLoginReturnsStructuredBackendErrorMessage);
  await runCase("loginWithBackend fallback error message", testLoginUsesFallbackTextWhenBackendErrorPayloadIsUnknown);
  await runCase("loginWithBackend invalid payload handling", testLoginRejectsInvalidSessionPayload);
  await runCase("fetchCurrentSessionFromBackend restore flow", testFetchCurrentSessionHandlesUnauthorizedAndValidPayload);
  await runCase("logoutFromBackend credentialed request", testLogoutUsesCredentialedPost);
}

void main().catch((error: unknown) => {
  console.error("use-auth-backend unit test failed:", error);
  process.exitCode = 1;
});
