import { Module, Global, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { GroupsService } from "../../groups/application/groups.service";
import { GroupsModule } from "../../groups/groups.module";
import { InvoiceMemoryStore } from "../../invoices/application/invoice-memory-store";
import { GroupMemoryStore } from "./memory/group-memory-store";
import { resolveConfiguredDataSource } from "../../config/app-config";
import { PrismaInvoiceRepository } from "./prisma/prisma-invoice.repository";
import { MemoryInvoiceRepository } from "./memory/memory-invoice.repository";
import { PrismaGroupRepository } from "./prisma/prisma-group.repository";
import { MemoryGroupRepository } from "./memory/memory-group.repository";
import { PrismaHotelAgreementDraftRepository } from "./prisma/prisma-hotel-agreement-draft.repository";
import { MemoryHotelAgreementDraftRepository } from "./memory/memory-hotel-agreement-draft.repository";

@Global()
@Module({
  imports: [forwardRef(() => GroupsModule)],
  providers: [
    InvoiceMemoryStore,
    GroupMemoryStore,
    {
      provide: "InvoiceRepository",
      useFactory: (configService: ConfigService, prisma: PrismaService, memoryStore: InvoiceMemoryStore) => {
        const dataSource = resolveConfiguredDataSource(configService);
        return dataSource === "prisma"
          ? new PrismaInvoiceRepository(prisma)
          : new MemoryInvoiceRepository(memoryStore);
      },
      inject: [ConfigService, PrismaService, InvoiceMemoryStore],
    },
    {
      provide: "GroupRepository",
      useFactory: (configService: ConfigService, prisma: PrismaService, memoryStore: GroupMemoryStore) => {
        const dataSource = resolveConfiguredDataSource(configService);
        return dataSource === "prisma"
          ? new PrismaGroupRepository(prisma)
          : new MemoryGroupRepository(memoryStore);
      },
      inject: [ConfigService, PrismaService, GroupMemoryStore],
    },
    {
      provide: "HotelAgreementDraftRepository",
      useFactory: (configService: ConfigService, prisma: PrismaService, groupsService: GroupsService) => {
        const dataSource = resolveConfiguredDataSource(configService);
        return dataSource === "prisma"
          ? new PrismaHotelAgreementDraftRepository(prisma, groupsService)
          : new MemoryHotelAgreementDraftRepository(groupsService);
      },
      inject: [ConfigService, PrismaService, GroupsService],
    },
  ],
  exports: [
    "InvoiceRepository",
    "GroupRepository",
    "HotelAgreementDraftRepository",
    InvoiceMemoryStore,
    GroupMemoryStore,
  ],
})
export class RepositoriesModule {}
