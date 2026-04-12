import Joi from "joi";
import { resolveCorsOrigins } from "../http-origin";
import { resolveRuntimeConfig } from "../runtime-config";

const COOKIE_DOMAIN_PATTERN = /^\.?[a-z0-9-]+(\.[a-z0-9-]+)*$/i;
const DEFAULT_AUTH_SECRET = "gtt-dev-auth-secret-please-change-in-production";
const MINIMUM_PRODUCTION_AUTH_SECRET_LENGTH = 32;

const ENVIRONMENT_SCHEMA = Joi.object({
  NODE_ENV: Joi.string().trim().valid("development", "production", "test").default("development"),
  PORT: Joi.number().integer().port().default(3001),
  DATA_SOURCE: Joi.string().trim().valid("memory", "prisma").default("memory"),
  DATABASE_URL: Joi.string().trim().allow("").optional(),
  AUTH_SECRET: Joi.string().allow("").optional(),
  AUTH_BOOTSTRAP_DEFAULT_USERS: Joi.boolean().truthy("true").falsy("false").optional(),
  CORS_ORIGINS: Joi.string().trim().allow("").optional(),
  TRUST_PROXY: Joi.boolean().truthy("true").falsy("false").optional(),
  LOG_LEVEL: Joi.string()
    .trim()
    .valid("trace", "debug", "info", "warn", "error", "fatal", "silent")
    .optional(),
  HTTP_LOG_SUCCESS: Joi.boolean().truthy("true").falsy("false").optional(),
  AUTH_COOKIE_DOMAIN: Joi.string().trim().pattern(COOKIE_DOMAIN_PATTERN).allow("").optional(),
  AUTH_COOKIE_SECURE: Joi.boolean().truthy("true").falsy("false").optional(),
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1_000).default(60_000),
  AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: Joi.number().integer().min(1).default(8),
  AUTH_LOGIN_RATE_LIMIT_LOCK_MS: Joi.number().integer().min(1_000).default(300_000),
  THROTTLE_DEFAULT_TTL_MS: Joi.number().integer().min(1_000).default(60_000),
  THROTTLE_DEFAULT_LIMIT: Joi.number().integer().min(1).default(120),
  THROTTLE_DEFAULT_BLOCK_MS: Joi.number().integer().min(1_000).default(60_000),
  RUNTIME_RETENTION_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  RUNTIME_RETENTION_INTERVAL_MS: Joi.number().integer().min(60_000).default(3_600_000),
  GROUP_AUDIT_LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(180),
  AUTH_LOGIN_RATE_LIMIT_RETENTION_DAYS: Joi.number().integer().min(1).default(14),
  APP_THROTTLE_BUCKET_RETENTION_DAYS: Joi.number().integer().min(1).default(14),
  DEV_AUTH_SUPERADMIN_PASSWORD: Joi.string().allow("").optional(),
  DEV_AUTH_ADMIN_PASSWORD: Joi.string().allow("").optional(),
}).unknown(true);

type ValidatedEnvironment = {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  DATA_SOURCE: "memory" | "prisma";
  DATABASE_URL?: string;
  AUTH_SECRET?: string;
  AUTH_BOOTSTRAP_DEFAULT_USERS?: boolean;
  CORS_ORIGINS?: string;
  TRUST_PROXY?: boolean;
  LOG_LEVEL?: string;
  HTTP_LOG_SUCCESS?: boolean;
  AUTH_COOKIE_DOMAIN?: string;
  AUTH_COOKIE_SECURE?: boolean;
  AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: number;
  AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS: number;
  AUTH_LOGIN_RATE_LIMIT_LOCK_MS: number;
  THROTTLE_DEFAULT_TTL_MS: number;
  THROTTLE_DEFAULT_LIMIT: number;
  THROTTLE_DEFAULT_BLOCK_MS: number;
  RUNTIME_RETENTION_ENABLED: boolean;
  RUNTIME_RETENTION_INTERVAL_MS: number;
  GROUP_AUDIT_LOG_RETENTION_DAYS: number;
  AUTH_LOGIN_RATE_LIMIT_RETENTION_DAYS: number;
  APP_THROTTLE_BUCKET_RETENTION_DAYS: number;
  DEV_AUTH_SUPERADMIN_PASSWORD?: string;
  DEV_AUTH_ADMIN_PASSWORD?: string;
};

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = ENVIRONMENT_SCHEMA.validate(config, {
    abortEarly: false,
    convert: true,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Environment validation failed: ${error.message}`);
  }

  const validated = value as ValidatedEnvironment;

  resolveRuntimeConfig({
    PORT: String(validated.PORT),
    DATA_SOURCE: validated.DATA_SOURCE,
    DATABASE_URL: validated.DATABASE_URL,
    NODE_ENV: validated.NODE_ENV,
  });
  resolveCorsOrigins(validated.CORS_ORIGINS);

  if (validated.NODE_ENV === "production") {
    const corsOrigins = validated.CORS_ORIGINS?.trim() ?? "";
    if (!corsOrigins) {
      throw new Error("CORS_ORIGINS is required in production.");
    }

    const authSecret = validated.AUTH_SECRET?.trim() ?? "";
    if (!authSecret) {
      throw new Error("AUTH_SECRET is required in production.");
    }

    if (authSecret.length < MINIMUM_PRODUCTION_AUTH_SECRET_LENGTH) {
      throw new Error(
        `AUTH_SECRET must be at least ${MINIMUM_PRODUCTION_AUTH_SECRET_LENGTH} characters in production.`,
      );
    }

    if (authSecret === DEFAULT_AUTH_SECRET) {
      throw new Error("AUTH_SECRET must not use the development default value in production.");
    }

    if (validated.AUTH_BOOTSTRAP_DEFAULT_USERS === true) {
      throw new Error("AUTH_BOOTSTRAP_DEFAULT_USERS must be false in production.");
    }
  }

  if (validated.DATA_SOURCE === "prisma" && validated.AUTH_BOOTSTRAP_DEFAULT_USERS === true) {
    const superAdminPassword = validated.DEV_AUTH_SUPERADMIN_PASSWORD?.trim() ?? "";
    const adminPassword = validated.DEV_AUTH_ADMIN_PASSWORD?.trim() ?? "";

    if (!superAdminPassword || !adminPassword) {
      throw new Error(
        "DEV_AUTH_SUPERADMIN_PASSWORD and DEV_AUTH_ADMIN_PASSWORD are required when AUTH_BOOTSTRAP_DEFAULT_USERS=true in Prisma mode.",
      );
    }
  }

  return validated;
}
