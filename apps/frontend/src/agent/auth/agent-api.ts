import { resolveAgentApiUrl } from "../runtime-config";
import type { AgentSession } from "./agent-session";

export class AgentApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveAgentApiUrl(path), {
    ...init,
    credentials: "include",
    headers: { Accept: "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let message = "Permintaan tidak dapat diproses.";
    try {
      const body = (await response.json()) as { message?: unknown };
      if (typeof body.message === "string") message = body.message;
    } catch {
      // Keep the generic message for non-JSON failures.
    }
    throw new AgentApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const agentGet = <T>(path: string): Promise<T> => request<T>(path);
export const getAgentSession = (): Promise<AgentSession> => request("/auth/session");
export const loginAgent = (identifier: string, password: string): Promise<AgentSession> =>
  request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
export const logoutAgent = (): Promise<void> => request("/auth/logout", { method: "POST" });
