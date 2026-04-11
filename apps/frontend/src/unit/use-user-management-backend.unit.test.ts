import assert from "node:assert/strict";
import {
  createManagedUserInBackend,
  fetchManagedUsersFromBackend,
  setManagedUserPasswordInBackend,
} from "../hooks/use-user-management-backend.js";

type FetchFn = typeof fetch;

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

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

function createManagedUserJson(overrides: Partial<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    id: "usr-123",
    name: "Rina Access",
    email: "rina.access@ghaniyatravel.com",
    roleId: "admin",
    hasPassword: true,
    updatedAt: "2099-01-01T00:00:00.000Z",
    ...overrides,
  });
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testFetchManagedUsersMapsPasswordState(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify([
            {
              id: "usr-1",
              name: "Operator Admin",
              email: "operator.admin@ghaniyatravel.com",
              roleId: "admin",
              hasPassword: false,
            },
            JSON.parse(createManagedUserJson()),
          ]),
          { status: 200 },
        ),
      async (calls) => {
        const users = await fetchManagedUsersFromBackend();
        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/auth/users");
        assert.equal(users.length, 2);
        assert.equal(users[0]?.hasPassword, false);
        assert.equal(users[1]?.hasPassword, true);
      },
    );
  });
}

async function testCreateManagedUserSendsOptionalPasswordWhenPresent(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(createManagedUserJson(), {
          status: 201,
        }),
      async (calls) => {
        const created = await createManagedUserInBackend({
          name: "Rina Access",
          email: "rina.access@ghaniyatravel.com",
          roleId: "admin",
          password: "  RinaAccess#2026  ",
        });

        assert.equal(created.hasPassword, true);
        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/auth/users");
        assert.equal(calls[0].init?.method, "POST");

        const parsedBody = JSON.parse(String(calls[0].init?.body ?? "{}")) as {
          password?: string;
        };
        assert.equal(parsedBody.password, "RinaAccess#2026");
      },
    );
  });
}

async function testCreateManagedUserOmitsBlankPassword(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(createManagedUserJson({ hasPassword: false }), {
          status: 201,
        }),
      async (calls) => {
        const created = await createManagedUserInBackend({
          name: "Rina Access",
          email: "rina.access@ghaniyatravel.com",
          roleId: "admin",
          password: "   ",
        });

        assert.equal(created.hasPassword, false);
        const parsedBody = JSON.parse(String(calls[0].init?.body ?? "{}")) as Record<string, unknown>;
        assert.equal(Object.hasOwn(parsedBody, "password"), false);
      },
    );
  });
}

async function testSetManagedUserPasswordUsesDedicatedEndpoint(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(createManagedUserJson({ hasPassword: true }), {
          status: 200,
        }),
      async (calls) => {
        const updated = await setManagedUserPasswordInBackend("usr-123", "  Reset#2026  ");

        assert.equal(updated.hasPassword, true);
        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/auth/users/usr-123/password");
        assert.equal(calls[0].init?.method, "PUT");

        const parsedBody = JSON.parse(String(calls[0].init?.body ?? "{}")) as {
          password?: string;
        };
        assert.equal(parsedBody.password, "Reset#2026");
      },
    );
  });
}

async function main(): Promise<void> {
  await runCase("fetchManagedUsersFromBackend maps hasPassword", testFetchManagedUsersMapsPasswordState);
  await runCase("createManagedUserInBackend sends password when present", testCreateManagedUserSendsOptionalPasswordWhenPresent);
  await runCase("createManagedUserInBackend omits blank password", testCreateManagedUserOmitsBlankPassword);
  await runCase("setManagedUserPasswordInBackend uses password endpoint", testSetManagedUserPasswordUsesDedicatedEndpoint);
}

void main().catch((error: unknown) => {
  console.error("use-user-management-backend unit test failed:", error);
  process.exitCode = 1;
});
