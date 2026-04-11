import { InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from "@nestjs/throttler";
import {
  resolveConfiguredDataSource,
  resolveConfiguredNodeEnv,
} from "../config/app-config";
import { createStructuredLogger } from "../logging/create-structured-logger";
import { PrismaService } from "../prisma/prisma.service";

type AppThrottleBucketRecord = {
  key: string;
  hitEpochMs: string[];
  blockedUntil: Date | null;
};

type AppThrottlerStorageRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

type AppThrottleBucketModel = {
  findUnique: (args: unknown) => Promise<AppThrottleBucketRecord | null>;
  upsert: (args: unknown) => Promise<AppThrottleBucketRecord>;
};

function normalizeHitEpochMs(values: string[]): number[] {
  return values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
}

function toThrottleStorageRecord(args: {
  hits: number[];
  nowEpochMs: number;
  blockedUntilEpochMs: number | null;
  ttlMs: number;
}): AppThrottlerStorageRecord {
  const { hits, nowEpochMs, blockedUntilEpochMs, ttlMs } = args;
  const firstHitEpochMs = hits[0] ?? nowEpochMs;
  const timeToExpire = hits.length
    ? Math.max(0, Math.ceil((firstHitEpochMs + ttlMs - nowEpochMs) / 1000))
    : 0;
  const isBlocked = typeof blockedUntilEpochMs === "number" && blockedUntilEpochMs > nowEpochMs;
  const timeToBlockExpire = isBlocked
    ? Math.max(0, Math.ceil((blockedUntilEpochMs - nowEpochMs) / 1000))
    : 0;

  return {
    totalHits: hits.length,
    timeToExpire,
    isBlocked,
    timeToBlockExpire,
  };
}

function isThrottleBucketTableMissing(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021") {
    return false;
  }

  const tableName = (error.meta as { table?: unknown } | undefined)?.table;
  return typeof tableName === "string" && tableName.includes("AppThrottleBucket");
}

export class AppThrottlerStorage implements ThrottlerStorage {
  private readonly dataSource: "memory" | "prisma";
  private readonly nodeEnv: string;
  private readonly memoryStorage = new ThrottlerStorageService();
  private readonly logger = createStructuredLogger(AppThrottlerStorage.name);
  private prismaFallbackReason: "missing-client" | "missing-table" | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.dataSource = resolveConfiguredDataSource(this.configService);
    this.nodeEnv = resolveConfiguredNodeEnv(this.configService);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<AppThrottlerStorageRecord> {
    if (this.dataSource !== "prisma") {
      return this.memoryStorage.increment(key, ttl, limit, blockDuration, throttlerName);
    }

    if (this.prismaFallbackReason !== null) {
      return this.handlePrismaFallback(key, ttl, limit, blockDuration, throttlerName);
    }

    try {
      return await this.incrementWithPrisma(key, ttl, limit, blockDuration);
    } catch (error: unknown) {
      if (this.isMissingClientModelError(error)) {
        return this.handlePrismaStorageUnavailable("missing-client", key, ttl, limit, blockDuration, throttlerName);
      }

      if (isThrottleBucketTableMissing(error)) {
        return this.handlePrismaStorageUnavailable("missing-table", key, ttl, limit, blockDuration, throttlerName);
      }

      throw error;
    }
  }

  private async incrementWithPrisma(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<AppThrottlerStorageRecord> {
    const nowEpochMs = Date.now();
    const model = this.getPrismaThrottleBucketModelOrThrow();
    const currentRecord = await model.findUnique({
      where: {
        key,
      },
      select: {
        key: true,
        hitEpochMs: true,
        blockedUntil: true,
      },
    });

    const windowStartEpochMs = nowEpochMs - ttl;
    const hits = normalizeHitEpochMs(currentRecord?.hitEpochMs ?? []).filter(
      (value) => value > windowStartEpochMs,
    );
    const blockedUntilEpochMs = currentRecord?.blockedUntil?.getTime() ?? null;
    const isBlocked = typeof blockedUntilEpochMs === "number" && blockedUntilEpochMs > nowEpochMs;

    if (isBlocked) {
      await model.upsert({
        where: {
          key,
        },
        update: {
          hitEpochMs: hits.map(String),
          lastSeenAt: new Date(nowEpochMs),
        },
        create: {
          key,
          hitEpochMs: hits.map(String),
          blockedUntil: currentRecord?.blockedUntil ?? null,
          lastSeenAt: new Date(nowEpochMs),
        },
      });

      return toThrottleStorageRecord({
        hits,
        nowEpochMs,
        blockedUntilEpochMs,
        ttlMs: ttl,
      });
    }

    const nextHits = [...hits, nowEpochMs];
    const nextBlockedUntil =
      nextHits.length > limit ? new Date(nowEpochMs + blockDuration) : null;

    await model.upsert({
      where: {
        key,
      },
      update: {
        hitEpochMs: nextHits.map(String),
        blockedUntil: nextBlockedUntil,
        lastSeenAt: new Date(nowEpochMs),
      },
      create: {
        key,
        hitEpochMs: nextHits.map(String),
        blockedUntil: nextBlockedUntil,
        lastSeenAt: new Date(nowEpochMs),
      },
    });

    return toThrottleStorageRecord({
      hits: nextHits,
      nowEpochMs,
      blockedUntilEpochMs: nextBlockedUntil?.getTime() ?? null,
      ttlMs: ttl,
    });
  }

  private getPrismaThrottleBucketModelOrThrow(): AppThrottleBucketModel {
    const prismaRecord = this.prisma as unknown as Record<string, unknown>;
    const model = prismaRecord.appThrottleBucket;

    if (!model || typeof model !== "object") {
      throw new InternalServerErrorException(
        "Prisma client belum memuat model AppThrottleBucket. Jalankan `npm run db:generate --workspace backend`, lalu restart backend.",
      );
    }

    return model as AppThrottleBucketModel;
  }

  private isMissingClientModelError(error: unknown): boolean {
    if (!(error instanceof InternalServerErrorException)) {
      return false;
    }

    const response = error.getResponse();
    const message =
      typeof response === "string"
        ? response
        : typeof response === "object" && response && "message" in response
          ? String((response as { message?: unknown }).message ?? "")
          : "";

    return message.includes("Prisma client belum memuat model AppThrottleBucket");
  }

  private async handlePrismaStorageUnavailable(
    reason: "missing-client" | "missing-table",
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<AppThrottlerStorageRecord> {
    if (this.nodeEnv === "production") {
      throw this.createPrismaStorageUnavailableError(reason);
    }

    if (this.prismaFallbackReason === null) {
      this.prismaFallbackReason = reason;
      this.logger.warn(
        {
          reason,
        },
        "Global throttler storage is falling back to in-memory mode because Prisma storage is not ready.",
      );
    }

    return this.handlePrismaFallback(key, ttl, limit, blockDuration, throttlerName);
  }

  private async handlePrismaFallback(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<AppThrottlerStorageRecord> {
    return this.memoryStorage.increment(key, ttl, limit, blockDuration, throttlerName);
  }

  private createPrismaStorageUnavailableError(
    reason: "missing-client" | "missing-table",
  ): InternalServerErrorException {
    if (reason === "missing-client") {
      return new InternalServerErrorException(
        "Prisma client belum memuat model AppThrottleBucket. Jalankan `npm run db:generate --workspace backend`, lalu restart backend.",
      );
    }

    return new InternalServerErrorException(
      "Tabel AppThrottleBucket belum ada di database. Jalankan `npm run db:migrate:backend`, lalu restart backend.",
    );
  }
}
