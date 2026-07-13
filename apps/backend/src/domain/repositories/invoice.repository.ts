import { CreateInvoiceDto } from "../../invoices/dto/create-invoice.dto";
import { UpdateInvoiceDto } from "../../invoices/dto/update-invoice.dto";
import { PaginationDto, PaginatedResponseDto } from "../../invoices/dto/pagination.dto";
import { InvoiceListItem, InvoiceClientListItem } from "../../invoices/invoices-helpers";

export interface InvoiceRepository {
  listClients(): Promise<InvoiceClientListItem[]>;
  findAll(): Promise<InvoiceListItem[]>;
  findAllPaginated(pagination: PaginationDto): Promise<PaginatedResponseDto<InvoiceListItem>>;
  create(payload: CreateInvoiceDto): Promise<InvoiceListItem>;
  update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem>;
  delete(id: string): Promise<void>;
  ensureInvoiceDownPaymentColumn(): Promise<boolean>;
  ensureInvoiceRecipientNameColumn(): Promise<boolean>;
}
