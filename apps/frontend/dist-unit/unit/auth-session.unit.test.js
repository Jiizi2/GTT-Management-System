import assert from "node:assert/strict";
import { AUTH_STATE_CHANGED_EVENT, clearAuthSession, coerceAuthSession, getAuthAccessToken, persistAuthSession, readPersistedAuthSession, } from "../shared/auth-session.js";
const AUTH_SESSION_STORAGE_KEY = "gtt-auth-session-v1";
const AUTH_ACCESS_TOKEN_STORAGE_KEY = "gtt-auth-access-token-v1";
const SESSION_ACCESS_TIER_STORAGE_KEY = "gtt-session-access-tier-v1";
class MemoryStorage {
    store = new Map();
    getItem(key) {
        return this.store.has(key) ? this.store.get(key) ?? null : null;
    }
    setItem(key, value) {
        this.store.set(key, value);
    }
    removeItem(key) {
        this.store.delete(key);
    }
}
function createWindowMock() {
    const storage = new MemoryStorage();
    const listenersByEvent = new Map();
    return {
        storage,
        windowMock: {
            localStorage: storage,
            addEventListener: (type, listener) => {
                const listeners = listenersByEvent.get(type) ?? new Set();
                listeners.add(listener);
                listenersByEvent.set(type, listeners);
            },
            removeEventListener: (type, listener) => {
                const listeners = listenersByEvent.get(type);
                if (!listeners) {
                    return;
                }
                listeners.delete(listener);
            },
            dispatchEvent: (event) => {
                const listeners = listenersByEvent.get(event.type);
                if (!listeners) {
                    return true;
                }
                listeners.forEach((listener) => listener(event));
                return true;
            },
        },
    };
}
function withMockWindow(fn) {
    const previousWindow = globalThis.window;
    const { windowMock, storage } = createWindowMock();
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
            storage,
            countAuthStateEvents: () => authStateEventCount,
        });
    }
    finally {
        if (previousWindow === undefined) {
            delete globalThis.window;
        }
        else {
            Object.defineProperty(globalThis, "window", {
                configurable: true,
                writable: true,
                value: previousWindow,
            });
        }
    }
}
async function runCase(name, fn) {
    fn();
    console.log(`PASS ${name}`);
}
function testCoerceAuthSessionValidation() {
    const normalized = coerceAuthSession({
        accessToken: "  token-123  ",
        tokenType: "Bearer",
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
    assert.equal(normalized?.accessToken, "token-123");
    assert.equal(normalized?.tokenType, "Bearer");
    assert.equal(normalized?.rememberSession, true);
    assert.equal(normalized?.expiresAt, "2026-08-10T07:00:00.000Z");
    assert.equal(coerceAuthSession({
        accessToken: "token-123",
        tokenType: "Unknown",
        expiresAt: "2026-08-10T07:00:00.000Z",
        rememberSession: false,
        user: {
            id: "usr-100",
            name: "Operator One",
            username: "operator.one",
            email: "operator.one@example.com",
            accessTier: "admin",
        },
    }), null);
    assert.equal(coerceAuthSession({
        accessToken: "token-123",
        tokenType: "Bearer",
        expiresAt: "not-a-date",
        rememberSession: false,
        user: {
            id: "usr-100",
            name: "Operator One",
            username: "operator.one",
            email: "operator.one@example.com",
            accessTier: "admin",
        },
    }), null);
}
function testPersistReadAndClearAuthSession() {
    withMockWindow(({ storage, countAuthStateEvents }) => {
        const validSession = {
            accessToken: "token-456",
            tokenType: "Bearer",
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
        assert.equal(storage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY), "token-456");
        assert.equal(storage.getItem(SESSION_ACCESS_TIER_STORAGE_KEY), "super-admin");
        const rawStoredSession = storage.getItem(AUTH_SESSION_STORAGE_KEY);
        assert.ok(rawStoredSession);
        const parsed = JSON.parse(rawStoredSession ?? "{}");
        assert.equal(parsed.accessToken, "token-456");
        assert.equal(getAuthAccessToken(), "token-456");
        assert.equal(readPersistedAuthSession()?.user.username, "operator.two");
        clearAuthSession();
        assert.equal(countAuthStateEvents(), 2);
        assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
        assert.equal(storage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY), null);
        assert.equal(storage.getItem(SESSION_ACCESS_TIER_STORAGE_KEY), null);
        assert.equal(getAuthAccessToken(), null);
    });
}
function testReadPersistedSessionRejectsInvalidAndExpiredData() {
    withMockWindow(({ storage, countAuthStateEvents }) => {
        storage.setItem(AUTH_SESSION_STORAGE_KEY, "{ this-is-not-json");
        assert.equal(readPersistedAuthSession(), null);
        assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
        assert.equal(countAuthStateEvents() >= 1, true);
        const expiredSession = {
            accessToken: "token-expired",
            tokenType: "Bearer",
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
        storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(expiredSession));
        storage.setItem(AUTH_ACCESS_TOKEN_STORAGE_KEY, expiredSession.accessToken);
        storage.setItem(SESSION_ACCESS_TIER_STORAGE_KEY, expiredSession.user.accessTier);
        assert.equal(readPersistedAuthSession(), null);
        assert.equal(storage.getItem(AUTH_SESSION_STORAGE_KEY), null);
        assert.equal(storage.getItem(AUTH_ACCESS_TOKEN_STORAGE_KEY), null);
        assert.equal(storage.getItem(SESSION_ACCESS_TIER_STORAGE_KEY), null);
    });
}
async function main() {
    await runCase("auth session coercion validation", testCoerceAuthSessionValidation);
    await runCase("auth session persist/read/clear flow", testPersistReadAndClearAuthSession);
    await runCase("auth session invalid/expired persistence guard", testReadPersistedSessionRejectsInvalidAndExpiredData);
}
void main().catch((error) => {
    console.error("Auth session unit test failed:", error);
    process.exitCode = 1;
});
