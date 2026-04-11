import assert from "node:assert/strict";
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

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testSerializesProductionCookieWithSecureDomainAndExpiry(): void {
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

  assert.match(serialized, new RegExp(`^${AUTH_COOKIE_NAME}=header\\.payload\\.signature`));
  assert.match(serialized, /HttpOnly/);
  assert.match(serialized, /SameSite=Lax/);
  assert.match(serialized, /Priority=High/);
  assert.match(serialized, /Secure/);
  assert.match(serialized, /Domain=\.example\.com/);
  assert.match(serialized, /Max-Age=120/);
  assert.match(serialized, /Expires=/);
}

function testSerializesSessionCookieWithoutDomainOrPersistentExpiry(): void {
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

  assert.doesNotMatch(serialized, /Secure/);
  assert.doesNotMatch(serialized, /Domain=/);
  assert.doesNotMatch(serialized, /Max-Age=/);
  assert.doesNotMatch(serialized, /Expires=/);
}

function testSerializesExpiredCookieWithConfiguredDomain(): void {
  const runtimeConfig = resolveAuthCookieRuntimeConfig(
    createConfigServiceMock({
      NODE_ENV: "production",
      AUTH_COOKIE_DOMAIN: ".example.com",
    }),
  );

  const serialized = serializeExpiredAuthCookie(runtimeConfig);

  assert.match(serialized, new RegExp(`^${AUTH_COOKIE_NAME}=`));
  assert.match(serialized, /Max-Age=0/);
  assert.match(serialized, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/);
  assert.match(serialized, /Domain=\.example\.com/);
  assert.match(serialized, /Secure/);
}

function testRejectsInvalidCookieDomain(): void {
  assert.throws(
    () =>
      resolveAuthCookieRuntimeConfig(
        createConfigServiceMock({
          NODE_ENV: "production",
          AUTH_COOKIE_DOMAIN: "https://example.com",
        }),
      ),
    /Invalid AUTH_COOKIE_DOMAIN value/i,
  );
}

function testExtractsCookieTokenFromHeader(): void {
  const token = extractAuthCookieToken({
    cookie: `other=value; ${AUTH_COOKIE_NAME}=encoded%20token; final=1`,
  });

  assert.equal(token, "encoded token");
}

async function main(): Promise<void> {
  await runCase(
    "auth cookie serializes production cookie with secure domain and expiry",
    testSerializesProductionCookieWithSecureDomainAndExpiry,
  );
  await runCase(
    "auth cookie serializes session cookie without domain or persistent expiry",
    testSerializesSessionCookieWithoutDomainOrPersistentExpiry,
  );
  await runCase(
    "auth cookie serializes expired cookie with configured domain",
    testSerializesExpiredCookieWithConfiguredDomain,
  );
  await runCase("auth cookie rejects invalid cookie domain", testRejectsInvalidCookieDomain);
  await runCase("auth cookie extracts cookie token from header", testExtractsCookieTokenFromHeader);
}

void main().catch((error: unknown) => {
  console.error("Auth cookie test failed:", error);
  process.exitCode = 1;
});
