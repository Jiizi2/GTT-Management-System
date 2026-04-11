import assert from "node:assert/strict";
import { HttpException, HttpStatus } from "@nestjs/common";
import { AuthLoginRateLimiter } from "./auth-login-rate-limiter";

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testResolveKeysUsesDirectIpWhenProxyTrustIsDisabled(): void {
  const limiter = new AuthLoginRateLimiter({
    windowMs: 10_000,
    maxAttempts: 3,
    lockMs: 1_000,
    now: () => 0,
  });

  const keys = limiter.resolveKeys(" Admin.User@Example.Com ", {
    ip: "198.51.100.7",
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.20",
    },
  });

  assert.equal(keys.ipKey, "ip:198.51.100.7");
  assert.equal(keys.principalKey, "principal:198.51.100.7|admin.user@example.com");
}

function testResolveKeysUsesForwardedIpWhenProxyTrustIsEnabled(): void {
  const limiter = new AuthLoginRateLimiter({
    windowMs: 10_000,
    maxAttempts: 3,
    lockMs: 1_000,
    now: () => 0,
    trustProxyHeaders: true,
  });

  const keys = limiter.resolveKeys(" Admin.User@Example.Com ", {
    ip: "198.51.100.7",
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.20",
    },
  });

  assert.equal(keys.ipKey, "ip:203.0.113.10");
  assert.equal(keys.principalKey, "principal:203.0.113.10|admin.user@example.com");
}

function testLocksAfterMaxFailuresAndUnlocksAfterCooldown(): void {
  let nowEpochMs = 0;
  const limiter = new AuthLoginRateLimiter({
    windowMs: 60_000,
    maxAttempts: 3,
    lockMs: 2_000,
    now: () => nowEpochMs,
  });
  const keys = limiter.resolveKeys("ops@ghaniyatravel.com", {
    ip: "198.51.100.7",
  });

  limiter.assertAllowed(keys);
  limiter.registerFailure(keys);

  limiter.assertAllowed(keys);
  limiter.registerFailure(keys);

  limiter.assertAllowed(keys);
  limiter.registerFailure(keys);

  assert.throws(
    () => limiter.assertAllowed(keys),
    (error: unknown) => {
      assert.equal(error instanceof HttpException, true);
      assert.equal((error as HttpException).getStatus(), HttpStatus.TOO_MANY_REQUESTS);
      assert.match((error as Error).message, /Too many failed login attempts/i);
      return true;
    },
  );

  nowEpochMs += 2_100;
  assert.doesNotThrow(() => limiter.assertAllowed(keys));
}

function testIpLevelLockAppliesAcrossDifferentIdentifiers(): void {
  let nowEpochMs = 0;
  const limiter = new AuthLoginRateLimiter({
    windowMs: 60_000,
    maxAttempts: 3,
    lockMs: 5_000,
    now: () => nowEpochMs,
  });
  const request = {
    ip: "198.51.100.88",
  };
  const firstUserKeys = limiter.resolveKeys("first.user", request);
  const secondUserKeys = limiter.resolveKeys("second.user", request);

  limiter.registerFailure(firstUserKeys);
  limiter.registerFailure(firstUserKeys);
  limiter.registerFailure(secondUserKeys);

  assert.throws(
    () => limiter.assertAllowed(secondUserKeys),
    (error: unknown) => {
      assert.equal(error instanceof HttpException, true);
      assert.equal((error as HttpException).getStatus(), HttpStatus.TOO_MANY_REQUESTS);
      return true;
    },
  );

  nowEpochMs += 5_100;
  assert.doesNotThrow(() => limiter.assertAllowed(secondUserKeys));
}

async function main(): Promise<void> {
  await runCase(
    "auth login limiter prefers direct ip when proxy trust is disabled",
    testResolveKeysUsesDirectIpWhenProxyTrustIsDisabled,
  );
  await runCase(
    "auth login limiter resolves forwarded ip when proxy trust is enabled",
    testResolveKeysUsesForwardedIpWhenProxyTrustIsEnabled,
  );
  await runCase(
    "auth login limiter locks and unlocks by cooldown",
    testLocksAfterMaxFailuresAndUnlocksAfterCooldown,
  );
  await runCase(
    "auth login limiter applies ip lock across identifiers",
    testIpLevelLockAppliesAcrossDifferentIdentifiers,
  );
}

void main().catch((error: unknown) => {
  console.error("Auth login rate limiter test failed:", error);
  process.exitCode = 1;
});
