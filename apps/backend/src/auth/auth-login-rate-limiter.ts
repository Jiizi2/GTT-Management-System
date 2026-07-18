import { HttpException, HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  resolveConfiguredBoolean,
  resolveConfiguredDataSource,
  resolveConfiguredNumber,
} from "../config/app-config";
import { resolveClientIp } from "../http-origin";
import { PrismaService } from "../prisma/prisma.service";

type LoginRateLimitBucket = {
  failedAttemptTimestamps: number[];
  lockedUntilEpochMs: number;
  lastSeenEpochMs: number;
};

type LoginRateLimiterOptions = {
  windowMs: number;
  maxAttempts: number;
  lockMs: number;
  now: () => number;
  trustProxyHeaders: boolean;
};

type LoginRequestLike = {
  headers?: Record<string, unknown>;
  ip?: string;
  socket?: {
    remoteAddress?: string | null;
  };
};

type PrismaLoginRateLimitBucketRecord = {
  key: string;
  failedAttemptEpochMs: string[];
  lockedUntil: Date | null;
  lastSeenAt: Date;
};

type PrismaLoginRateLimitBucketModel = {
  deleteMany: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  findUnique: (args: unknown) => Promise<PrismaLoginRateLimitBucketRecord | null>;
  update: (args: unknown) => Promise<unknown>;
  upsert: (args: unknown) => Promise<unknown>;
};

type PrismaLoginRateLimitClient = {
  authLoginRateLimitBucket: PrismaLoginRateLimitBucketModel;
  $executeRaw: (...args: unknown[]) => Promise<unknown>;
  $transaction: <T>(callback: (tx: PrismaLoginRateLimitClient) => Promise<T>) => Promise<T>;
};

export type LoginRateLimiterKeySet = {
  ipKey: string;
  principalKey: string;
};

const DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 8;
const DEFAULT_LOGIN_RATE_LIMIT_LOCK_MS = 5 * 60_000;

function resolveWindowMs(): number {
  return DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS;
}

function resolveMaxAttempts(): number {
  return DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
}

function resolveLockMs(): number {
  return DEFAULT_LOGIN_RATE_LIMIT_LOCK_MS;
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase() || "unknown";
}

function parseStoredEpochMsValues(values: string[]): number[] {
  return values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value >= 0);
}

function toStoredEpochMsValues(values: number[]): string[] {
  return values.map((value) => String(Math.max(0, Math.floor(value))));
}

function resolveOrderedPrismaBucketKeys(keys: LoginRateLimiterKeySet): string[] {
  return [keys.ipKey, keys.principalKey].sort((left, right) => left.localeCompare(right));
}

@Injectable()
export class AuthLoginRateLimiter {
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly lockMs: number;
  private readonly now: () => number;
  private readonly trustProxyHeaders: boolean;
  private readonly dataSource: "memory" | "prisma";
  private readonly buckets = new Map<string, LoginRateLimitBucket>();

  constructor(
    @Optional()
    @Inject("AUTH_LOGIN_RATE_LIMITER_OPTIONS")
    options?: Partial<LoginRateLimiterOptions>,
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject(PrismaService) private readonly prisma?: PrismaService,
  ) {
    this.windowMs =
      options?.windowMs ??
      Math.max(
        1_000,
        resolveConfiguredNumber(
          this.configService,
          "AUTH_LOGIN_RATE_LIMIT_WINDOW_MS",
          resolveWindowMs(),
        ),
      );
    this.maxAttempts =
      options?.maxAttempts ??
      Math.max(
        1,
        resolveConfiguredNumber(
          this.configService,
          "AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS",
          resolveMaxAttempts(),
        ),
      );
    this.lockMs =
      options?.lockMs ??
      Math.max(
        1_000,
        resolveConfiguredNumber(
          this.configService,
          "AUTH_LOGIN_RATE_LIMIT_LOCK_MS",
          resolveLockMs(),
        ),
      );
    this.now = options?.now ?? (() => Date.now());
    this.trustProxyHeaders =
      options?.trustProxyHeaders ??
      resolveConfiguredBoolean(this.configService, "TRUST_PROXY") === true;
    this.dataSource = resolveConfiguredDataSource(this.configService);
  }

  resolveKeys(
    identifier: string,
    request: LoginRequestLike,
    namespace = "",
  ): LoginRateLimiterKeySet {
    const clientIp = resolveClientIp(request, {
      trustProxyHeaders: this.trustProxyHeaders,
    });
    const normalizedIdentifier = normalizeIdentifier(identifier);

    const prefix = namespace.trim().toLowerCase();
    const keyPrefix = prefix ? `${prefix}:` : "";
    return {
      ipKey: `${keyPrefix}ip:${clientIp}`,
      principalKey: `${keyPrefix}principal:${clientIp}|${normalizedIdentifier}`,
    };
  }

  async assertAllowed(keys: LoginRateLimiterKeySet): Promise<void> {
    await this.assertKeyAllowed(keys.ipKey);
    await this.assertKeyAllowed(keys.principalKey);
  }

