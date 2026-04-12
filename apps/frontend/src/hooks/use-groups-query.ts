import { useQuery } from "@tanstack/react-query";
import { fetchGroupsFromBackend, type GroupFetchProjection } from "./use-app-controller-backend";
import { groupQueryKeys } from "../shared/query-keys";

export function useGroupsQuery(projection: GroupFetchProjection, enabled = true, activeOnly = false) {
  return useQuery({
    queryKey: groupQueryKeys.list(projection, activeOnly),
    queryFn: ({ signal }) => fetchGroupsFromBackend({ signal, projection, activeOnly }),
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useGroupsSearchQuery(
  query: string,
  projection: GroupFetchProjection,
  enabled = true,
  activeOnly = false,
) {
  const normalizedQuery = query.trim().toLowerCase();

  return useQuery({
    queryKey: groupQueryKeys.search(normalizedQuery, projection, activeOnly),
    queryFn: ({ signal }) => fetchGroupsFromBackend({ signal, query: normalizedQuery, projection, activeOnly }),
    enabled: enabled && normalizedQuery.length > 0,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
