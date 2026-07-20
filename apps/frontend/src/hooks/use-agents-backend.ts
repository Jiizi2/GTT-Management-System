import { useQuery } from "@tanstack/react-query";
import { fetchBackendParsed } from "../shared/api-client";
import { formatBackendRequestError } from "../shared/api-error";

export type AgentOption = {
  id: string;
  code: string;
  name: string;
  type: "DIRECT" | "PARTNER";
  status: "ACTIVE" | "INACTIVE";
  picName?: string | null;
  phone?: string | null;
  email?: string | null;
  groupCount?: number;
};

export async function fetchAgents(): Promise<AgentOption[]> {
  const { response, payload } = await fetchBackendParsed("/agents");
  if (!response.ok || !Array.isArray(payload)) throw new Error(`Agent fetch failed (${response.status}).`);
  return payload.filter((item): item is AgentOption =>
    Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string"),
  );
}

export async function createAgent(payload: {
  code: string;
  name: string;
  picName?: string;
  phone?: string;
  email?: string;
}): Promise<AgentOption> {
  const result = await fetchBackendParsed("/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, type: "PARTNER" }),
  });
  if (!result.response.ok)
    throw new Error(
      formatBackendRequestError(result.response.status, result.payload, result.responseText, "Agent save failed"),
    );
  return result.payload as AgentOption;
}

export async function updateAgent(
  id: string,
  payload: { code: string; name: string; picName?: string; phone?: string; email?: string },
): Promise<AgentOption> {
  const result = await fetchBackendParsed(`/agents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!result.response.ok)
    throw new Error(
      formatBackendRequestError(result.response.status, result.payload, result.responseText, "Agent update failed"),
    );
  return result.payload as AgentOption;
}

export async function setAgentStatus(id: string, status: "ACTIVE" | "INACTIVE"): Promise<void> {
  const result = await fetchBackendParsed(`/agents/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!result.response.ok)
    throw new Error(
      formatBackendRequestError(
        result.response.status,
        result.payload,
        result.responseText,
        "Agent status update failed",
      ),
    );
}

export async function deleteAgent(id: string): Promise<void> {
  const result = await fetchBackendParsed(`/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!result.response.ok) {
    throw new Error(
      formatBackendRequestError(result.response.status, result.payload, result.responseText, "Agent delete failed"),
    );
  }
}

export function useAgentsQuery() {
  return useQuery({ queryKey: ["agents"], queryFn: fetchAgents, staleTime: 60_000 });
}
