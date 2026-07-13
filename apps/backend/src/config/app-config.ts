import { ConfigService } from "@nestjs/config";
import { type RuntimeDataSource, resolveDataSource } from "../runtime-config";

function normalizeStringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }

  return undefined;
}

export function resolveConfiguredString(
  configService: ConfigService | undefined,
  key: string,
): string | undefined {
  const configured = (configService && typeof configService.get === "function")
    ? normalizeStringValue(configService.get<unknown>(key))
    : undefined;
  if (configured !== undefined) {
    return configured;
  }

  return normalizeStringValue(process.env[key]);
}

export function resolveConfiguredNumber(
  configService: ConfigService | undefined,
  key: string,
  fallbackValue: number,
): number {
  const configured = (configService && typeof configService.get === "function")
    ? configService.get<unknown>(key)
    : undefined;
  if (typeof configured === "number" && Number.isFinite(configured)) {
    return configured;
  }

  const normalized = normalizeStringValue(configured) ?? normalizeStringValue(process.env[key]) ?? "";
  if (!/^\d+$/.test(normalized)) {
    return fallbackValue;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

export function resolveConfiguredBoolean(
  configService: ConfigService | undefined,
  key: string,
): boolean | undefined {
  const configured = (configService && typeof configService.get === "function")
    ? configService.get<unknown>(key)
    : undefined;
  if (typeof configured === "boolean") {
    return configured;
  }

  const normalized = (normalizeStringValue(configured) ?? normalizeStringValue(process.env[key]) ?? "")
    .toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

export function resolveConfiguredNodeEnv(configService: ConfigService | undefined): string {
  return (resolveConfiguredString(configService, "NODE_ENV") ?? "development").toLowerCase();
}

export function resolveConfiguredDataSource(
  configService: ConfigService | undefined,
): RuntimeDataSource {
  return resolveDataSource(resolveConfiguredString(configService, "DATA_SOURCE"));
}
