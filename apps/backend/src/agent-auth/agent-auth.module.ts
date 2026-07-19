import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { AgentsModule } from "../agents/agents.module";
import { AuthModule } from "../auth/auth.module";
import { AgentAuthController } from "./agent-auth.controller";
import { AgentAuthGuard } from "./agent-auth.guard";
import { AgentAuthService } from "./agent-auth.service";

@Module({
  imports: [JwtModule.register({}), AgentsModule, AuthModule],
  controllers: [AgentAuthController],
  providers: [
    AgentAuthService,
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, auth: AgentAuthService, config: ConfigService) =>
        new AgentAuthGuard(reflector, auth, config),
      inject: [Reflector, AgentAuthService, ConfigService],
    },
  ],
  exports: [AgentAuthService],
})
export class AgentAuthModule {}
