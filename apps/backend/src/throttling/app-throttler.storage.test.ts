import assert from "node:assert/strict";
import { InternalServerErrorException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { AppThrottlerStorage } from "./app-throttler.storage";

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testMemoryModeUsesInMemoryThrottleStorage(): Promise<void> {
  await withEnv(
    {
      DATA_SOURCE: "memory",
      NODE_ENV: "test",
    },
    async () => {
      const storage = new AppThrottlerStorage({} as PrismaService);

      const first = await storage.increment("ip:1", 60_000, 2, 30_000, "default");
      const second = await storage.increment("ip:1", 60_000, 2, 30_000, "default");
      const third = await storage.increment("ip:1", 60_000, 2, 30_000, "default");

      assert.equal(first.totalHits, 1);
      assert.equal(first.isBlocked, false);
      assert.equal(second.totalHits, 2);
      assert.equal(second.isBlocked, false);
      assert.equal(third.totalHits, 3);
      assert.equal(third.isBlocked, true);
    },
  );
}

async function testPrismaModeFallsBackToMemoryOutsideProductionWhenModelIsMissing(): Promise<void> {
  await withEnv(
    {
      DATA_SOURCE: "prisma",
      NODE_ENV: "test",
    },
    async () => {
      const storage = new AppThrottlerStorage({} as PrismaService);

      const first = await storage.increment("ip:2", 60_000, 1, 30_000, "default");
      const second = await storage.increment("ip:2", 60_000, 1, 30_000, "default");

      assert.equal(first.isBlocked, false);
      assert.equal(first.totalHits, 1);
      assert.equal(second.isBlocked, true);
      assert.equal(second.totalHits, 2);
    },
  );
}

async function testPrismaModeFailsFastInProductionWhenModelIsMissing(): Promise<void> {
  await withEnv(
    {
      DATA_SOURCE: "prisma",
      NODE_ENV: "production",
      AUTH_SECRET: "x".repeat(32),
      CORS_ORIGINS: "https://app.example.com",
    },
    async () => {
      const storage = new AppThrottlerStorage({} as PrismaService);

      await assert.rejects(
        () => storage.increment("ip:3", 60_000, 1, 30_000, "default"),
        (error: unknown) => {
          assert.equal(error instanceof InternalServerErrorException, true);
          assert.match(String((error as Error).message), /AppThrottleBucket/i);
          return true;
        },
      );
    },
  );
}

async function testPrismaModeSerializesBucketWritesWithTransactionLock(): Promise<void> {
  await withEnv(
    {
      DATA_SOURCE: "prisma",
      NODE_ENV: "test",
    },
    async () => {
      const state = new Map<
        string,
        {
          key: string;
          hitEpochMs: string[];
          blockedUntil: Date | null;
          lastSeenAt: Date;
        }
      >();
      let lockQueryCount = 0;

      const appThrottleBucket = {
        findUnique: async (args: {
          where: { key: string };
        }) => state.get(args.where.key) ?? null,
        upsert: async (args: {
          where: { key: string };
          update: {
            hitEpochMs: string[];
            blockedUntil?: Date | null;
            lastSeenAt: Date;
          };
          create: {
            key: string;
            hitEpochMs: string[];
            blockedUntil: Date | null;
            lastSeenAt: Date;
          };
        }) => {
          const existing = state.get(args.where.key);
          const nextRecord = existing
            ? {
                ...existing,
                hitEpochMs: args.update.hitEpochMs,
                blockedUntil:
                  args.update.blockedUntil !== undefined
                    ? args.update.blockedUntil
                    : existing.blockedUntil,
                lastSeenAt: args.update.lastSeenAt,
              }
            : args.create;
          state.set(args.where.key, nextRecord);
          return nextRecord;
        },
      };

      const prismaMock = {
        appThrottleBucket,
        $executeRaw: async (..._args: unknown[]) => {
          lockQueryCount += 1;
          return 1;
        },
        $transaction: async <T>(
          callback: (tx: {
            appThrottleBucket: typeof appThrottleBucket;
            $executeRaw: (...args: unknown[]) => Promise<number>;
          }) => Promise<T>,
        ) =>
          callback({
            appThrottleBucket,
            $executeRaw: async (..._args: unknown[]) => {
              lockQueryCount += 1;
              return 1;
            },
          }),
      } as unknown as PrismaService;

      const storage = new AppThrottlerStorage(prismaMock);

      const first = await storage.increment("ip:locked", 60_000, 1, 30_000, "default");
      const second = await storage.increment("ip:locked", 60_000, 1, 30_000, "default");
      const third = await storage.increment("ip:locked", 60_000, 1, 30_000, "default");

      assert.equal(first.totalHits, 1);
      assert.equal(first.isBlocked, false);
      assert.equal(second.totalHits, 2);
      assert.equal(second.isBlocked, true);
      assert.equal(third.totalHits, 2);
      assert.equal(third.isBlocked, true);
      assert.equal(lockQueryCount, 3);
    },
  );
}

async function main(): Promise<void> {
  await runCase("app throttler storage uses in-memory mode", testMemoryModeUsesInMemoryThrottleStorage);
  await runCase(
    "app throttler storage falls back to memory outside production when prisma model is missing",
    testPrismaModeFallsBackToMemoryOutsideProductionWhenModelIsMissing,
  );
  await runCase(
    "app throttler storage fails fast in production when prisma model is missing",
    testPrismaModeFailsFastInProductionWhenModelIsMissing,
  );
  await runCase(
    "app throttler storage serializes prisma bucket writes with transaction lock",
    testPrismaModeSerializesBucketWritesWithTransactionLock,
  );
}

void main().catch((error: unknown) => {
  console.error("App throttler storage test failed:", error);
  process.exitCode = 1;
});
