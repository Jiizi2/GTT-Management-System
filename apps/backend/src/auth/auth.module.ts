import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthLoginRateLimiter } from "./auth-login-rate-limiter";
import { AuthService } from "./auth.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthLoginRateLimiter,
    AuthService,
    {
      provide: APP_GUARD,
      useFactory: (
        reflector: Reflector,
        authService: AuthService,
        configService: ConfigService,
      ) => new AuthGuard(reflector, authService, configService),
      inject: [Reflector, AuthService, ConfigService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