  async registerFailure(keys: LoginRateLimiterKeySet): Promise<void> {
    if (this.usesPrismaStorage()) {
      await this.registerFailureWithPrisma(keys);
      return;
    }

    this.registerFailureForKey(keys.ipKey);
    this.registerFailureForKey(keys.principalKey);
    this.compact();
  }

  async registerSuccess(keys: LoginRateLimiterKeySet): Promise<void> {
    if (this.usesPrismaStorage()) {
      await this.registerSuccessWithPrisma(keys);
      return;
    }

    // Keep IP-level telemetry to avoid clearing broad abuse indicators.
    this.buckets.delete(keys.principalKey);
    this.compact();
  }

  private usesPrismaStorage(): boolean {
    return this.dataSource === "prisma" && Boolean(this.prisma);
  }

  private getPrismaClientOrThrow(): PrismaLoginRateLimitClient {
    if (!this.prisma) {
      throw new Error("PrismaService is required when DATA_SOURCE=prisma.");
    }

    return this.prisma as unknown as PrismaLoginRateLimitClient;
  }

  private async assertKeyAllowed(key: string): Promise<void> {
    const nowEpochMs = this.now();
    const bucket = this.usesPrismaStorage()
      ? await this.getBucketFromPrisma(key, nowEpochMs)
      : this.getBucket(key, nowEpochMs);
    if (bucket.lockedUntilEpochMs <= nowEpochMs) {
      return;
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.lockedUntilEpochMs - nowEpochMs) / 1_000),
    );
    throw new HttpException(
      `Too many failed login attempts. Retry after ${retryAfterSeconds} seconds.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private registerFailureForKey(key: string): void {
    const nowEpochMs = this.now();
    const bucket = this.getBucket(key, nowEpochMs);
    bucket.failedAttemptTimestamps.push(nowEpochMs);
    this.pruneOldAttempts(bucket, nowEpochMs);
    bucket.lastSeenEpochMs = nowEpochMs;

    if (bucket.failedAttemptTimestamps.length >= this.maxAttempts) {
      bucket.lockedUntilEpochMs = Math.max(bucket.lockedUntilEpochMs, nowEpochMs + this.lockMs);
      bucket.failedAttemptTimestamps = [];
    }
  }

  private getBucket(key: string, nowEpochMs: number): LoginRateLimitBucket {
    const existing = this.buckets.get(key);
    if (!existing) {
      const nextBucket: LoginRateLimitBucket = {
        failedAttemptTimestamps: [],
        lockedUntilEpochMs: 0,
        lastSeenEpochMs: nowEpochMs,
      };
      this.buckets.set(key, nextBucket);
      return nextBucket;
    }

    this.pruneOldAttempts(existing, nowEpochMs);
    existing.lastSeenEpochMs = nowEpochMs;
    return existing;
  }

  private async getBucketFromPrisma(key: string, nowEpochMs: number): Promise<LoginRateLimitBucket> {
    const bucket = await this.getPrismaClientOrThrow().authLoginRateLimitBucket.findUnique({
      where: {
        key,
      },
      select: {
        key: true,
        failedAttemptEpochMs: true,
        lockedUntil: true,
        lastSeenAt: true,
      },
    });

    return this.mapPrismaBucketToMemory(bucket, nowEpochMs);
  }

  private mapPrismaBucketToMemory(
    bucket: PrismaLoginRateLimitBucketRecord | null,
    nowEpochMs: number,
  ): LoginRateLimitBucket {
    if (!bucket) {
      return {
        failedAttemptTimestamps: [],
        lockedUntilEpochMs: 0,
        lastSeenEpochMs: nowEpochMs,
      };
    }

    const mapped: LoginRateLimitBucket = {
      failedAttemptTimestamps: parseStoredEpochMsValues(bucket.failedAttemptEpochMs),
      lockedUntilEpochMs: bucket.lockedUntil?.getTime() ?? 0,
      lastSeenEpochMs: bucket.lastSeenAt.getTime(),
    };
    this.pruneOldAttempts(mapped, nowEpochMs);
    mapped.lastSeenEpochMs = Math.max(mapped.lastSeenEpochMs, nowEpochMs);
    return mapped;
  }

  private toPrismaBucketWriteData(
    key: string,
    bucket: LoginRateLimitBucket,
  ): {
    where: { key: string };
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
  } {
    const lastSeenAt = new Date(bucket.lastSeenEpochMs);
    return {
      where: {
        key,
      },
      create: {
        key,
        failedAttemptEpochMs: toStoredEpochMsValues(bucket.failedAttemptTimestamps),
        lockedUntil: bucket.lockedUntilEpochMs > 0 ? new Date(bucket.lockedUntilEpochMs) : null,
        lastSeenAt,
      },
      update: {
        failedAttemptEpochMs: toStoredEpochMsValues(bucket.failedAttemptTimestamps),
        lockedUntil: bucket.lockedUntilEpochMs > 0 ? new Date(bucket.lockedUntilEpochMs) : null,
        lastSeenAt,
      },
    };
  }

  private async registerFailureWithPrisma(keys: LoginRateLimiterKeySet): Promise<void> {
    const nowEpochMs = this.now();
    const prismaClient = this.getPrismaClientOrThrow();
    const orderedKeys = resolveOrderedPrismaBucketKeys(keys);

    await prismaClient.$transaction(async (tx) => {
      for (const key of orderedKeys) {
        await this.acquirePrismaBucketLock(tx, key);
      }

      for (const key of orderedKeys) {
        const existing = await tx.authLoginRateLimitBucket.findUnique({
          where: {
            key,
          },
          select: {
            key: true,
            failedAttemptEpochMs: true,
            lockedUntil: true,
            lastSeenAt: true,
          },
        });
        const bucket = this.mapPrismaBucketToMemory(existing, nowEpochMs);
        bucket.failedAttemptTimestamps.push(nowEpochMs);
        this.pruneOldAttempts(bucket, nowEpochMs);
        bucket.lastSeenEpochMs = nowEpochMs;

        if (bucket.failedAttemptTimestamps.length >= this.maxAttempts) {
          bucket.lockedUntilEpochMs = Math.max(bucket.lockedUntilEpochMs, nowEpochMs + this.lockMs);
          bucket.failedAttemptTimestamps = [];
        }

        await tx.authLoginRateLimitBucket.upsert(this.toPrismaBucketWriteData(key, bucket));
      }

      await this.compactPrisma(tx, nowEpochMs);
    });
  }

  private async registerSuccessWithPrisma(keys: LoginRateLimiterKeySet): Promise<void> {
    const nowEpochMs = this.now();
    const prismaClient = this.getPrismaClientOrThrow();
    const orderedKeys = resolveOrderedPrismaBucketKeys(keys);

    await prismaClient.$transaction(async (tx) => {
      for (const key of orderedKeys) {
        await this.acquirePrismaBucketLock(tx, key);
      }

      const ipBucket = await tx.authLoginRateLimitBucket.findUnique({
        where: {
          key: keys.ipKey,
        },
        select: {
          key: true,
          failedAttemptEpochMs: true,
          lockedUntil: true,
          lastSeenAt: true,
        },
      });
      if (ipBucket) {
        const normalizedBucket = this.mapPrismaBucketToMemory(ipBucket, nowEpochMs);
        normalizedBucket.lastSeenEpochMs = nowEpochMs;
        await tx.authLoginRateLimitBucket.update({
          where: {
            key: keys.ipKey,
          },
          data: this.toPrismaBucketWriteData(keys.ipKey, normalizedBucket).update,
        });
      }

      await tx.authLoginRateLimitBucket.deleteMany({
        where: {
          key: keys.principalKey,
        },
      });
      await this.compactPrisma(tx, nowEpochMs);
    });
  }

  private async acquirePrismaBucketLock(
    prismaClient: Pick<PrismaLoginRateLimitClient, "$executeRaw">,
    key: string,
  ): Promise<void> {
    // Lock each bucket key in a stable order so concurrent login writes do not lose attempts.
    await prismaClient.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${AuthLoginRateLimiter.name}), hashtext(${key}))
    `;
  }

  private async compactPrisma(
    tx: PrismaLoginRateLimitClient,
    nowEpochMs: number,
  ): Promise<void> {
    const staleThreshold = nowEpochMs - Math.max(this.windowMs, this.lockMs) * 2;
    await tx.authLoginRateLimitBucket.deleteMany({
      where: {
        lastSeenAt: {
          lt: new Date(staleThreshold),
        },
        OR: [
          {
            lockedUntil: null,
          },
          {
            lockedUntil: {
              lte: new Date(nowEpochMs),
            },
          },
        ],
      },
    });
  }

  private pruneOldAttempts(bucket: LoginRateLimitBucket, nowEpochMs: number): void {
    const threshold = nowEpochMs - this.windowMs;
    bucket.failedAttemptTimestamps = bucket.failedAttemptTimestamps.filter(
      (timestamp) => timestamp >= threshold,
    );

    if (bucket.lockedUntilEpochMs <= nowEpochMs) {
      bucket.lockedUntilEpochMs = 0;
    }
  }

  private compact(): void {
    const nowEpochMs = this.now();
    const staleThreshold = nowEpochMs - Math.max(this.windowMs, this.lockMs) * 2;
    for (const [key, bucket] of this.buckets.entries()) {
      this.pruneOldAttempts(bucket, nowEpochMs);

      const shouldKeepLockedBucket = bucket.lockedUntilEpochMs > nowEpochMs;
      const hasRecentAttempts = bucket.failedAttemptTimestamps.length > 0;
      const wasRecentlySeen = bucket.lastSeenEpochMs >= staleThreshold;

      if (shouldKeepLockedBucket || hasRecentAttempts || wasRecentlySeen) {
        continue;
      }

      this.buckets.delete(key);
    }
  }
}
