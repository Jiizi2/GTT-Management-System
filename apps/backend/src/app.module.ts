import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { GroupsModule } from "./groups/groups.module";
import { HealthModule } from "./health/health.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    HealthModule,
    GroupsModule,
    InvoicesModule,
  ],
})
export class AppModule {}
