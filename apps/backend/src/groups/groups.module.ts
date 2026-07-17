import { Module, forwardRef } from "@nestjs/common";
import { GroupsController } from "./http/groups.controller";
import { GroupsService } from "./application/groups.service";
import { HotelAgreementDraftsService } from "./application/hotel-agreement-drafts.service";
import { HotelAgreementDraftsController } from "./http/hotel-agreement-drafts.controller";
import { RepositoriesModule } from "../infrastructure/repositories/repositories.module";
import { AgentsModule } from "../agents/agents.module";

@Module({
  imports: [forwardRef(() => RepositoriesModule), AgentsModule],
  controllers: [GroupsController, HotelAgreementDraftsController],
  providers: [GroupsService, HotelAgreementDraftsService],
  exports: [GroupsService],
})
export class GroupsModule {}
