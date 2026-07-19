import type { QueryClient } from "@tanstack/react-query";
import { agentGet, AgentApiError } from "../auth/agent-api";
import { clearAgentPortalCache } from "../query/agent-query-boundary";

export async function portalGet<T>(client: QueryClient, path: string): Promise<T> {
  try {
    return await agentGet<T>(path);
  } catch (error) {
    if (error instanceof AgentApiError && error.status === 401) {
      await clearAgentPortalCache(client);
      if (typeof window !== "undefined") window.location.assign("/agent/login");
    }
    throw error;
  }
}
