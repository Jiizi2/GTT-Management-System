import {
  Body,
  Controller,
  Delete,
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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { ApiErrorResponseDto } from "../http/api-error-response.dto";
import {
  resolveAuthCookieRuntimeConfig,
  serializeAuthCookie,
  serializeExpiredAuthCookie,
  type AuthCookieRuntimeConfig,
} from "./auth-cookie";
import { AuthService } from "./auth.service";
import { AuthLoginRateLimiter } from "./auth-login-rate-limiter";
import { Roles } from "./auth.roles";
import { LoginDto } from "./dto/login.dto";
import {
  AuthBrowserSessionResponseDto,
  AuthManagedUserResponseDto,
} from "./dto/auth-response.dto";
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
@ApiTags("Auth")
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
  @ApiOperation({
    summary: "Login dashboard",
    description: "Memvalidasi credential dan mengembalikan snapshot session browser sambil mengatur HttpOnly cookie.",
  })
  @ApiOkResponse({
    description: "Login berhasil dan session browser aktif.",
    type: AuthBrowserSessionResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ApiErrorResponseDto })
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
  @ApiBearerAuth("access-token")
  @ApiCookieAuth("auth-cookie")
  @ApiOperation({
    summary: "Ambil session aktif",
    description: "Mengembalikan snapshot session user yang sedang login dari bearer token atau cookie auth.",
  })
  @ApiOkResponse({
    description: "Session aktif berhasil dibaca.",
    type: AuthBrowserSessionResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
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
  @ApiOperation({
    summary: "Logout browser",
    description: "Menghapus cookie auth browser yang aktif.",
  })
  @ApiNoContentResponse({ description: "Cookie auth berhasil di-expire." })
  logout(@Res({ passthrough: true }) response: ResponseLike): void {
    response.setHeader("Cache-Control", "no-store, private");
    response.setHeader("Set-Cookie", serializeExpiredAuthCookie(this.authCookieRuntimeConfig));
  }

  @Get("users")
  @Roles("super-admin")
  @ApiBearerAuth("access-token")
  @ApiCookieAuth("auth-cookie")
  @ApiOperation({
    summary: "List managed users",
    description: "Mengembalikan daftar akun dashboard yang dikelola. Hanya untuk super-admin.",
  })
  @ApiOkResponse({
    description: "Daftar managed user berhasil dibaca.",
    type: AuthManagedUserResponseDto,
    isArray: true,
  })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async listManagedUsers() {
    return this.authService.listManagedUsers();
  }

  @Post("users")
  @Roles("super-admin")
  @HttpCode(201)
  @ApiBearerAuth("access-token")
  @ApiCookieAuth("auth-cookie")
  @ApiOperation({
    summary: "Buat managed user",
    description: "Membuat akun dashboard baru. Hanya untuk super-admin.",
  })
  @ApiCreatedResponse({
    description: "Managed user berhasil dibuat.",
    type: AuthManagedUserResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async createManagedUser(@Body() payload: CreateManagedUserDto) {
    return this.authService.createManagedUser({
      name: payload.name,
      email: payload.email,
      roleId: payload.roleId,
      password: payload.password,
    });
  }

  @Patch("users/:userId")
  @Roles("super-admin")
  @ApiBearerAuth("access-token")
  @ApiCookieAuth("auth-cookie")
  @ApiOperation({
    summary: "Update managed user",
    description: "Memperbarui profil dan role akun dashboard. Hanya untuk super-admin.",
  })
  @ApiParam({ name: "userId", example: "cluserid123" })
  @ApiOkResponse({
    description: "Managed user berhasil diperbarui.",
    type: AuthManagedUserResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async updateManagedUser(
    @Param("userId") userId: string,
    @Body() payload: UpdateManagedUserDto,
  ) {
    return this.authService.updateManagedUser(userId, {
      name: payload.name,
      email: payload.email,
      roleId: payload.roleId,
    });
  }

  @Put("users/:userId/password")
  @Roles("super-admin")
  @ApiBearerAuth("access-token")
  @ApiCookieAuth("auth-cookie")
  @ApiOperation({
    summary: "Set password managed user",
    description: "Mengatur ulang password managed user. Hanya untuk super-admin.",
  })
  @ApiParam({ name: "userId", example: "cluserid123" })
  @ApiOkResponse({
    description: "Password managed user berhasil diperbarui.",
    type: AuthManagedUserResponseDto,
  })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  async setManagedUserPassword(
    @Param("userId") userId: string,
    @Body() payload: SetManagedUserPasswordDto,
  ) {
    return this.authService.setManagedUserPassword(userId, payload.password);
  }

  @Delete("users/:userId")
  @Roles("super-admin")
  @HttpCode(204)
  @ApiBearerAuth("access-token")
  @ApiCookieAuth("auth-cookie")
  @ApiOperation({
    summary: "Hapus managed user",
    description: "Menghapus akun dashboard yang dikelola. Hanya untuk super-admin.",
  })
  @ApiParam({ name: "userId", example: "cluserid123" })
  @ApiNoContentResponse({ description: "Managed user berhasil dihapus." })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  async deleteManagedUser(@Param("userId") userId: string) {
    await this.authService.deleteManagedUser(userId);
  }
}
