import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAgentSession, loginAgent, logoutAgent } from "./agent-api";
import {
  agentSessionQueryKey,
  clearAgentPortalBusinessCache,
  clearAgentPortalCache,
} from "../query/agent-query-boundary";

export function useAgentSession() {
  return useQuery({ queryKey: agentSessionQueryKey, queryFn: getAgentSession, retry: false, staleTime: 30_000 });
}

export function useAgentLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ identifier, password }: { identifier: string; password: string }) =>
      loginAgent(identifier, password),
    onSuccess: async (session) => {
      await clearAgentPortalBusinessCache(client);
      client.setQueryData(agentSessionQueryKey, session);
    },
  });
}

export function useAgentLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: logoutAgent,
    onSettled: async () => {
      await clearAgentPortalCache(client);
      if (typeof window !== "undefined") window.location.assign("/agent/login");
    },
  });
}
