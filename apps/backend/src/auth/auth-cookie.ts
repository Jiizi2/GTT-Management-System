import { readHeaderValue } from "../http-origin";

export const AUTH_COOKIE_NAME = "gtt_auth_session";

const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";
const COOKIE_DOMAIN_PATTERN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV?.trim().toLowerCase() === "production";
}

function resolveCookieDomain(): string | undefined {
  const normalized = process.env.AUTH_COOKIE_DOMAIN?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes("://") ||
    normalized.includes("/") ||
    normalized.includes(";") ||
    normalized.includes(",") ||
    !COOKIE_DOMAIN_PATTERN.test(normalized)
  ) {
    throw new Error(
      `Invalid AUTH_COOKIE_DOMAIN value '${process.env.AUTH_COOKIE_DOMAIN}'. Expected a bare cookie domain.`,
    );
  }

  return normalized;
}

function buildCookieBaseParts(): string[] {
  const parts = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Priority=High",
  ];

  if (isProductionEnvironment()) {
    parts.push("Secure");
  }

  const cookieDomain = resolveCookieDomain();
  if (cookieDomain) {
    parts.push(`Domain=${cookieDomain}`);
  }

  return parts;
}

export function serializeAuthCookie(args: {
  accessToken: string;
  rememberSession: boolean;
  maxAgeSeconds: number;
}): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(args.accessToken)}`,
    ...buildCookieBaseParts(),
  ];

  if (args.rememberSession) {
    const expiresAt = new Date(Date.now() + Math.max(0, args.maxAgeSeconds) * 1000);
    parts.push(`Max-Age=${Math.max(0, Math.floor(args.maxAgeSeconds))}`);
    parts.push(`Expires=${expiresAt.toUTCString()}`);
  }

  return parts.join("; ");
}

export function serializeExpiredAuthCookie(): string {
  return [
    `${AUTH_COOKIE_NAME}=`,
    ...buildCookieBaseParts(),
    "Max-Age=0",
    `Expires=${EXPIRED_COOKIE_DATE}`,
  ].join("; ");
}

export function extractAuthCookieToken(headers: Record<string, unknown> | undefined): string | null {
  const cookieHeader = readHeaderValue(headers, "cookie");
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");
  for (const cookieEntry of cookies) {
    const [rawName, ...rawValueParts] = cookieEntry.split("=");
    const name = rawName?.trim();
    if (name !== AUTH_COOKIE_NAME) {
      continue;
    }

    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) {
      return null;
    }

    try {
      const decodedValue = decodeURIComponent(rawValue);
      return decodedValue.trim() || null;
    } catch {
      return null;
    }
  }

  return null;
}
