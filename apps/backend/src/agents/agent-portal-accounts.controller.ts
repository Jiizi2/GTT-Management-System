import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { AuthTokenPayload } from "../auth/auth.types";
import { Roles } from "../auth/auth.roles";
import { AgentPortalAccountsService } from "./agent-portal-accounts.service";
import {
  CreateAgentPortalAccountDto,
  ResetAgentPortalAccountPasswordDto,
  UpdateAgentPortalAccountStatusDto,
} from "./dto/agent-portal-account.dto";

type AuthenticatedRequest = { authUser?: AuthTokenPayload };

@ApiTags("Agent Portal Account Administration")
@ApiBearerAuth("access-token")
@ApiCookieAuth("auth-cookie")
@ApiUnauthorizedResponse({ description: "Internal authentication is required." })
@ApiForbiddenResponse({ description: "Super Admin access is required." })
@Roles("super-admin")
@Controller("agent-portal-accounts")
export class AgentPortalAccountsController {
  constructor(private readonly accounts: AgentPortalAccountsService) {}

  @Get()
  @ApiOkResponse({ description: "Portal accounts without credential metadata." })
  list(@Query("agentId") agentId?: string) {
    return this.accounts.list(agentId);
  }

  @Post()
  @HttpCode(201)
  @ApiCreatedResponse({ description: "A dormant-compatible portal account was provisioned." })
  create(@Body() payload: CreateAgentPortalAccountDto, @Req() request: AuthenticatedRequest) {
    return this.accounts.create({ ...payload, actor: this.requireActor(request) });
  }

  @Patch(":portalUserId/status")
  @ApiOkResponse({ description: "Account status updated and existing sessions revoked." })
  setStatus(
    @Param("portalUserId") portalUserId: string,
    @Body() payload: UpdateAgentPortalAccountStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounts.setStatus(portalUserId, payload.status, this.requireActor(request));
  }

  @Put(":portalUserId/password")
  @ApiOkResponse({ description: "Password reset and existing sessions revoked." })
  resetPassword(
    @Param("portalUserId") portalUserId: string,
    @Body() payload: ResetAgentPortalAccountPasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.accounts.resetPassword(portalUserId, payload.password, this.requireActor(request));
  }

  @Post(":portalUserId/revoke")
  @HttpCode(200)
  @ApiOkResponse({ description: "All existing sessions for the account were revoked." })
  revoke(@Param("portalUserId") portalUserId: string, @Req() request: AuthenticatedRequest) {
    return this.accounts.revoke(portalUserId, this.requireActor(request));
  }

  private requireActor(request: AuthenticatedRequest): { id: string } {
    if (!request.authUser) {
      throw new Error("Authenticated actor was not attached by the global auth guard.");
    }
    return { id: request.authUser.id };
  }
}
