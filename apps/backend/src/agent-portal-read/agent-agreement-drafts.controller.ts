import {
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { AgentPortalRoute } from "../agent-auth/agent-portal-route";
import { CurrentAgentPrincipal } from "../agent-auth/current-agent-principal";
import type { AgentPrincipal } from "../agent-auth/agent-auth.types";
import { assertAgentPortalReadRequest } from "./agent-portal-request-policy";
import { AgentAgreementDraftsService } from "./agent-agreement-drafts.service";

type Request = {
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  body?: unknown;
};
@AgentPortalRoute()
@Controller("agent/agreement-drafts")
export class AgentAgreementDraftsController {
  constructor(private readonly drafts: AgentAgreementDraftsService) {}
  @Get()
  @Header("Cache-Control", "private, no-store")
  list(
    @CurrentAgentPrincipal() p: AgentPrincipal,
    @Query("q") q: string | undefined,
    @Req() request: Request,
  ) {
    assertAgentPortalReadRequest(request, ["q"]);
    return this.drafts.list(p.agentId, q);
  }
  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  detail(
    @CurrentAgentPrincipal() p: AgentPrincipal,
    @Param("id") id: string,
    @Req() request: Request,
  ) {
    assertAgentPortalReadRequest(request);
    return this.drafts.detail(p.agentId, id);
  }
  @Post()
  @Header("Cache-Control", "private, no-store")
  create() {
    return this.drafts.create();
  }
  @Patch(":id")
  @Header("Cache-Control", "private, no-store")
  update() {
    return this.drafts.update();
  }
}
