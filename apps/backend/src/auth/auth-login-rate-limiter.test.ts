import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { withDataSource } from "../test/with-data-source";
import { HttpException, HttpStatus } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { AuthLoginRateLimiter } from "./auth-login-rate-limiter";

function createPrismaRateLimitMock(): PrismaService & {
  __state: Map<string, {
    key: string;
    failedAttemptEpochMs: string[];
    lockedUntil: Date | null;
    lastSeenAt: Date;
  }>;
  __lockKeys: string[];
} {
  const state = new Map<string, {
    key: string;
    failedAttemptEpochMs: string[];
    lockedUntil: Date | null;
    lastSeenAt: Date;
  }>();
  const lockKeys: string[] = [];

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

  const executeRaw = async (...args: unknown[]) => {
    const key = args.length > 2 ? String(args[2] ?? "") : "";
    if (key) {
      lockKeys.push(key);
    }

    return 1;
  };

  const prismaMock = {
    authLoginRateLimitBucket,
    $executeRaw: executeRaw,
    $transaction: async <T>(callback: (tx: {
      authLoginRateLimitBucket: typeof authLoginRateLimitBucket;
      $executeRaw: typeof executeRaw;
    }) => Promise<T>) =>
      callback({
        authLoginRateLimitBucket,
        $executeRaw: executeRaw,
      }),
    __state: state,
    __lockKeys: lockKeys,
  } as unknown as PrismaService & {
    __state: typeof state;
    __lockKeys: typeof lockKeys;
  };

  return prismaMock;
}

describe("AuthLoginRateLimiter", () => {
  runCase("prefers direct ip when proxy trust is disabled", () => {
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

    expect(keys.ipKey).toBe("ip:198.51.100.7");
    expect(keys.principalKey).toBe("principal:198.51.100.7|admin.user@example.com");
  });

  runCase("resolves forwarded ip when proxy trust is enabled", () => {
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

    expect(keys.ipKey).toBe("ip:203.0.113.10");
    expect(keys.principalKey).toBe("principal:203.0.113.10|admin.user@example.com");
  });

  runCase("locks and unlocks by cooldown", async () => {
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

    await expect(limiter.assertAllowed(keys)).rejects.toThrow(
      /Too many failed login attempts/i,
    );

    nowEpochMs += 2_100;
    await expect(limiter.assertAllowed(keys)).resolves.toBeUndefined();
  });

  runCase("applies ip lock across identifiers", async () => {
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

    await expect(limiter.assertAllowed(secondUserKeys)).rejects.toThrow();

    nowEpochMs += 5_100;
    await expect(limiter.assertAllowed(secondUserKeys)).resolves.toBeUndefined();
  });

  runCase("persists prisma buckets and clears principal bucket on success", async () => {
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
      expect(prismaMock.__state.has(keys.ipKey)).toBe(true);
      expect(prismaMock.__state.has(keys.principalKey)).toBe(true);

      await limiter.registerSuccess(keys);
      expect(prismaMock.__state.has(keys.ipKey)).toBe(true);
      expect(prismaMock.__state.has(keys.principalKey)).toBe(false);

      await limiter.registerFailure(keys);
      await limiter.registerFailure(keys);
      await limiter.registerFailure(keys);

      await expect(limiter.assertAllowed(keys)).rejects.toThrow();

      nowEpochMs += 5_100;
      await expect(limiter.assertAllowed(keys)).resolves.toBeUndefined();
    });
  });

  runCase("locks prisma buckets in stable order", async () => {
    await withDataSource("prisma", async () => {
      const prismaMock = createPrismaRateLimitMock();
      const limiter = new AuthLoginRateLimiter({
        windowMs: 60_000,
        maxAttempts: 3,
        lockMs: 5_000,
        now: () => 0,
      }, undefined, prismaMock);

      const keys = limiter.resolveKeys("ops@ghaniyatravel.com", {
        ip: "198.51.100.77",
      });

      await limiter.registerFailure(keys);
      await limiter.registerSuccess(keys);

      expect(prismaMock.__lockKeys).toEqual([
        keys.ipKey,
        keys.principalKey,
        keys.ipKey,
        keys.principalKey,
      ]);
    });
  });
});
