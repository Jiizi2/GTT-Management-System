import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { AgentPortalAccountsController } from "./agent-portal-accounts.controller";
import { AgentPortalAccountsService } from "./agent-portal-accounts.service";

@Module({
  controllers: [AgentsController, AgentPortalAccountsController],
  providers: [AgentsService, AgentPortalAccountsService],
  exports: [AgentsService, AgentPortalAccountsService],
})
export class AgentsModule {}
