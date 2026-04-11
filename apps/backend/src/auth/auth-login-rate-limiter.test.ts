import assert from "node:assert/strict";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthLoginRateLimiter } from "./auth-login-rate-limiter";

async function runCase(name: string, fn: () => Promise<void> | void): Promise<void> {
  await fn();
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

async function testLocksAfterMaxFailuresAndUnlocksAfterCooldown(): Promise<void> {
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

  await limiter.assertAllowed(keys);
  await limiter.registerFailure(keys);

  await limiter.assertAllowed(keys);
  await limiter.registerFailure(keys);

  await limiter.assertAllowed(keys);
  await limiter.registerFailure(keys);

  await assert.rejects(
    () => limiter.assertAllowed(keys),
    (error: unknown) => {
      assert.equal(error instanceof HttpException, true);
      assert.equal((error as HttpException).getStatus(), HttpStatus.TOO_MANY_REQUESTS);
      assert.match((error as Error).message, /Too many failed login attempts/i);
      return true;
    },
  );

  nowEpochMs += 2_100;
  await assert.doesNotReject(() => limiter.assertAllowed(keys));
}

async function testIpLevelLockAppliesAcrossDifferentIdentifiers(): Promise<void> {
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

  await limiter.registerFailure(firstUserKeys);
  await limiter.registerFailure(firstUserKeys);
  await limiter.registerFailure(secondUserKeys);

  await assert.rejects(
    () => limiter.assertAllowed(secondUserKeys),
    (error: unknown) => {
      assert.equal(error instanceof HttpException, true);
      assert.equal((error as HttpException).getStatus(), HttpStatus.TOO_MANY_REQUESTS);
      return true;
    },
  );

  nowEpochMs += 5_100;
  await assert.doesNotReject(() => limiter.assertAllowed(secondUserKeys));
}

async function withDataSource<T>(
  dataSource: "memory" | "prisma",
  fn: () => Promise<T>,
): Promise<T> {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = dataSource;
  try {
    return await fn();
  } finally {
    if (previousDataSource === undefined) {
      delete process.env.DATA_SOURCE;
    } else {
      process.env.DATA_SOURCE = previousDataSource;
    }
  }
}

function createPrismaRateLimitMock(): PrismaService & {
  __state: Map<string, {
    key: string;
    failedAttemptEpochMs: string[];
    lockedUntil: Date | null;
    lastSeenAt: Date;
  }>;
} {
  const state = new Map<string, {
    key: string;
    failedAttemptEpochMs: string[];
    lockedUntil: Date | null;
    lastSeenAt: Date;
  }>();

  const authLoginRateLimitBucket = {
    findUnique: async (args: {
      where: {
        key: string;
      };
    }) => state.get(args.where.key) ?? null,
    update: async (args: {
      where: {
        key: string;
      };
      data: {
        failedAttemptEpochMs: string[];
        lockedUntil: Date | null;
        lastSeenAt: Date;
      };
    }) => {
      const current = state.get(args.where.key);
      if (!current) {
        throw new Error(`Bucket '${args.where.key}' not found.`);
      }

      const next = {
        ...current,
        ...args.data,
      };
      state.set(args.where.key, next);
      return next;
    },
    upsert: async (args: {
      where: {
        key: string;
      };
      create: {
        key: string;
        failedAttemptEpochMs: string[];
        lockedUntil: Date | null;
        lastSeenAt: Date;
      };
      update: {
        failedAttemptEpochMs: string[];
        lockedUntil: Date | null;
        lastSeenAt: Date;
      };
    }) => {
      const existing = state.get(args.where.key);
      const next = existing
        ? {
            ...existing,
            ...args.update,
          }
        : {
            ...args.create,
          };
      state.set(args.where.key, next);
      return next;
    },
    deleteMany: async (args: {
      where?: {
        key?: string;
        lastSeenAt?: { lt: Date };
        OR?: Array<{ lockedUntil: null } | { lockedUntil: { lte: Date } }>;
      };
    }) => {
      if (args.where?.key) {
        const deleted = state.delete(args.where.key) ? 1 : 0;
        return { count: deleted };
      }

      let deletedCount = 0;
      for (const [key, bucket] of state.entries()) {
        const isStale =
          args.where?.lastSeenAt?.lt ? bucket.lastSeenAt < args.where.lastSeenAt.lt : true;
        const matchesLockCondition =
          args.where?.OR?.some((entry) => {
            if ("lockedUntil" in entry && entry.lockedUntil === null) {
              return bucket.lockedUntil === null;
            }

            if ("lockedUntil" in entry && entry.lockedUntil && "lte" in entry.lockedUntil) {
              return bucket.lockedUntil !== null && bucket.lockedUntil <= entry.lockedUntil.lte;
            }

            return false;
          }) ?? true;

        if (!isStale || !matchesLockCondition) {
          continue;
        }

        state.delete(key);
        deletedCount += 1;
      }

      return { count: deletedCount };
    },
  };

  const prismaMock = {
    authLoginRateLimitBucket,
    $transaction: async <T>(callback: (tx: {
      authLoginRateLimitBucket: typeof authLoginRateLimitBucket;
    }) => Promise<T>) =>
      callback({
        authLoginRateLimitBucket,
      }),
    __state: state,
  } as unknown as PrismaService & {
    __state: typeof state;
  };

  return prismaMock;
}

async function testPrismaStoragePersistsAndClearsPrincipalBucket(): Promise<void> {
  await withDataSource("prisma", async () => {
    let nowEpochMs = 0;
    const prismaMock = createPrismaRateLimitMock();
    const limiter = new AuthLoginRateLimiter({
      windowMs: 60_000,
      maxAttempts: 3,
      lockMs: 5_000,
      now: () => nowEpochMs,
    }, undefined, prismaMock);

    const keys = limiter.resolveKeys("ops@ghaniyatravel.com", {
      ip: "198.51.100.77",
    });

    await limiter.registerFailure(keys);
    await limiter.registerFailure(keys);
    assert.equal(prismaMock.__state.has(keys.ipKey), true);
    assert.equal(prismaMock.__state.has(keys.principalKey), true);

    await limiter.registerSuccess(keys);
    assert.equal(prismaMock.__state.has(keys.ipKey), true);
    assert.equal(prismaMock.__state.has(keys.principalKey), false);

    await limiter.registerFailure(keys);
    await limiter.registerFailure(keys);
    await limiter.registerFailure(keys);

    await assert.rejects(
      () => limiter.assertAllowed(keys),
      (error: unknown) => {
        assert.equal(error instanceof HttpException, true);
        assert.equal((error as HttpException).getStatus(), HttpStatus.TOO_MANY_REQUESTS);
        return true;
      },
    );

    nowEpochMs += 5_100;
    await assert.doesNotReject(() => limiter.assertAllowed(keys));
  });
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
  await runCase(
    "auth login limiter persists prisma buckets and clears principal bucket on success",
    testPrismaStoragePersistsAndClearsPrincipalBucket,
  );
}

void main().catch((error: unknown) => {
  console.error("Auth login rate limiter test failed:", error);
  process.exitCode = 1;
});
