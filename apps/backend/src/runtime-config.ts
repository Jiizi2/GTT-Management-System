export type RuntimeDataSource = "memory" | "prisma";

export type RuntimeConfig = {
  port: number;
  dataSource: RuntimeDataSource;
};

const DEFAULT_PORT = 3001;

function resolvePort(rawPort: string | undefined): number {
  const normalizedPort = rawPort?.trim() ?? "";
  if (!normalizedPort) {
    return DEFAULT_PORT;
  }

  if (!/^\d+$/.test(normalizedPort)) {
    throw new Error(`Invalid PORT value '${rawPort}'. Expected a numeric value between 1 and 65535.`);
  }

  const parsedPort = Number(normalizedPort);
  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error(`Invalid PORT value '${rawPort}'. Expected a numeric value between 1 and 65535.`);
  }

  return parsedPort;
}

function resolveDataSource(rawDataSource: string | undefined): RuntimeDataSource {
  const normalizedDataSource = (rawDataSource ?? "memory").trim().toLowerCase();
  if (!normalizedDataSource) {
    return "memory";
  }

  if (normalizedDataSource === "memory" || normalizedDataSource === "prisma") {
    return normalizedDataSource;
  }

  throw new Error(
    `Invalid DATA_SOURCE value '${rawDataSource}'. Expected one of: memory, prisma.`,
  );
}

export function resolveRuntimeConfig(
  env: { PORT?: string; DATA_SOURCE?: string; DATABASE_URL?: string },
): RuntimeConfig {
  const dataSource = resolveDataSource(env.DATA_SOURCE);
  const port = resolvePort(env.PORT);

  if (dataSource === "prisma" && !env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required when DATA_SOURCE=prisma.");
  }

  return {
    port,
    dataSource,
  };
}

export function resolveStartupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
  }

  return "Unknown startup error.";
}
