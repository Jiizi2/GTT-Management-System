import assert from "node:assert/strict";
import type { ConfigService } from "@nestjs/config";
import { RuntimeRetentionService } from "./runtime-retention.service";

function createConfigService(
  values: Record<string, string | number | boolean | undefined>,
): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

async function main(): Promise<void> {
  {
    let deleted = false;
    const prisma = {
      groupAuditLog: {
        deleteMany: async () => {
          deleted = true;
          return { count: 0 };
        },
      },
      authLoginRateLimitBucket: {
        deleteMany: async () => ({ count: 0 }),
      },
      appThrottleBucket: {
        deleteMany: async () => ({ count: 0 }),
      },
    };

    const service = new RuntimeRetentionService(
      prisma as never,
      createConfigService({
        DATA_SOURCE: "memory",
        NODE_ENV: "test",
        RUNTIME_RETENTION_ENABLED: true,
      }),
      {
        now: () => Date.UTC(2026, 3, 12, 12, 0, 0),
      },
    );

    await service.runCleanupNow();
    assert.equal(deleted, false);
  }

  {
    const calls: Array<{ model: string; args: unknown }> = [];
    const prisma = {
      groupAuditLog: {
        deleteMany: async (args: unknown) => {
          calls.push({ model: "groupAuditLog", args });
          return { count: 4 };
        },
      },
      authLoginRateLimitBucket: {
        deleteMany: async (args: unknown) => {
          calls.push({ model: "authLoginRateLimitBucket", args });
          return { count: 2 };
        },
      },
      appThrottleBucket: {
        deleteMany: async (args: unknown) => {
          calls.push({ model: "appThrottleBucket", args });
          return { count: 1 };
        },
      },
    };

    const nowEpochMs = Date.UTC(2026, 3, 12, 12, 0, 0);
    const service = new RuntimeRetentionService(
      prisma as never,
      createConfigService({
        DATA_SOURCE: "prisma",
        NODE_ENV: "test",
        RUNTIME_RETENTION_ENABLED: true,
        GROUP_AUDIT_LOG_RETENTION_DAYS: 30,
        AUTH_LOGIN_RATE_LIMIT_RETENTION_DAYS: 7,
        APP_THROTTLE_BUCKET_RETENTION_DAYS: 3,
      }),
      {
        now: () => nowEpochMs,
      },
    );

    await service.runCleanupNow();

    assert.equal(calls.length, 3);
    assert.deepEqual(calls, [
      {
        model: "groupAuditLog",
        args: {
          where: {
            createdAt: {
              lt: new Date(nowEpochMs - 30 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
      {
        model: "authLoginRateLimitBucket",
        args: {
          where: {
            lastSeenAt: {
              lt: new Date(nowEpochMs - 7 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
      {
        model: "appThrottleBucket",
        args: {
          where: {
            lastSeenAt: {
              lt: new Date(nowEpochMs - 3 * 24 * 60 * 60 * 1000),
            },
          },
        },
      },
    ]);
  }
}

void main();
