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
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
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
    placeholderData: () => readPersistedAuthSession(),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
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

  useEffect(() => {
    if (!query.data?.expiresAt || typeof window === "undefined") return undefined;
    const remainingMs = Date.parse(query.data.expiresAt) - Date.now();
    if (remainingMs <= 0) {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
    }, Math.min(remainingMs + 250, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [query.data?.expiresAt, queryClient]);

  return query;
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => loginWithBackend(credentials),
    retry: false,
    onSuccess: (session) => {
      queryClient.getMutationCache().clear();
      queryClient.removeQueries({
        predicate: (candidate) => candidate.queryKey[0] !== "auth",
      });
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
      void queryClient.cancelQueries();
      queryClient.getMutationCache().clear();
      queryClient.removeQueries({
        predicate: (candidate) => candidate.queryKey[0] !== "auth",
      });
      clearAuthSession();
      queryClient.setQueryData<AuthSession | null>(authQueryKeys.session, null);
    },
  });
}
