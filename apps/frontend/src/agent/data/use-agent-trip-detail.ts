import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupData } from "../../shared/app-domain";
import type { GroupDetail, HotelAgreement, TransportationItem, VisaFacet } from "./contracts";
import { mapAgentGroup } from "./map-agent-group";
import { portalGet } from "./portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

export type AgentTripDetail = {
  group: GroupData;
  transportation: TransportationItem[];
};

export function useAgentTripDetail({
  principalId,
  agentId,
  agentName,
  identity,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
  identity: string;
}) {
  const client = useQueryClient();
  return useQuery<AgentTripDetail>({
    queryKey: agentQueryKeys.group(principalId, identity),
    queryFn: async () => {
      const encodedIdentity = encodeURIComponent(identity);
      const [group, facet, hotels, transportation] = await Promise.all([
        portalGet<GroupDetail>(client, `/groups/${encodedIdentity}`),
        portalGet<VisaFacet>(client, `/groups/${encodedIdentity}/visa`),
        portalGet<HotelAgreement[]>(client, `/groups/${encodedIdentity}/hotel-agreements`),
        portalGet<TransportationItem[]>(client, `/groups/${encodedIdentity}/transportation`),
      ]);
      return {
        group: mapAgentGroup(group, agentId, agentName, { facet, hotels }),
        transportation,
      };
    },
    enabled: Boolean(identity),
    staleTime: 30_000,
  });
}
