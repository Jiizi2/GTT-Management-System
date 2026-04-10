import { coerceAuthSession } from "../shared/auth-session.js";
function resolveBackendApiBaseUrl() {
    const customUrl = globalThis.__GTT_API_BASE_URL__;
    if (customUrl?.trim()) {
        return customUrl.trim().replace(/\/+$/, "");
    }
    const hostname = globalThis.location?.hostname ?? "";
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:3001/api";
    }
    return "/api";
}
function extractBackendErrorMessage(status, payload, fallbackText) {
    if (payload && typeof payload === "object" && "message" in payload) {
        const message = payload.message;
        if (typeof message === "string" && message.trim()) {
            return message.trim();
        }
    }
    if (fallbackText.trim()) {
        return fallbackText.trim();
    }
    return `Authentication failed (${status}).`;
}
export async function loginWithBackend(credentials) {
    const response = await fetch(`${resolveBackendApiBaseUrl()}/auth/login`, {
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
    const responseText = await response.text();
    let payload = null;
    if (responseText.trim()) {
        try {
            payload = JSON.parse(responseText);
        }
        catch {
            payload = null;
        }
    }
    if (!response.ok) {
        throw new Error(extractBackendErrorMessage(response.status, payload, responseText));
    }
    const session = coerceAuthSession(payload);
    if (!session) {
        throw new Error("Authentication response is invalid.");
    }
    return session;
}
