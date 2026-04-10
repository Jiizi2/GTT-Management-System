import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createMasterDataOptionInBackend,
  fetchMasterDataCategoriesFromBackend,
  fetchMasterDataOptionsFromBackend,
  updateMasterDataOptionInBackend,
  type CreateMasterDataOptionPayload,
  type MasterDataCategoryKey,
  type UpdateMasterDataOptionPayload,
} from "./use-master-data-backend";
import { masterDataQueryKeys } from "../shared/query-keys";

export function useMasterDataCategoriesQuery() {
  return useQuery({
    queryKey: masterDataQueryKeys.categories,
    queryFn: ({ signal }) => fetchMasterDataCategoriesFromBackend({ signal }),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useMasterDataOptionsQuery({
  categoryKey,
  includeInactive = false,
  enabled = true,
}: {
  categoryKey: MasterDataCategoryKey;
  includeInactive?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: masterDataQueryKeys.options(categoryKey, includeInactive),
    queryFn: ({ signal }) =>
      fetchMasterDataOptionsFromBackend({
        categoryKey,
        includeInactive,
        signal,
      }),
    enabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateMasterDataOptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateMasterDataOptionPayload) => createMasterDataOptionInBackend(payload),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: masterDataQueryKeys.all });
    },
  });
}

export function useUpdateMasterDataOptionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      optionId,
      payload,
    }: {
      optionId: string;
      payload: UpdateMasterDataOptionPayload;
    }) => updateMasterDataOptionInBackend(optionId, payload),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: masterDataQueryKeys.all });
    },
  });
}
