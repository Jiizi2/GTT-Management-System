export const AGENT_TOKEN_AUDIENCE = "gtt-agent-portal";
export const AGENT_TOKEN_ISSUER = "gtt-backend";

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

export type AgentTokenPayload = {
  sub: string;
  principalType: "agent";
  agentId: string;
  tokenVersion: number;
  aud: typeof AGENT_TOKEN_AUDIENCE;
  iss: typeof AGENT_TOKEN_ISSUER;
  iat: number;
  exp: number;
};

export type AgentLoginResult = {
  accessToken: string;
  expiresAt: string;
  principal: AgentPrincipal;
};
