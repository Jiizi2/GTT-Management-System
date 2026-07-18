import { Navigate, Route, Routes } from "react-router-dom";
import { AgentLoginPage } from "./agent-login-page";
import { AgentShell } from "./agent-shell";
import { AgentApiError } from "./auth/agent-api";
import { useAgentSession } from "./auth/use-agent-auth";

export function AgentApplication() {
  const session = useAgentSession();
  if (session.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-container-low">
        Memuat sesi Agent...
      </main>
    );
  }
  const unauthorized = session.error instanceof AgentApiError && session.error.status === 401;
  if (session.isError && !unauthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface-container-low" role="alert">
        Workspace Agent tidak dapat dimuat.
      </main>
    );
  }
  return (
    <Routes>
      <Route
        path="/agent/login"
        element={unauthorized ? <AgentLoginPage /> : <Navigate to="/agent/overview" replace />}
      />
      <Route
        path="/agent/*"
        element={unauthorized ? <Navigate to="/agent/login" replace /> : <AgentShell session={session.data!} />}
      />
    </Routes>
  );
}
