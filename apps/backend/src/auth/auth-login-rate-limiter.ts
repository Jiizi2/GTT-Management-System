import { HttpException, HttpStatus, Inject, Injectable, Optional } from "@nestjs/common";

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

function parsePositiveInteger(
  rawValue: string | undefined,
  fallbackValue: number,
  minValue: number,
): number {
  const normalized = rawValue?.trim() ?? "";
  if (!/^\d+$/.test(normalized)) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < minValue) {
    return fallbackValue;
  }

  return parsed;
}

function resolveWindowMs(): number {
  return parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS,
    DEFAULT_LOGIN_RATE_LIMIT_WINDOW_MS,
    1_000,
  );
}

function resolveMaxAttempts(): number {
  return parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    DEFAULT_LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    1,
  );
}

function resolveLockMs(): number {
  return parsePositiveInteger(
    process.env.AUTH_LOGIN_RATE_LIMIT_LOCK_MS,
    DEFAULT_LOGIN_RATE_LIMIT_LOCK_MS,
    1_000,
  );
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase() || "unknown";
}

function readHeaderValue(headers: Record<string, unknown> | undefined, key: string): string {
  const rawValue = headers?.[key] ?? headers?.[key.toLowerCase()];
  if (Array.isArray(rawValue)) {
    return rawValue[0]?.trim() ?? "";
  }

  if (typeof rawValue === "string") {
    return rawValue.trim();
  }

  return "";
}

function normalizeIpCandidate(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return "";
  }

  const normalizedWithoutPort = normalized.replace(/^\[?([a-fA-F0-9:.]+)\]?(:\d+)?$/, "$1");
  return normalizedWithoutPort.toLowerCase();
}

function resolveClientIp(request: LoginRequestLike): string {
  const forwardedHeader = readHeaderValue(request.headers, "x-forwarded-for");
  const forwardedIp = forwardedHeader
    .split(",")
    .map((segment) => normalizeIpCandidate(segment))
    .find((segment) => segment.length > 0);
  if (forwardedIp) {
    return forwardedIp;
  }

  const directIp = normalizeIpCandidate(request.ip);
  if (directIp) {
    return directIp;
  }

  const socketIp = normalizeIpCandidate(request.socket?.remoteAddress);
  if (socketIp) {
    return socketIp;
  }

  return "unknown";
}

@Injectable()
export class AuthLoginRateLimiter {
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly lockMs: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, LoginRateLimitBucket>();

  constructor(
    @Optional()
    @Inject("AUTH_LOGIN_RATE_LIMITER_OPTIONS")
    options?: Partial<LoginRateLimiterOptions>,
  ) {
    this.windowMs = options?.windowMs ?? resolveWindowMs();
    this.maxAttempts = options?.maxAttempts ?? resolveMaxAttempts();
    this.lockMs = options?.lockMs ?? resolveLockMs();
    this.now = options?.now ?? (() => Date.now());
  }

  resolveKeys(identifier: string, request: LoginRequestLike): LoginRateLimiterKeySet {
    const clientIp = resolveClientIp(request);
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
