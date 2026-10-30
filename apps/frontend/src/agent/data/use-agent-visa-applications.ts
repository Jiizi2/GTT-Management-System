import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { VisaApplication } from "./contracts";
import { portalGet } from "./portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

export function useAgentVisaApplications(principalId: string) {
  const client = useQueryClient();
  return useQuery<VisaApplication[]>({
    queryKey: agentQueryKeys.visaApplications(principalId),
    queryFn: ({ signal }) => portalGet<VisaApplication[]>(client, "/visa-applications", signal),
    staleTime: 30_000,
  });
}
