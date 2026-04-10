import { useQuery } from "@tanstack/react-query";
import { fetchGroupsFromBackend } from "./use-app-controller-backend";
import { groupQueryKeys } from "../shared/query-keys";

export function useGroupsQuery() {
  return useQuery({
    queryKey: groupQueryKeys.list,
    queryFn: ({ signal }) => fetchGroupsFromBackend({ signal }),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useGroupsSearchQuery(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return useQuery({
    queryKey: groupQueryKeys.search(normalizedQuery),
    queryFn: ({ signal }) => fetchGroupsFromBackend({ signal, query: normalizedQuery }),
    enabled: normalizedQuery.length > 0,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}
