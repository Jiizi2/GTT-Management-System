import { HttpException, HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolveConfiguredBoolean, resolveConfiguredNumber } from "../config/app-config";
import { resolveClientIp } from "../http-origin";

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

@Injectable()
export class AuthLoginRateLimiter {
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly lockMs: number;
  private readonly now: () => number;
  private readonly trustProxyHeaders: boolean;
  private readonly buckets = new Map<string, LoginRateLimitBucket>();

  constructor(
    @Optional()
    @Inject("AUTH_LOGIN_RATE_LIMITER_OPTIONS")
    options?: Partial<LoginRateLimiterOptions>,
    @Optional() private readonly configService?: ConfigService,
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
  }

  resolveKeys(identifier: string, request: LoginRequestLike): LoginRateLimiterKeySet {
    const clientIp = resolveClientIp(request, {
      trustProxyHeaders: this.trustProxyHeaders,
    });
    const normalizedIdentifier = normalizeIdentifier(identifier);

    return {
      ipKey: `ip:${clientIp}`,
      principalKey: `principal:${clientIp}|${normalizedIdentifier}`,
    };
  }

  assertAllowed(keys: LoginRateLimiterKeySet): void {
    this.assertKeyAllowed(keys.ipKey);
    this.assertKeyAllowed(keys.principalKey);
  }

  registerFailure(keys: LoginRateLimiterKeySet): void {
    this.registerFailureForKey(keys.ipKey);
    this.registerFailureForKey(keys.principalKey);
    this.compact();
  }

  registerSuccess(keys: LoginRateLimiterKeySet): void {
    // Keep IP-level telemetry to avoid clearing broad abuse indicators.
    this.buckets.delete(keys.principalKey);
    this.compact();
  }

  private assertKeyAllowed(key: string): void {
    const nowEpochMs = this.now();
    const bucket = this.getBucket(key, nowEpochMs);
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
