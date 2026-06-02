import { Module } from "@nestjs/common";
import { GroupsController } from "./http/groups.controller";
import { GroupsService } from "./application/groups.service";
import { HotelAgreementDraftsService } from "./application/hotel-agreement-drafts.service";
import { HotelAgreementDraftsController } from "./http/hotel-agreement-drafts.controller";

@Module({
  controllers: [GroupsController, HotelAgreementDraftsController],
  providers: [GroupsService, HotelAgreementDraftsService],
})
export class GroupsModule {}
