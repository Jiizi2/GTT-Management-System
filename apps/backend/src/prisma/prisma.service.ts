import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { resolveConfiguredDataSource } from "../config/app-config";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly configService?: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const dataSource = resolveConfiguredDataSource(this.configService);
    if (dataSource !== "prisma") {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    const dataSource = resolveConfiguredDataSource(this.configService);
    if (dataSource !== "prisma") {
      return;
    }

    await this.$disconnect();
  }
}
