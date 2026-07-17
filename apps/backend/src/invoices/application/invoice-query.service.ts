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
  ) {}

  get memoryStore(): InvoiceMemoryStore | undefined {
    if (this.invoiceRepo instanceof MemoryInvoiceRepository) {
      return this.invoiceRepo.memoryStore;
    }
    return undefined;
  }

  get prismaInvoiceDownPaymentColumnState(): boolean | null {
    if (this.invoiceRepo instanceof PrismaInvoiceRepository) {
      return this.invoiceRepo.prismaInvoiceDownPaymentColumnState;
    }
    return null;
  }

  set prismaInvoiceDownPaymentColumnState(value: boolean | null) {
    if (this.invoiceRepo instanceof PrismaInvoiceRepository) {
      this.invoiceRepo.prismaInvoiceDownPaymentColumnState = value;
    }
  }

  get prismaInvoiceRecipientNameColumnState(): boolean | null {
    if (this.invoiceRepo instanceof PrismaInvoiceRepository) {
      return this.invoiceRepo.prismaInvoiceRecipientNameColumnState;
    }
    return null;
  }

  set prismaInvoiceRecipientNameColumnState(value: boolean | null) {
    if (this.invoiceRepo instanceof PrismaInvoiceRepository) {
      this.invoiceRepo.prismaInvoiceRecipientNameColumnState = value;
    }
  }

  async listClients(): Promise<InvoiceClientListItem[]> {
    return this.invoiceRepo.listClients();
  }

  async findAll(agentId?: string): Promise<InvoiceListItem[]> {
    return this.invoiceRepo.findAll(agentId);
  }

  async findAllPaginated(pagination: PaginationDto, agentId?: string): Promise<PaginatedResponseDto<InvoiceListItem>> {
    return this.invoiceRepo.findAllPaginated(pagination, agentId);
  }

  async ensurePrismaInvoiceDownPaymentColumn(): Promise<boolean> {
    return this.invoiceRepo.ensureInvoiceDownPaymentColumn();
  }

  async ensurePrismaInvoiceRecipientNameColumn(): Promise<boolean> {
    return this.invoiceRepo.ensureInvoiceRecipientNameColumn();
  }
}
