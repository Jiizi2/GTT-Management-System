import { Controller, Get, Header, Param } from "@nestjs/common";
import { AgentPortalRoute } from "../agent-auth/agent-portal-route";
import { CurrentAgentPrincipal } from "../agent-auth/current-agent-principal";
import type { AgentPrincipal } from "../agent-auth/agent-auth.types";
import { VisaApplicationsService } from "./visa-applications.service";

@AgentPortalRoute()
@Controller("agent/visa-applications")
export class AgentVisaApplicationsController {
  constructor(private readonly applications: VisaApplicationsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@CurrentAgentPrincipal() principal: AgentPrincipal) {
    return this.applications.listForAgent(principal.agentId);
  }

  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  detail(
    @CurrentAgentPrincipal() principal: AgentPrincipal,
    @Param("id") id: string,
  ) {
    return this.applications.detailForAgent(principal.agentId, id);
  }
}
