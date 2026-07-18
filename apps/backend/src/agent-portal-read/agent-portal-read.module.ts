import { Module } from "@nestjs/common";
import { RepositoriesModule } from "../infrastructure/repositories/repositories.module";
import { AgentPortalReadController } from "./agent-portal-read.controller";
import { AgentPortalReadService } from "./agent-portal-read.service";
import { AgentPortalGroupsController } from "./agent-portal-groups.controller";
import { AgentPortalGroupsService } from "./agent-portal-groups.service";
import { AgentPortalInvoicesController } from "./agent-portal-invoices.controller";
import { AgentPortalInvoicesService } from "./agent-portal-invoices.service";

@Module({
  imports: [RepositoriesModule],
  controllers: [AgentPortalReadController, AgentPortalGroupsController, AgentPortalInvoicesController],
  providers: [AgentPortalReadService, AgentPortalGroupsService, AgentPortalInvoicesService],
})
export class AgentPortalReadModule {}
