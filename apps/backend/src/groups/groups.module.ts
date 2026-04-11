import { Module } from "@nestjs/common";
import { GroupsController } from "./http/groups.controller";
import { GroupsService } from "./application/groups.service";

@Module({
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
