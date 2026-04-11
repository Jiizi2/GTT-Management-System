import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { validateEnvironment } from "./config/env.validation";
import { GroupsModule } from "./groups/groups.module";
import { HealthModule } from "./health/health.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { MasterDataModule } from "./master-data/master-data.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AppThrottlerGuard } from "./throttling/app-throttler.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: "default",
          ttl: configService.getOrThrow<number>("THROTTLE_DEFAULT_TTL_MS"),
          limit: configService.getOrThrow<number>("THROTTLE_DEFAULT_LIMIT"),
          blockDuration: configService.getOrThrow<number>("THROTTLE_DEFAULT_BLOCK_MS"),
        },
      ],
    }),
    AuthModule,
    PrismaModule,
    HealthModule,
    GroupsModule,
    InvoicesModule,
    MasterDataModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
