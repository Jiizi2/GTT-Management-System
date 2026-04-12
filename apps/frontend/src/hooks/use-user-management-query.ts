import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createManagedUserInBackend,
  deleteManagedUserInBackend,
  fetchManagedUsersFromBackend,
  setManagedUserPasswordInBackend,
  updateManagedUserInBackend,
  type BackendManagedUser,
  type CreateManagedUserPayload,
  type UpdateManagedUserPayload,
} from "./use-user-management-backend";
import { userManagementQueryKeys } from "../shared/query-keys";

export function useManagedUsersQuery() {
  return useQuery({
    queryKey: userManagementQueryKeys.users,
    queryFn: ({ signal }) => fetchManagedUsersFromBackend({ signal }),
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateManagedUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateManagedUserPayload) => createManagedUserInBackend(payload),
    retry: false,
    onSuccess: (createdUser) => {
      queryClient.setQueryData<BackendManagedUser[]>(userManagementQueryKeys.users, (currentUsers = []) => [
        createdUser,
        ...currentUsers,
      ]);
    },
  });
}

export function useUpdateManagedUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: UpdateManagedUserPayload }) =>
      updateManagedUserInBackend(userId, payload),
    retry: false,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<BackendManagedUser[]>(userManagementQueryKeys.users, (currentUsers = []) =>
        currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
    },
  });
}

export function useDeleteManagedUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteManagedUserInBackend(userId),
    retry: false,
    onSuccess: (_, userId) => {
      queryClient.setQueryData<BackendManagedUser[]>(userManagementQueryKeys.users, (currentUsers = []) =>
        currentUsers.filter((user) => user.id !== userId),
      );
    },
  });
}

export function useSetManagedUserPasswordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      setManagedUserPasswordInBackend(userId, password),
    retry: false,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData<BackendManagedUser[]>(userManagementQueryKeys.users, (currentUsers = []) =>
        currentUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
    },
  });
}
