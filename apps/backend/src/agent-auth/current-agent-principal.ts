import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { AgentPrincipal } from "./agent-auth.types";

export const CurrentAgentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AgentPrincipal => {
    const request = context.switchToHttp().getRequest<{ agentPrincipal?: AgentPrincipal }>();
    if (!request.agentPrincipal) {
      throw new UnauthorizedException("Agent session is not available.");
    }
    return request.agentPrincipal;
  },
);
