import assert from "node:assert/strict";
import { loginWithBackend } from "../hooks/use-auth-backend.js";
function createLoginResponseJson(overrides = {}) {
    return JSON.stringify({
        accessToken: "token-789",
        tokenType: "Bearer",
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
function withMockFetch(implementation, fn) {
    const calls = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
        calls.push({ input, init });
        return implementation({ input, init });
    });
    return fn(calls).finally(() => {
        globalThis.fetch = originalFetch;
    });
}
function withApiBaseOverride(value, fn) {
    const key = "__GTT_API_BASE_URL__";
    const holder = globalThis;
    const previous = holder[key];
    if (value === undefined) {
        delete holder[key];
    }
    else {
        holder[key] = value;
    }
    return fn().finally(() => {
        if (previous === undefined) {
            delete holder[key];
        }
        else {
            holder[key] = previous;
        }
    });
}
function withLocationHostname(hostname, fn) {
    const previous = globalThis.location;
    Object.defineProperty(globalThis, "location", {
        configurable: true,
        writable: true,
        value: { hostname },
    });
    return fn().finally(() => {
        if (previous === undefined) {
            delete globalThis.location;
        }
        else {
            Object.defineProperty(globalThis, "location", {
                configurable: true,
                writable: true,
                value: previous,
            });
        }
    });
}
async function runCase(name, fn) {
    await fn();
    console.log(`PASS ${name}`);
}
async function testLoginUsesCustomApiBaseUrlAndNormalizesIdentifier() {
    await withApiBaseOverride("http://127.0.0.1:4100/api///", async () => {
        await withMockFetch(async () => new Response(createLoginResponseJson(), {
            status: 200,
        }), async (calls) => {
            const session = await loginWithBackend({
                identifier: "  dev.admin  ",
                password: "DevAdmin#2026",
                rememberSession: true,
            });
            assert.equal(session.accessToken, "token-789");
            assert.equal(calls.length, 1);
            assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/auth/login");
            const parsedBody = JSON.parse(String(calls[0].init?.body ?? "{}"));
            assert.equal(parsedBody.identifier, "dev.admin");
            assert.equal(parsedBody.rememberSession, true);
        });
    });
}
async function testLoginFallsBackToLocalhostApiBaseUrl() {
    await withApiBaseOverride(undefined, async () => {
        await withLocationHostname("localhost", async () => {
            await withMockFetch(async () => new Response(createLoginResponseJson(), {
                status: 200,
            }), async (calls) => {
                await loginWithBackend({
                    identifier: "dev.superadmin",
                    password: "DevSuperAdmin#2026",
                    rememberSession: false,
                });
                assert.equal(String(calls[0].input), "http://localhost:3001/api/auth/login");
            });
        });
    });
}
async function testLoginReturnsStructuredBackendErrorMessage() {
    await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
        await withMockFetch(async () => new Response(JSON.stringify({ message: "Invalid username/email or password." }), {
            status: 401,
        }), async () => {
            await assert.rejects(() => loginWithBackend({
                identifier: "dev.admin",
                password: "wrong-password",
                rememberSession: false,
            }), /Invalid username\/email or password/i);
        });
    });
}
async function testLoginUsesFallbackTextWhenBackendErrorPayloadIsUnknown() {
    await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
        await withMockFetch(async () => new Response("Server unavailable", {
            status: 503,
        }), async () => {
            await assert.rejects(() => loginWithBackend({
                identifier: "dev.admin",
                password: "DevAdmin#2026",
                rememberSession: false,
            }), /Server unavailable/i);
        });
    });
}
async function testLoginRejectsInvalidSessionPayload() {
    await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
        await withMockFetch(async () => new Response(JSON.stringify({
            accessToken: "",
        }), {
            status: 200,
        }), async () => {
            await assert.rejects(() => loginWithBackend({
                identifier: "dev.admin",
                password: "DevAdmin#2026",
                rememberSession: true,
            }), /Authentication response is invalid/i);
        });
    });
}
async function main() {
    await runCase("loginWithBackend custom api base url", testLoginUsesCustomApiBaseUrlAndNormalizesIdentifier);
    await runCase("loginWithBackend localhost fallback url", testLoginFallsBackToLocalhostApiBaseUrl);
    await runCase("loginWithBackend structured error message", testLoginReturnsStructuredBackendErrorMessage);
    await runCase("loginWithBackend fallback error message", testLoginUsesFallbackTextWhenBackendErrorPayloadIsUnknown);
    await runCase("loginWithBackend invalid payload handling", testLoginRejectsInvalidSessionPayload);
}
void main().catch((error) => {
    console.error("use-auth-backend unit test failed:", error);
    process.exitCode = 1;
});
