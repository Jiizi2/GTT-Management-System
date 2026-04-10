import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loginWithBackend, fetchCurrentSessionFromBackend, logoutFromBackend } from "./use-auth-backend";
import {
  AUTH_STATE_CHANGED_EVENT,
  clearAuthSession,
  persistAuthSession,
  readPersistedAuthSession,
  type AuthSession,
} from "../shared/auth-session";
import { authQueryKeys } from "../shared/query-keys";
import type { LoginCredentials } from "../pages/login-page";

export function useAuthSessionQuery() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncSessionFromStorage = () => {
      queryClient.setQueryData<AuthSession | null>(authQueryKeys.session, readPersistedAuthSession());
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncSessionFromStorage);
    window.addEventListener("storage", syncSessionFromStorage);

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncSessionFromStorage);
      window.removeEventListener("storage", syncSessionFromStorage);
    };
  }, [queryClient]);

  const query = useQuery({
    queryKey: authQueryKeys.session,
    queryFn: fetchCurrentSessionFromBackend,
    initialData: () => readPersistedAuthSession(),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (query.data === undefined) {
      return;
    }

    const persistedSession = readPersistedAuthSession();
    const serializedPersistedSession = persistedSession ? JSON.stringify(persistedSession) : "";
    const serializedQuerySession = query.data ? JSON.stringify(query.data) : "";
    if (serializedPersistedSession === serializedQuerySession) {
      return;
    }

    if (query.data) {
      persistAuthSession(query.data);
      return;
    }

    clearAuthSession();
  }, [query.data]);

  return query;
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => loginWithBackend(credentials),
    retry: false,
    onSuccess: (session) => {
      persistAuthSession(session);
      queryClient.setQueryData(authQueryKeys.session, session);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutFromBackend,
    retry: false,
    onSettled: () => {
      clearAuthSession();
      queryClient.setQueryData<AuthSession | null>(authQueryKeys.session, null);
    },
  });
}
