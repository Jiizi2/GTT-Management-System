import { Module } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { InvoiceValidator } from "./domain/invoice-validator";
import { InvoiceNumberGenerator } from "./domain/invoice-number-generator";
import { InvoiceMemoryStore } from "./application/invoice-memory-store";
import { InvoiceQueryService } from "./application/invoice-query.service";
import { InvoiceCommandService } from "./application/invoice-command.service";
import { InvoiceDocumentAssetsService } from "./invoice-document-assets.service";

@Module({
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    InvoiceValidator,
    InvoiceNumberGenerator,
    InvoiceMemoryStore,
    InvoiceQueryService,
    InvoiceCommandService,
    InvoiceDocumentAssetsService,
  ],
})
export class InvoicesModule {}
