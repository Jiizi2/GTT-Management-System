import { resolveBackendApiBaseUrl } from "../shared/backend-api-base";

export function resolveAgentApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveBackendApiBaseUrl()}/agent${normalizedPath}`;
}
