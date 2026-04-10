import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthLoginRateLimiter } from "./auth-login-rate-limiter";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [
    AuthLoginRateLimiter,
    AuthService,
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, authService: AuthService) =>
        new AuthGuard(reflector, authService),
      inject: [Reflector, AuthService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
