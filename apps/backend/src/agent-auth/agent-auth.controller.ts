import { Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { AuthLoginRateLimiter } from "../auth/auth-login-rate-limiter";
import { Public } from "../auth/auth.public";
import {
  resolveAgentAuthCookieRuntimeConfig,
  serializeAgentAuthCookie,
  serializeExpiredAgentAuthCookie,
  type AgentAuthCookieRuntimeConfig,
} from "./agent-auth-cookie";
import { AgentAuthService } from "./agent-auth.service";
import type { AgentPrincipal } from "./agent-auth.types";
import { AgentPortalRoute } from "./agent-portal-route";
import { CurrentAgentPrincipal } from "./current-agent-principal";
import { AgentLoginDto } from "./dto/agent-login.dto";

type ResponseLike = { setHeader(name: string, value: string): void };
type LoginRequest = {
  headers?: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string | null };
};

@AgentPortalRoute()
@ApiTags("Agent Portal Auth")
@Controller("agent/auth")
export class AgentAuthController {
  private readonly cookieConfig: AgentAuthCookieRuntimeConfig;

  constructor(
    private readonly auth: AgentAuthService,
    private readonly limiter: AuthLoginRateLimiter,
    config?: ConfigService,
  ) {
    this.cookieConfig = resolveAgentAuthCookieRuntimeConfig(config);
  }

  @Public()
  @SkipThrottle()
  @Post("login")
  @HttpCode(200)
  @ApiOkResponse({ description: "Agent browser session established." })
  @ApiUnauthorizedResponse({ description: "Invalid identifier or password." })
  @ApiTooManyRequestsResponse({ description: "Login attempt limit reached." })
  async login(
    @Body() payload: AgentLoginDto,
    @Req() request: LoginRequest,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    const keys = this.limiter.resolveKeys(payload.identifier, request, "agent");
    await this.limiter.assertAllowed(keys);
    try {
      const result = await this.auth.login(payload.identifier, payload.password);
      await this.limiter.registerSuccess(keys);
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader(
        "Set-Cookie",
        serializeAgentAuthCookie(
          result.accessToken,
          Math.max(1, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000)),
          this.cookieConfig,
        ),
      );
      return { expiresAt: result.expiresAt, user: result.principal };
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) await this.limiter.registerFailure(keys);
      throw error;
    }
  }

  @Get("session")
  @SkipThrottle()
  @ApiBearerAuth("agent-access-token")
  @ApiCookieAuth("agent-auth-cookie")
  @ApiOkResponse({ description: "Current agent session." })
  session(
    @CurrentAgentPrincipal() principal: AgentPrincipal,
    @Res({ passthrough: true }) response: ResponseLike,
  ) {
    response.setHeader("Cache-Control", "private, no-store");
    return { expiresAt: new Date(principal.exp * 1000).toISOString(), user: principal };
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  @ApiNoContentResponse({ description: "Agent cookie cleared." })
  logout(@Res({ passthrough: true }) response: ResponseLike): void {
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Set-Cookie", serializeExpiredAgentAuthCookie(this.cookieConfig));
  }
}
