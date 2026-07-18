import { ConfigService } from "@nestjs/config";
import {
  resolveConfiguredBoolean,
  resolveConfiguredNodeEnv,
  resolveConfiguredString,
} from "../config/app-config";
import { readHeaderValue } from "../http-origin";

export const AGENT_AUTH_COOKIE_NAME = "gtt_agent_session";
const AGENT_COOKIE_PATH = "/api/agent";
const EXPIRED_COOKIE_DATE = "Thu, 01 Jan 1970 00:00:00 GMT";
const COOKIE_DOMAIN_PATTERN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

export type AgentAuthCookieRuntimeConfig = { cookieDomain?: string; secure: boolean };

export function resolveAgentAuthCookieRuntimeConfig(
  configService?: ConfigService,
): AgentAuthCookieRuntimeConfig {
  const rawDomain = resolveConfiguredString(configService, "AGENT_AUTH_COOKIE_DOMAIN") ?? "";
  const cookieDomain = rawDomain.trim().toLowerCase();
  if (cookieDomain && !COOKIE_DOMAIN_PATTERN.test(cookieDomain)) {
    throw new Error("AGENT_AUTH_COOKIE_DOMAIN must be a bare cookie domain.");
  }
  const configuredSecure = resolveConfiguredBoolean(configService, "AGENT_AUTH_COOKIE_SECURE");
  return {
    ...(cookieDomain ? { cookieDomain } : {}),
    secure: configuredSecure ?? resolveConfiguredNodeEnv(configService) === "production",
  };
}

function baseParts(config: AgentAuthCookieRuntimeConfig): string[] {
  return [
    `Path=${AGENT_COOKIE_PATH}`,
    "HttpOnly",
    "SameSite=Lax",
    "Priority=High",
    ...(config.secure ? ["Secure"] : []),
    ...(config.cookieDomain ? [`Domain=${config.cookieDomain}`] : []),
  ];
}

export function serializeAgentAuthCookie(
  accessToken: string,
  maxAgeSeconds: number,
  config: AgentAuthCookieRuntimeConfig,
): string {
  const seconds = Math.max(0, Math.floor(maxAgeSeconds));
  return [
    `${AGENT_AUTH_COOKIE_NAME}=${encodeURIComponent(accessToken)}`,
    ...baseParts(config),
    `Max-Age=${seconds}`,
    `Expires=${new Date(Date.now() + seconds * 1000).toUTCString()}`,
  ].join("; ");
}

export function serializeExpiredAgentAuthCookie(config: AgentAuthCookieRuntimeConfig): string {
  return [
    `${AGENT_AUTH_COOKIE_NAME}=`,
    ...baseParts(config),
    "Max-Age=0",
    `Expires=${EXPIRED_COOKIE_DATE}`,
  ].join("; ");
}

export function extractAgentAuthCookieToken(
  headers: Record<string, unknown> | undefined,
): string | null {
  const cookieHeader = readHeaderValue(headers, "cookie");
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.split("=");
    if (rawName?.trim() !== AGENT_AUTH_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(rawValue.join("=").trim()).trim() || null;
    } catch {
      return null;
    }
  }
  return null;
}
