import { Controller, Get, Header, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AgentPortalRoute } from "../agent-auth/agent-portal-route";
import { CurrentAgentPrincipal } from "../agent-auth/current-agent-principal";
import type { AgentPrincipal } from "../agent-auth/agent-auth.types";
import { assertAgentPortalReadRequest } from "./agent-portal-request-policy";
import { AgentPortalReadService } from "./agent-portal-read.service";

type PortalReadRequest = {
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  body?: unknown;
};

@AgentPortalRoute()
@ApiTags("Agent Portal Read API")
@ApiBearerAuth("agent-access-token")
@ApiCookieAuth("agent-auth-cookie")
@Controller("agent")
export class AgentPortalReadController {
  constructor(private readonly readService: AgentPortalReadService) {}

  @Get("dashboard")
  @Header("Cache-Control", "private, no-store")
  @ApiOkResponse({ description: "Tenant-scoped operational dashboard projection." })
  dashboard(@CurrentAgentPrincipal() principal: AgentPrincipal, @Req() request: PortalReadRequest) {
    assertAgentPortalReadRequest(request);
    return this.readService.dashboard(principal);
  }

  @Get("profile")
  @Header("Cache-Control", "private, no-store")
  @ApiOkResponse({ description: "Minimal read-only account and Partner profile." })
  profile(@CurrentAgentPrincipal() principal: AgentPrincipal, @Req() request: PortalReadRequest) {
    assertAgentPortalReadRequest(request);
    return this.readService.profile(principal);
  }
}
