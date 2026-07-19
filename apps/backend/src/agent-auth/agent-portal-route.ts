import { SetMetadata } from "@nestjs/common";

export const IS_AGENT_PORTAL_ROUTE_KEY = "isAgentPortalRoute";
export const AgentPortalRoute = (): ClassDecorator & MethodDecorator =>
  SetMetadata(IS_AGENT_PORTAL_ROUTE_KEY, true);
