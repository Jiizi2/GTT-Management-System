export type AgentPrincipal = {
  portalUserId: string;
  agentId: string;
  displayName: string;
  email: string;
  agentCode: string;
  agentName: string;
  mustChangePassword: boolean;
  exp: number;
};

export type AgentSession = { expiresAt: string; user: AgentPrincipal };
