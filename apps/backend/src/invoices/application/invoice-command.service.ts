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
  ) {}

  get memoryStore(): InvoiceMemoryStore | undefined {
    if (this.invoiceRepo instanceof MemoryInvoiceRepository) {
      return this.invoiceRepo.memoryStore;
    }
    return undefined;
  }

  async create(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    return this.invoiceRepo.create(payload);
  }

  async update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    return this.invoiceRepo.update(id, payload);
  }

  async delete(id: string): Promise<void> {
    return this.invoiceRepo.delete(id);
  }
}
