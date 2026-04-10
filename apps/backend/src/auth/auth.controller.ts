import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import type { AuthTokenPayload } from "./auth.types";
import { Public } from "./auth.public";
import { UpdateManagedUserDto } from "./dto/update-managed-user.dto";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(200)
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Get("session")
  getSession(
    @Req()
    request: {
      authUser?: AuthTokenPayload;
    },
  ) {
    const authUser = request.authUser;
    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    return {
      user: {
        id: authUser.id,
        name: authUser.name,
        username: authUser.username,
        email: authUser.email,
        accessTier: authUser.accessTier,
      },
      expiresAt: new Date(authUser.exp * 1000).toISOString(),
    };
  }

  @Get("users")
  listManagedUsers(
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

  @Patch("users/:userId")
  updateManagedUser(
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

  private assertSuperAdminAccess(authUser: AuthTokenPayload): void {
    if (authUser.accessTier !== "super-admin") {
      throw new ForbiddenException("Super Admin access is required.");
    }
  }
}
