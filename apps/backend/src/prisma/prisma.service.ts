import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    const dataSource = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
    if (dataSource !== "prisma") {
      return;
    }

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    const dataSource = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
    if (dataSource !== "prisma") {
      return;
    }

    await this.$disconnect();
  }
}
