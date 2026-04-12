function normalizeLoopbackHost(hostname: string): string {
  if (hostname === "::1") {
    return "[::1]";
  }

  return hostname;
}

export function resolveBackendApiBaseUrl(): string {
  const customUrl = (globalThis as { __GTT_API_BASE_URL__?: string }).__GTT_API_BASE_URL__;
  if (customUrl?.trim()) {
    return customUrl.trim().replace(/\/+$/, "");
  }

  const hostname = globalThis.location?.hostname?.trim() ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return `http://${normalizeLoopbackHost(hostname)}:3001/api`;
  }

  return "/api";
}
