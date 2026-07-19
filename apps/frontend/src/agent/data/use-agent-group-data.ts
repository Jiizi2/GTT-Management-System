import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupData } from "../../shared/app-domain";
import type { HotelAgreement, VisaFacet } from "./contracts";
import { getAllAgentGroups } from "./all-groups-query";
import { portalGet } from "./portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { mapAgentGroup } from "../pages/dashboard-page";

export function useAgentGroupData({
  principalId,
  agentId,
  agentName,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
}) {
  const client = useQueryClient();
  return useQuery<GroupData[]>({
    queryKey: [...agentQueryKeys.groups(principalId, "ops-shared-view"), agentId],
    queryFn: async () => {
      const groups = await getAllAgentGroups(client, "asc");
      return Promise.all(
        groups.map(async (group) => {
          const [facet, hotels] = await Promise.all([
            portalGet<VisaFacet>(client, `/groups/${encodeURIComponent(group.code)}/visa`),
            portalGet<HotelAgreement[]>(client, `/groups/${encodeURIComponent(group.code)}/hotel-agreements`),
          ]);
          return mapAgentGroup(group, agentId, agentName, { facet, hotels });
        }),
      );
    },
    staleTime: 30_000,
  });
}
