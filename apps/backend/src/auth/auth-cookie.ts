import { ConfigService } from "@nestjs/config";
import {
  resolveConfiguredBoolean,
  resolveConfiguredNodeEnv,
  resolveConfiguredString,
} from "../config/app-config";
import { readHeaderValue } from "../http-origin";

export const AUTH_COOKIE_NAME = "gtt_auth_session";

const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";
const COOKIE_DOMAIN_PATTERN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

export type AuthCookieRuntimeConfig = {
  cookieDomain?: string;
  secure: boolean;
};

export function resolveAuthCookieRuntimeConfig(
  configService?: ConfigService,
): AuthCookieRuntimeConfig {
  const normalized = (resolveConfiguredString(configService, "AUTH_COOKIE_DOMAIN") ?? "").toLowerCase();
  const configuredSecure = resolveConfiguredBoolean(configService, "AUTH_COOKIE_SECURE");
  const secure = configuredSecure ?? resolveConfiguredNodeEnv(configService) === "production";
  if (!normalized) {
    return {
      secure,
    };
  }

  if (
    normalized.includes("://") ||
    normalized.includes("/") ||
    normalized.includes(";") ||
    normalized.includes(",") ||
    !COOKIE_DOMAIN_PATTERN.test(normalized)
  ) {
    throw new Error(
      `Invalid AUTH_COOKIE_DOMAIN value '${resolveConfiguredString(configService, "AUTH_COOKIE_DOMAIN")}'. Expected a bare cookie domain.`,
    );
  }

  return {
    secure,
    cookieDomain: normalized,
  };
}

function buildCookieBaseParts(runtimeConfig: AuthCookieRuntimeConfig): string[] {
  const parts = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Priority=High",
  ];

  if (runtimeConfig.secure) {
    parts.push("Secure");
  }

  if (runtimeConfig.cookieDomain) {
    parts.push(`Domain=${runtimeConfig.cookieDomain}`);
  }

  return parts;
}

export function serializeAuthCookie(args: {
  accessToken: string;
  rememberSession: boolean;
  maxAgeSeconds: number;
}, runtimeConfig: AuthCookieRuntimeConfig): string {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(args.accessToken)}`,
    ...buildCookieBaseParts(runtimeConfig),
  ];

  if (args.rememberSession) {
    const expiresAt = new Date(Date.now() + Math.max(0, args.maxAgeSeconds) * 1000);
    parts.push(`Max-Age=${Math.max(0, Math.floor(args.maxAgeSeconds))}`);
    parts.push(`Expires=${expiresAt.toUTCString()}`);
  }

  return parts.join("; ");
}

export function serializeExpiredAuthCookie(runtimeConfig: AuthCookieRuntimeConfig): string {
  return [
    `${AUTH_COOKIE_NAME}=`,
    ...buildCookieBaseParts(runtimeConfig),
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
