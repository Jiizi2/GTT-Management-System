import { BadRequestException } from "@nestjs/common";

type PortalRequestLike = {
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  body?: unknown;
};

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "");

function containsTenantSelector(value: unknown, visited = new Set<object>()): boolean {
  if (!value || typeof value !== "object") return false;
  if (visited.has(value)) return false;
  visited.add(value);
  if (Array.isArray(value)) return value.some((item) => containsTenantSelector(item, visited));
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => normalizeKey(key) === "agentid" || normalizeKey(key) === "xagentid" || containsTenantSelector(child, visited),
  );
}

export function assertAgentPortalReadRequest(
  request: PortalRequestLike,
  allowedQueryKeys: readonly string[] = [],
): void {
  if (
    containsTenantSelector(request.query) ||
    containsTenantSelector(request.body) ||
    Object.keys(request.headers ?? {}).some((key) => {
      const normalized = normalizeKey(key);
      return normalized === "agentid" || normalized === "xagentid";
    })
  ) {
    throw new BadRequestException("Tenant selectors are not accepted on Agent Portal routes.");
  }
  const allowed = new Set(allowedQueryKeys);
  if (Object.keys(request.query ?? {}).some((key) => !allowed.has(key))) {
    throw new BadRequestException("This Agent Portal route does not accept query parameters.");
  }
}
