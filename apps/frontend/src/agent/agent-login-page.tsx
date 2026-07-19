import { useCallback } from "react";
import { LoginScreen, type LoginCredentials } from "../pages/login-page";
import { AgentApiError } from "./auth/agent-api";
import { useAgentLogin } from "./auth/use-agent-auth";

export function AgentLoginPage() {
  const login = useAgentLogin();
  const submit = useCallback(
    async (credentials: LoginCredentials) => {
      login.reset();
      await login.mutateAsync({
        identifier: credentials.identifier.trim(),
        password: credentials.password,
      });
    },
    [login],
  );
  const errorMessage =
    login.error instanceof AgentApiError && login.error.status === 429
      ? "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba kembali."
      : login.isError
        ? "Login gagal. Periksa kembali email dan password Anda."
        : "";
  return <LoginScreen productName="Portal Agent" onSubmit={submit} isSubmitting={login.isPending} errorMessage={errorMessage} />;
}
