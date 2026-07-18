import { Module } from "@nestjs/common";
import { AgentVisaApplicationsController } from "./agent-visa-applications.controller";
import { AdminVisaApplicationsController } from "./admin-visa-applications.controller";
import { VisaApplicationsService } from "./visa-applications.service";

@Module({
  controllers: [
    AgentVisaApplicationsController,
    AdminVisaApplicationsController,
  ],
  providers: [VisaApplicationsService],
  exports: [VisaApplicationsService],
})
export class VisaApplicationsModule {}
