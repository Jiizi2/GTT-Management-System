import { Injectable, OnModuleInit, Inject } from "@nestjs/common";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { PaginationDto, PaginatedResponseDto } from "./dto/pagination.dto";
import { InvoiceQueryService } from "./application/invoice-query.service";
import { InvoiceCommandService } from "./application/invoice-command.service";
import { InvoiceListItem, InvoiceClientListItem } from "./invoices-helpers";

@Injectable()
export class InvoicesService implements OnModuleInit {
  constructor(
    @Inject(InvoiceQueryService) private readonly queryService: InvoiceQueryService,
    @Inject(InvoiceCommandService) private readonly commandService: InvoiceCommandService,
  ) {}
  get memoryInvoiceClients() {
    return this.commandService.memoryStore?.clients ?? [];
  }

  get memoryInvoices() {
    return this.commandService.memoryStore?.invoices ?? [];
  }

  get prismaInvoiceDownPaymentColumnState() {
    return this.queryService.prismaInvoiceDownPaymentColumnState;
  }
  set prismaInvoiceDownPaymentColumnState(value: boolean | null) {
    this.queryService.prismaInvoiceDownPaymentColumnState = value;
  }

  get prismaInvoiceRecipientNameColumnState() {
    return this.queryService.prismaInvoiceRecipientNameColumnState;
  }
  set prismaInvoiceRecipientNameColumnState(value: boolean | null) {
    this.queryService.prismaInvoiceRecipientNameColumnState = value;
  }

  async onModuleInit(): Promise<void> {
    await this.queryService.ensurePrismaInvoiceDownPaymentColumn();
    await this.queryService.ensurePrismaInvoiceRecipientNameColumn();
  }

  async listClients(): Promise<InvoiceClientListItem[]> {
    return this.queryService.listClients();
  }

  async findAll(agentId?: string): Promise<InvoiceListItem[]> {
    return this.queryService.findAll(agentId);
  }

  async findAllPaginated(pagination: PaginationDto, agentId?: string): Promise<PaginatedResponseDto<InvoiceListItem>> {
    return this.queryService.findAllPaginated(pagination, agentId);
  }

  async create(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    return this.commandService.create(payload);
  }

  async update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    return this.commandService.update(id, payload);
  }

  async delete(id: string): Promise<void> {
    return this.commandService.delete(id);
  }
}
