import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { withEnv } from "../test/with-env";
import { InternalServerErrorException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { AppThrottlerStorage } from "./app-throttler.storage";

describe("AppThrottlerStorage", () => {
  runCase("uses in-memory mode", async () => {
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

        expect(first.totalHits).toBe(1);
        expect(first.isBlocked).toBe(false);
        expect(second.totalHits).toBe(2);
        expect(second.isBlocked).toBe(false);
        expect(third.totalHits).toBe(3);
        expect(third.isBlocked).toBe(true);
      },
    );
  });

  runCase("falls back to memory outside production when prisma model is missing", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        NODE_ENV: "test",
      },
      async () => {
        const storage = new AppThrottlerStorage({} as PrismaService);

        const first = await storage.increment("ip:2", 60_000, 1, 30_000, "default");
        const second = await storage.increment("ip:2", 60_000, 1, 30_000, "default");

        expect(first.isBlocked).toBe(false);
        expect(first.totalHits).toBe(1);
        expect(second.isBlocked).toBe(true);
        expect(second.totalHits).toBe(2);
      },
    );
  });

  runCase("fails fast in production when prisma model is missing", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        NODE_ENV: "production",
        AUTH_SECRET: "x".repeat(32),
        CORS_ORIGINS: "https://app.example.com",
      },
      async () => {
        const storage = new AppThrottlerStorage({} as PrismaService);

        await expect(
          storage.increment("ip:3", 60_000, 1, 30_000, "default"),
        ).rejects.toThrow();
      },
    );
  });

  runCase("serializes prisma bucket writes with transaction lock", async () => {
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

        expect(first.totalHits).toBe(1);
        expect(first.isBlocked).toBe(false);
        expect(second.totalHits).toBe(2);
        expect(second.isBlocked).toBe(true);
        expect(third.totalHits).toBe(2);
        expect(third.isBlocked).toBe(true);
        expect(lockQueryCount).toBe(3);
      },
    );
  });
});
