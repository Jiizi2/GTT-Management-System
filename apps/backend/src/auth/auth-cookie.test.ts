import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import type { ConfigService } from "@nestjs/config";
import {
  AUTH_COOKIE_NAME,
  extractAuthCookieToken,
  resolveAuthCookieRuntimeConfig,
  serializeAuthCookie,
  serializeExpiredAuthCookie,
} from "./auth-cookie";

function createConfigServiceMock(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe("AuthCookie", () => {
  runCase("serializes production cookie with secure domain and expiry", () => {
    const runtimeConfig = resolveAuthCookieRuntimeConfig(
      createConfigServiceMock({
        NODE_ENV: "production",
        AUTH_COOKIE_DOMAIN: ".example.com",
      }),
    );

    const serialized = serializeAuthCookie(
      {
        accessToken: "header.payload.signature",
        rememberSession: true,
        maxAgeSeconds: 120,
      },
      runtimeConfig,
    );

    expect(serialized).toMatch(new RegExp(`^${AUTH_COOKIE_NAME}=header\\.payload\\.signature`));
    expect(serialized).toMatch(/HttpOnly/);
    expect(serialized).toMatch(/SameSite=Lax/);
    expect(serialized).toMatch(/Priority=High/);
    expect(serialized).toMatch(/Secure/);
    expect(serialized).toMatch(/Domain=\.example\.com/);
    expect(serialized).toMatch(/Max-Age=120/);
    expect(serialized).toMatch(/Expires=/);
  });

  runCase("serializes session cookie without domain or persistent expiry", () => {
    const runtimeConfig = resolveAuthCookieRuntimeConfig(
      createConfigServiceMock({
        NODE_ENV: "development",
      }),
    );

    const serialized = serializeAuthCookie(
      {
        accessToken: "local-token",
        rememberSession: false,
        maxAgeSeconds: 600,
      },
      runtimeConfig,
    );

    expect(serialized).not.toMatch(/Secure/);
    expect(serialized).not.toMatch(/Domain=/);
    expect(serialized).not.toMatch(/Max-Age=/);
    expect(serialized).not.toMatch(/Expires=/);
  });

  runCase("allows disabling secure flag in production", () => {
    const runtimeConfig = resolveAuthCookieRuntimeConfig(
      createConfigServiceMock({
        NODE_ENV: "production",
        AUTH_COOKIE_SECURE: false,
      }),
    );

    const serialized = serializeAuthCookie(
      {
        accessToken: "prod-http-token",
        rememberSession: false,
        maxAgeSeconds: 600,
      },
      runtimeConfig,
    );

    expect(serialized).not.toMatch(/Secure/);
  });

  runCase("serializes expired cookie with configured domain", () => {
    const runtimeConfig = resolveAuthCookieRuntimeConfig(
      createConfigServiceMock({
        NODE_ENV: "production",
        AUTH_COOKIE_DOMAIN: ".example.com",
      }),
    );

    const serialized = serializeExpiredAuthCookie(runtimeConfig);

    expect(serialized).toMatch(new RegExp(`^${AUTH_COOKIE_NAME}=`));
    expect(serialized).toMatch(/Max-Age=0/);
    expect(serialized).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
    expect(serialized).toMatch(/Domain=\.example\.com/);
    expect(serialized).toMatch(/Secure/);
  });

  runCase("rejects invalid cookie domain", () => {
    expect(() =>
      resolveAuthCookieRuntimeConfig(
        createConfigServiceMock({
          NODE_ENV: "production",
          AUTH_COOKIE_DOMAIN: "https://example.com",
        }),
      ),
    ).toThrow(/Invalid AUTH_COOKIE_DOMAIN value/i);
  });

  runCase("extracts cookie token from header", () => {
    const token = extractAuthCookieToken({
      cookie: `other=value; ${AUTH_COOKIE_NAME}=encoded%20token; final=1`,
    });

    expect(token).toBe("encoded token");
  });
});
