import { Controller, Get, Header, Param, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { AgentPrincipal } from "../agent-auth/agent-auth.types";
import { AgentPortalRoute } from "../agent-auth/agent-portal-route";
import { CurrentAgentPrincipal } from "../agent-auth/current-agent-principal";
import { AgentPortalGroupsService } from "./agent-portal-groups.service";
import { assertAgentPortalReadRequest } from "./agent-portal-request-policy";
import { AgentPortalGroupQueryDto } from "./dto/agent-portal-group-query.dto";

type ReadRequest = { query?: Record<string, unknown>; headers?: Record<string, unknown>; body?: unknown };
const GROUP_QUERY_KEYS = ["q", "lifecycle", "arrivalFrom", "arrivalTo", "sortBy", "sortDirection", "page", "pageSize"];

@AgentPortalRoute()
@ApiTags("Agent Portal Groups")
@ApiBearerAuth("agent-access-token")
@ApiCookieAuth("agent-auth-cookie")
@Controller("agent/groups")
export class AgentPortalGroupsController {
  constructor(private readonly groups: AgentPortalGroupsService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@CurrentAgentPrincipal() principal: AgentPrincipal, @Query() query: AgentPortalGroupQueryDto, @Req() request: ReadRequest) {
    assertAgentPortalReadRequest(request, GROUP_QUERY_KEYS);
    return this.groups.list(principal.agentId, query);
  }

  @Get(":idOrCode")
  @Header("Cache-Control", "private, no-store")
  detail(@CurrentAgentPrincipal() principal: AgentPrincipal, @Param("idOrCode") id: string, @Req() request: ReadRequest) {
    assertAgentPortalReadRequest(request);
    return this.groups.detail(principal.agentId, id);
  }

  @Get(":idOrCode/itinerary")
  @Header("Cache-Control", "private, no-store")
  itinerary(@CurrentAgentPrincipal() p: AgentPrincipal, @Param("idOrCode") id: string, @Req() r: ReadRequest) { assertAgentPortalReadRequest(r); return this.groups.itinerary(p.agentId, id); }

  @Get(":idOrCode/timeline")
  @Header("Cache-Control", "private, no-store")
  timeline(@CurrentAgentPrincipal() p: AgentPrincipal, @Param("idOrCode") id: string, @Req() r: ReadRequest) { assertAgentPortalReadRequest(r); return this.groups.timeline(p.agentId, id); }

  @Get(":idOrCode/visa")
  @Header("Cache-Control", "private, no-store")
  visa(@CurrentAgentPrincipal() p: AgentPrincipal, @Param("idOrCode") id: string, @Req() r: ReadRequest) { assertAgentPortalReadRequest(r); return this.groups.visa(p.agentId, id); }

  @Get(":idOrCode/hotel-agreements")
  @Header("Cache-Control", "private, no-store")
  hotels(@CurrentAgentPrincipal() p: AgentPrincipal, @Param("idOrCode") id: string, @Req() r: ReadRequest) { assertAgentPortalReadRequest(r); return this.groups.hotels(p.agentId, id); }

  @Get(":idOrCode/transportation")
  @Header("Cache-Control", "private, no-store")
  transportation(@CurrentAgentPrincipal() p: AgentPrincipal, @Param("idOrCode") id: string, @Req() r: ReadRequest) { assertAgentPortalReadRequest(r); return this.groups.transportation(p.agentId, id); }
}
