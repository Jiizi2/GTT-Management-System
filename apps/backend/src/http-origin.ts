type HeaderCarrier = {
  headers?: Record<string, unknown>;
  protocol?: string;
  secure?: boolean;
  socket?: {
    encrypted?: boolean | null;
  };
};

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function normalizeProtocol(value: string | undefined): "http" | "https" {
  const normalized = value?.trim().toLowerCase();
  return normalized === "https" ? "https" : "http";
}

export function readHeaderValue(
  headers: Record<string, unknown> | undefined,
  key: string,
): string {
  const rawValue = headers?.[key] ?? headers?.[key.toLowerCase()];
  if (Array.isArray(rawValue)) {
    return rawValue[0]?.trim() ?? "";
  }

  if (typeof rawValue === "string") {
    return rawValue.trim();
  }

  return "";
}

export function normalizeOrigin(value: string | null | undefined): string | null {
  const normalizedValue = (value ?? "").trim();
  if (!normalizedValue) {
    return null;
  }

  try {
    const parsed = new URL(normalizedValue);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function resolveCorsOrigins(rawOrigins: string | undefined): string[] {
  const configuredOrigins = (rawOrigins ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (configuredOrigins.length === 0) {
    return DEFAULT_CORS_ORIGINS;
  }

  const normalizedOrigins = configuredOrigins.map((entry) => {
    if (entry === "*") {
      throw new Error("CORS_ORIGINS cannot contain '*' when cookie authentication is enabled.");
    }

    const normalizedOrigin = normalizeOrigin(entry);
    if (!normalizedOrigin) {
      throw new Error(
        `Invalid CORS_ORIGINS entry '${entry}'. Expected a full http(s) origin.`,
      );
    }

    return normalizedOrigin;
  });

  return Array.from(new Set(normalizedOrigins));
}

export function isOriginAllowed(
  origin: string | null | undefined,
  allowedOrigins: readonly string[],
): boolean {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return allowedOrigins.includes(normalizedOrigin);
}

export function resolveRequestOrigin(request: HeaderCarrier): string | null {
  const forwardedProto = readHeaderValue(request.headers, "x-forwarded-proto")
    .split(",")[0]
    ?.trim();
  const forwardedHost = readHeaderValue(request.headers, "x-forwarded-host")
    .split(",")[0]
    ?.trim();
  const host = forwardedHost || readHeaderValue(request.headers, "host");
  if (!host) {
    return null;
  }

  const protocol = forwardedProto
    ? normalizeProtocol(forwardedProto)
    : request.protocol?.trim()
      ? normalizeProtocol(request.protocol)
      : request.secure || request.socket?.encrypted
        ? "https"
        : "http";

  return normalizeOrigin(`${protocol}://${host}`);
}

export function resolveRequestSourceOrigin(request: HeaderCarrier): string | null {
  const originHeader = readHeaderValue(request.headers, "origin");
  if (originHeader) {
    return normalizeOrigin(originHeader);
  }

  const refererHeader = readHeaderValue(request.headers, "referer");
  if (!refererHeader) {
    return null;
  }

  try {
    return normalizeOrigin(new URL(refererHeader).origin);
  } catch {
    return null;
  }
}
