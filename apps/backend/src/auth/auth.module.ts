import { Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  controllers: [AuthController],
  providers: [
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
