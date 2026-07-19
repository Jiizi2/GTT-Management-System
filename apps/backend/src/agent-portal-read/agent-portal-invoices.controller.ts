import { Controller, Get, Header, Param, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import type { AgentPrincipal } from "../agent-auth/agent-auth.types";
import { AgentPortalRoute } from "../agent-auth/agent-portal-route";
import { CurrentAgentPrincipal } from "../agent-auth/current-agent-principal";
import { AgentPortalInvoicesService } from "./agent-portal-invoices.service";
import { assertAgentPortalReadRequest } from "./agent-portal-request-policy";
import { AgentPortalInvoiceQueryDto } from "./dto/agent-portal-invoice-query.dto";

type ReadRequest = { query?: Record<string, unknown>; headers?: Record<string, unknown>; body?: unknown };
const INVOICE_QUERY_KEYS = ["status", "dueFrom", "dueTo", "sortBy", "sortDirection", "page", "pageSize"];

@AgentPortalRoute()
@ApiTags("Agent Portal Invoices")
@ApiBearerAuth("agent-access-token")
@ApiCookieAuth("agent-auth-cookie")
@Controller("agent/invoices")
export class AgentPortalInvoicesController {
  constructor(private readonly invoices: AgentPortalInvoicesService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@CurrentAgentPrincipal() principal: AgentPrincipal, @Query() query: AgentPortalInvoiceQueryDto, @Req() request: ReadRequest) {
    assertAgentPortalReadRequest(request, INVOICE_QUERY_KEYS);
    return this.invoices.list(principal.agentId, query);
  }

  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  detail(@CurrentAgentPrincipal() principal: AgentPrincipal, @Param("id") id: string, @Req() request: ReadRequest) {
    assertAgentPortalReadRequest(request);
    return this.invoices.detail(principal.agentId, id);
  }
}
