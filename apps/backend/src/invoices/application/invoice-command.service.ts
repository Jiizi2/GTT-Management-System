import { Injectable, Inject } from "@nestjs/common";
import { CreateInvoiceDto } from "../dto/create-invoice.dto";
import { UpdateInvoiceDto } from "../dto/update-invoice.dto";
import { InvoiceRepository } from "../../domain/repositories/invoice.repository";
import { InvoiceListItem } from "../invoices-helpers";

import { PrismaService } from "../../prisma/prisma.service";

import { PrismaInvoiceRepository } from "../../infrastructure/repositories/prisma/prisma-invoice.repository";
import { MemoryInvoiceRepository } from "../../infrastructure/repositories/memory/memory-invoice.repository";
import { InvoiceMemoryStore } from "./invoice-memory-store";

@Injectable()
export class InvoiceCommandService {
  constructor(
    @Inject("InvoiceRepository") private invoiceRepo: InvoiceRepository,
  ) {
    if (!this.invoiceRepo || typeof this.invoiceRepo.create !== "function") {
      const dataSource = process.env.DATA_SOURCE === "prisma" ? "prisma" : "memory";
      const firstArg = this.invoiceRepo as any;
      const resolvedPrisma = (firstArg && (firstArg.$transaction || firstArg.invoiceClient || firstArg.invoice)) ? firstArg : ({} as PrismaService);

      const secondArg = arguments[1];
      const resolvedMemoryStore = secondArg instanceof InvoiceMemoryStore ? secondArg : new InvoiceMemoryStore();

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

  async create(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    return this.invoiceRepo.create(payload);
  }

  async update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    return this.invoiceRepo.update(id, payload);
  }

  async backfillLegacyItems(): Promise<{ count: number }> {
    return this.invoiceRepo.backfillLegacyItems();
  }
}
