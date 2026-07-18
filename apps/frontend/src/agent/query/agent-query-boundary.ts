import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { AgentApiError } from "../auth/agent-api";

export const AGENT_PORTAL_QUERY_ROOT = "agent-portal" as const;
export const agentSessionQueryKey = [AGENT_PORTAL_QUERY_ROOT, "session"] as const;
export const agentQueryKeys = {
  dashboard: (principalId: string) => [AGENT_PORTAL_QUERY_ROOT, principalId, "dashboard"] as const,
  checklist: (principalId: string) => [AGENT_PORTAL_QUERY_ROOT, principalId, "checklist"] as const,
  visaTracking: (principalId: string) => [AGENT_PORTAL_QUERY_ROOT, principalId, "visa-tracking"] as const,
  visaApplications: (principalId: string) => [AGENT_PORTAL_QUERY_ROOT, principalId, "visa-applications"] as const,
  groups: (principalId: string, filters: unknown) => [AGENT_PORTAL_QUERY_ROOT, principalId, "groups", filters] as const,
  group: (principalId: string, identity: string) => [AGENT_PORTAL_QUERY_ROOT, principalId, "group", identity] as const,
  invoices: (principalId: string, filters: unknown) =>
    [AGENT_PORTAL_QUERY_ROOT, principalId, "invoices", filters] as const,
  invoice: (principalId: string, id: string) => [AGENT_PORTAL_QUERY_ROOT, principalId, "invoice", id] as const,
  profile: (principalId: string) => [AGENT_PORTAL_QUERY_ROOT, principalId, "profile"] as const,
};

const isPortalKey = (key: QueryKey): boolean => key[0] === AGENT_PORTAL_QUERY_ROOT;
const isPortalBusinessKey = (key: QueryKey): boolean =>
  isPortalKey(key) &&
  !(key.length === agentSessionQueryKey.length && key.every((value, index) => value === agentSessionQueryKey[index]));

export async function clearAgentPortalBusinessCache(client: QueryClient): Promise<void> {
  await client.cancelQueries({ predicate: (query) => isPortalBusinessKey(query.queryKey) });
  client.removeQueries({ predicate: (query) => isPortalBusinessKey(query.queryKey) });
}

export async function clearAgentPortalCache(client: QueryClient): Promise<void> {
  await client.cancelQueries({ predicate: (query) => isPortalKey(query.queryKey) });
  client.removeQueries({ predicate: (query) => isPortalKey(query.queryKey) });
}

export async function clearOnAgentUnauthorized(client: QueryClient, error: unknown): Promise<boolean> {
  if (!(error instanceof AgentApiError) || error.status !== 401) return false;
  await clearAgentPortalCache(client);
  return true;
}
