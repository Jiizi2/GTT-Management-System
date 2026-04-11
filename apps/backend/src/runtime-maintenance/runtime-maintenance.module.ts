import { Module } from "@nestjs/common";
import { RuntimeRetentionService } from "./runtime-retention.service";

@Module({
  providers: [RuntimeRetentionService],
})
export class RuntimeMaintenanceModule {}
