import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SkipThrottle } from "@nestjs/throttler";
import {
  resolveAuthCookieRuntimeConfig,
  serializeAuthCookie,
  serializeExpiredAuthCookie,
  type AuthCookieRuntimeConfig,
} from "./auth-cookie";
import { AuthService } from "./auth.service";
import { AuthLoginRateLimiter } from "./auth-login-rate-limiter";
import { LoginDto } from "./dto/login.dto";
import type { AuthBrowserSession, AuthLoginResponse, AuthTokenPayload } from "./auth.types";
import { Public } from "./auth.public";
import { CreateManagedUserDto } from "./dto/create-managed-user.dto";
import { SetManagedUserPasswordDto } from "./dto/set-managed-user-password.dto";
import { UpdateManagedUserDto } from "./dto/update-managed-user.dto";

type ResponseLike = {
  setHeader: (name: string, value: string | readonly string[]) => void;
};

function toBrowserSession(response: AuthLoginResponse): AuthBrowserSession {
  return {
    expiresAt: response.expiresAt,
    rememberSession: response.rememberSession,
    user: response.user,
  };
}

@Controller("auth")
export class AuthController {
  private readonly authCookieRuntimeConfig: AuthCookieRuntimeConfig;

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(AuthLoginRateLimiter) private readonly authLoginRateLimiter: AuthLoginRateLimiter,
    private readonly configService?: ConfigService,
  ) {
    this.authCookieRuntimeConfig = resolveAuthCookieRuntimeConfig(this.configService);
  }

  @Public()
  @SkipThrottle()
  @Post("login")
  @HttpCode(200)
  async login(
    @Body() payload: LoginDto,
    @Res({ passthrough: true }) response: ResponseLike,
    @Req()
    request: {
      headers?: Record<string, unknown>;
      ip?: string;
      socket?: {
        remoteAddress?: string | null;
      };
    },
  ) {
    const rateLimitKeys = this.authLoginRateLimiter.resolveKeys(payload.identifier, request);
    await this.authLoginRateLimiter.assertAllowed(rateLimitKeys);

    try {
      const loginResponse = await this.authService.login(payload);
      await this.authLoginRateLimiter.registerSuccess(rateLimitKeys);
      response.setHeader("Cache-Control", "no-store, private");
      response.setHeader(
        "Set-Cookie",
        serializeAuthCookie({
          accessToken: loginResponse.accessToken,
          rememberSession: loginResponse.rememberSession,
          maxAgeSeconds: Math.max(
            1,
            Math.floor(
              (new Date(loginResponse.expiresAt).getTime() - Date.now()) / 1000,
            ),
          ),
        }, this.authCookieRuntimeConfig),
      );
      return toBrowserSession(loginResponse);
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        await this.authLoginRateLimiter.registerFailure(rateLimitKeys);
      }

      throw error;
    }
  }

  @Get("session")
  getSession(
    @Res({ passthrough: true }) response: ResponseLike,
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    const authUser = request.authUser;
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    response.setHeader("Cache-Control", "no-store, private");
    return {
      user: {
        id: authUser.id,
        name: authUser.name,
        username: authUser.username,
        email: authUser.email,
        accessTier: authUser.accessTier,
      },
      expiresAt: new Date(authUser.exp * 1000).toISOString(),
      rememberSession: authUser.rememberSession,
    };
  }

  @Public()
  @SkipThrottle()
  @Post("logout")
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: ResponseLike): void {
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Set-Cookie", serializeExpiredAuthCookie(this.authCookieRuntimeConfig));
  }

  @Get("users")
  async listManagedUsers(
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    const authUser = request.authUser;
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    this.assertSuperAdminAccess(authUser);
    return this.authService.listManagedUsers();
  }

  @Post("users")
  @HttpCode(201)
  async createManagedUser(
    @Body() payload: CreateManagedUserDto,
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    const authUser = request.authUser;
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    this.assertSuperAdminAccess(authUser);
    return this.authService.createManagedUser({
      name: payload.name,
      email: payload.email,
      roleId: payload.roleId,
      password: payload.password,
    });
  }

  @Patch("users/:userId")
  async updateManagedUser(
    @Param("userId") userId: string,
    @Body() payload: UpdateManagedUserDto,
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    const authUser = request.authUser;
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    this.assertSuperAdminAccess(authUser);
    return this.authService.updateManagedUser(userId, {
      name: payload.name,
      email: payload.email,
      roleId: payload.roleId,
    });
  }

  @Put("users/:userId/password")
  async setManagedUserPassword(
    @Param("userId") userId: string,
    @Body() payload: SetManagedUserPasswordDto,
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    const authUser = request.authUser;
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    this.assertSuperAdminAccess(authUser);
    return this.authService.setManagedUserPassword(userId, payload.password);
  }

  @Delete("users/:userId")
  @HttpCode(204)
  async deleteManagedUser(
    @Param("userId") userId: string,
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    const authUser = request.authUser;
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    this.assertSuperAdminAccess(authUser);
    await this.authService.deleteManagedUser(userId);
  }

  private assertSuperAdminAccess(authUser: AuthTokenPayload): void {
    if (authUser.accessTier !== "super-admin") {
      throw new ForbiddenException("Super Admin access is required.");
    }
  }
}
