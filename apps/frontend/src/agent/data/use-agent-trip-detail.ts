import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { GroupData } from "../../shared/app-domain";
import type { GroupDetail, HotelAgreement, TransportationItem, VisaFacet } from "./contracts";
import { mapAgentGroup } from "./map-agent-group";
import { portalGet } from "./portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

export type AgentTripDetail = {
  group: GroupData;
  transportation: TransportationItem[];
  familyGroups?: GroupData[];
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
  const encodedIdentity = encodeURIComponent(identity);
  const resourceKey = agentQueryKeys.group(principalId, identity);
  const query = useQuery({
    queryKey: [...resourceKey, "identity"],
    queryFn: ({ signal }) => portalGet<GroupDetail>(client, `/groups/${encodedIdentity}`, signal),
    enabled: Boolean(identity),
    staleTime: 30_000,
  });
  const visaQuery = useQuery({
    queryKey: [...resourceKey, "visa"],
    queryFn: ({ signal }) => portalGet<VisaFacet>(client, `/groups/${encodedIdentity}/visa`, signal),
    enabled: Boolean(identity),
    staleTime: 30_000,
  });
  const hotelQuery = useQuery({
    queryKey: [...resourceKey, "hotels"],
    queryFn: ({ signal }) => portalGet<HotelAgreement[]>(client, `/groups/${encodedIdentity}/hotel-agreements`, signal),
    enabled: Boolean(identity),
    staleTime: 30_000,
  });
  const transportationQuery = useQuery({
    queryKey: [...resourceKey, "transportation"],
    queryFn: ({ signal }) =>
      portalGet<TransportationItem[]>(client, `/groups/${encodedIdentity}/transportation`, signal),
    enabled: Boolean(identity),
    staleTime: 30_000,
  });
  const data: AgentTripDetail | undefined = query.data
    ? {
        group: mapAgentGroup(
          query.data,
          agentId,
          agentName,
          visaQuery.data || hotelQuery.data
            ? {
                facet: visaQuery.data ?? {
                  status: null,
                  issuedDate: null,
                  syarikah: null,
                  busStatus: null,
                  paymentStatus: null,
                },
                hotels: hotelQuery.data ?? [],
              }
            : undefined,
        ),
        transportation: transportationQuery.data ?? [],
        familyGroups: (query.data.familyGroups ?? [query.data]).map((member) =>
          mapAgentGroup(member, agentId, agentName),
        ),
      }
    : undefined;
  return { ...query, data, visaQuery, hotelQuery, transportationQuery };
}
