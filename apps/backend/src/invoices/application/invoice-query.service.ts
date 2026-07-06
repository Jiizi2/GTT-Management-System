import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PaginationDto, PaginatedResponseDto } from "../dto/pagination.dto";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { InvoiceListItem, InvoiceClientListItem } from "../invoices-helpers";

import { PrismaService } from "../../prisma/prisma.service";
import { resolveConfiguredDataSource } from "../../config/app-config";

import { PrismaInvoiceRepository } from "../../infrastructure/repositories/prisma/prisma-invoice.repository";
import { MemoryInvoiceRepository } from "../../infrastructure/repositories/memory/memory-invoice.repository";
import { InvoiceMemoryStore } from "./invoice-memory-store";

@Injectable()
export class InvoiceQueryService {
  constructor(
    @Inject("InvoiceRepository") private invoiceRepo: InvoiceRepository,
    private readonly configService?: ConfigService,
  ) {
    if (!this.invoiceRepo || typeof this.invoiceRepo.findAll !== "function") {
      const dataSource = resolveConfiguredDataSource(this.configService);
      const firstArg = this.invoiceRepo as any;
      const resolvedPrisma = (firstArg && (firstArg.$transaction || firstArg.invoiceClient || firstArg.invoice)) ? firstArg : ({} as PrismaService);
      const resolvedMemoryStore = this.configService instanceof InvoiceMemoryStore ? this.configService : new InvoiceMemoryStore();

      if (dataSource === "prisma") {
        this.invoiceRepo = new PrismaInvoiceRepository(resolvedPrisma);
      } else {
        this.invoiceRepo = new MemoryInvoiceRepository(resolvedMemoryStore);
      }
    }
  }

  get memoryStore() {
    if (this.invoiceRepo && "memoryStore" in this.invoiceRepo) {
      return (this.invoiceRepo as any).memoryStore;
    }
    return undefined;
  }

  async listClients(): Promise<InvoiceClientListItem[]> {
    return this.invoiceRepo.listClients();
  }

  async findAll(): Promise<InvoiceListItem[]> {
    return this.invoiceRepo.findAll();
  }

  async findAllPaginated(pagination: PaginationDto): Promise<PaginatedResponseDto<InvoiceListItem>> {
    return this.invoiceRepo.findAllPaginated(pagination);
  }

  async ensurePrismaInvoiceDownPaymentColumn(): Promise<boolean> {
    return this.invoiceRepo.ensureInvoiceDownPaymentColumn();
  }

  async ensurePrismaInvoiceRecipientNameColumn(): Promise<boolean> {
    return this.invoiceRepo.ensureInvoiceRecipientNameColumn();
  }
}
