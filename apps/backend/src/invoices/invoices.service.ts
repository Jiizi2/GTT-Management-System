import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { resolveConfiguredDataSource } from "../config/app-config";
import { createStructuredLogger } from "../logging/create-structured-logger";
import { PrismaService } from "../prisma/prisma.service";
import { Telemetry } from "../logging/telemetry";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import {
  toIsoDateOnly,
  toUtcMidnightDate as createUtcDateFromIso,
  isIsoDateOnly,
} from "../utils/date-helpers";

type InvoiceStatusLabel = "Paid" | "Pending" | "Overdue" | "Cancelled" | "Partially Paid";
type InvoiceLineItemCurrency = "IDR" | "USD" | "SAR";

type InvoiceLineItem = {
  description: string;
  pax: number;
  currency: InvoiceLineItemCurrency;
  unitPrice: number;
  totalPrice: number;
  totalPriceIdr: number;
};

type InvoiceClientListItem = {
  id: string;
  name: string;
  sortOrder: number;
  label: string;
  groupCode?: string;
  groupName?: string;
};

type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientLabel: string;
  clientInitials: string;
  groupCode?: string;
  groupName?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  status: InvoiceStatusLabel;
  monthKey: string;
  recipientName?: string;
  notes?: string;
  items?: InvoiceLineItem[];
  version?: number;
};

type MemoryInvoiceClient = {
  id: string;
  name: string;
  sortOrder: number;
  groupCode?: string;
  groupName?: string;
};

type MemoryInvoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  groupCode?: string;
  groupName?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  status: InvoiceStatus;
  notes?: string;
  recipientName?: string;
  items?: InvoiceLineItem[];
};

type ResolvedPrismaInvoiceClient = {
  id: string;
  groupId: string | null;
};

const invoiceSummarySelect = {
  id: true,
  invoiceNumber: true,
  clientId: true,
  issuedDate: true,
  dueDate: true,
  amount: true,
  status: true,
  notes: true,
  items: true,
  recipientName: true,
  version: true,
  client: {
    select: {
      name: true,
      sortOrder: true,
    },
  },
  group: {
    select: {
      code: true,
      name: true,
    },
  },
  itemsRel: {
    select: {
      description: true,
      pax: true,
      currency: true,
      unitPrice: true,
      totalPrice: true,
      totalPriceIdr: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

const invoiceSummarySelectWithDownPayment = {
  ...invoiceSummarySelect,
  downPaymentIdr: true,
} satisfies Prisma.InvoiceSelect;

type PrismaInvoiceSummaryRow = Prisma.InvoiceGetPayload<{
  select: typeof invoiceSummarySelect;
}>;

type PrismaInvoiceSummaryRowWithOptionalDownPayment = PrismaInvoiceSummaryRow & {
  downPaymentIdr?: Prisma.Decimal | number | null;
};

type PrismaInvoiceDownPaymentRow = {
  downPaymentIdr: Prisma.Decimal | number | null;
};

function validateAmounts(payload: { amount?: number; downPaymentIdr?: number }) {
  if (payload.downPaymentIdr !== undefined && payload.downPaymentIdr < 0) {
    throw new BadRequestException("Nominal downpayment tidak boleh kurang dari 0.");
  }
  if (payload.amount !== undefined && payload.amount < 0) {
    throw new BadRequestException("Nominal amount invoice tidak boleh kurang dari 0.");
  }
}

function validateItems(items: any) {
  if (items === undefined) return;
  if (!Array.isArray(items)) {
    throw new BadRequestException("Format items invoice tidak valid.");
  }
  for (const item of items) {
    if (!item || typeof item !== "object") {
      throw new BadRequestException("Item invoice tidak valid.");
    }
    const { description, currency, pax, unitPrice } = item as any;
    if (!description || typeof description !== "string" || !description.trim()) {
      throw new BadRequestException("Uraian item invoice tidak boleh kosong.");
    }
    const cleanCurrency = String(currency).trim().toUpperCase();
    if (cleanCurrency !== "IDR" && cleanCurrency !== "USD" && cleanCurrency !== "SAR") {
      throw new BadRequestException(`Mata uang item '${cleanCurrency}' tidak valid.`);
    }
    if (Number(pax) <= 0 || !Number.isInteger(Number(pax))) {
      throw new BadRequestException("Jumlah PAX item invoice harus berupa bilangan bulat positif.");
    }
    if (Number(unitPrice) <= 0) {
      throw new BadRequestException("Harga unit item invoice harus lebih dari 0.");
    }
  }
}

function validatePayments(notes: string | undefined) {
  if (notes === undefined) return;
  const match = notes.match(/\[Payments:([^\]]+)\]/);
  if (match) {
    try {
      const paymentsList = JSON.parse(decodeURIComponent(match[1]));
      if (Array.isArray(paymentsList)) {
        for (const p of paymentsList) {
          if ((Number(p.amount) || 0) < 0) {
            throw new BadRequestException("Nominal pembayaran tidak boleh kurang dari 0.");
          }
        }
      }
    } catch (e) {
      throw new BadRequestException("Tag pembayaran dalam notes memiliki format JSON yang tidak valid.");
    }
  }
}

function validateInvoicePayloadInvariants(payload: {
  amount?: number;
  downPaymentIdr?: number;
  notes?: string;
  items?: any;
}) {
  validateAmounts(payload);
  validateItems(payload.items);
  validatePayments(payload.notes);
}

function normalizeIsoDate(input: string, fieldName: "issuedDate" | "dueDate"): string {
  const trimmed = input.trim();
  if (isIsoDateOnly(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${fieldName} value: '${input}'.`);
  }

  return toIsoDateOnly(parsed);
}

function formatClientLabel(sortOrder: number, name: string): string {
  return `${String(sortOrder).padStart(2, "0")}. ${name.trim()}`;
}

function getInitials(name: string): string {
  const chunks = name
    .trim()
    .split(/\s+/)
    .map((chunk) => chunk[0]?.toUpperCase())
    .filter((chunk): chunk is string => Boolean(chunk));

  if (chunks.length === 0) {
    return "NA";
  }

  return chunks.slice(0, 2).join("");
}

function extractInvoiceSerial(invoiceNumber: string): number | null {
  const matched = invoiceNumber.trim().match(/\/(\d+)$/);
  if (!matched) {
    return null;
  }

  const serialValue = Number.parseInt(matched[1], 10);
  if (!Number.isFinite(serialValue)) {
    return null;
  }

  return serialValue;
}

function toStatusLabel(status: InvoiceStatus): InvoiceStatusLabel {
  if (status === InvoiceStatus.CANCELLED) {
    return "Cancelled";
  }

  if (status === InvoiceStatus.PAID) {
    return "Paid";
  }

  if (status === InvoiceStatus.OVERDUE) {
    return "Overdue";
  }

  if (status === InvoiceStatus.PARTIALLY_PAID) {
    return "Partially Paid";
  }

  return "Pending";
}

function resolveMonthKey(isoDate: string): string {
  return isIsoDateOnly(isoDate) ? isoDate.slice(0, 7) : "unknown";
}

function resolveEffectiveStatus(
  status: InvoiceStatus,
  dueDateIso: string,
  amount: number,
  downPaymentIdr: number,
  notes?: string,
): InvoiceStatus {
  if (status === InvoiceStatus.CANCELLED) {
    return InvoiceStatus.CANCELLED;
  }

  const sanitizedAmount = Math.max(0, Math.round(amount));
  const sanitizedDownPayment = Math.max(0, Math.round(downPaymentIdr));

  if (sanitizedAmount > 0 && sanitizedDownPayment >= sanitizedAmount) {
    return InvoiceStatus.PAID;
  }

  if (status === InvoiceStatus.PAID) {
    return InvoiceStatus.PAID;
  }

  const isNoDueDate = notes?.includes("[NoDueDate:true]");
  if (!isNoDueDate && dueDateIso && dueDateIso !== "none") {
    const todayIso = toIsoDateOnly(new Date());
    if (dueDateIso < todayIso) {
      return InvoiceStatus.OVERDUE;
    }
  }

  if (status === InvoiceStatus.OVERDUE) {
    return isNoDueDate ? InvoiceStatus.PENDING : InvoiceStatus.OVERDUE;
  }

  if (sanitizedDownPayment > 0 && sanitizedDownPayment < sanitizedAmount) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  if (status === InvoiceStatus.PARTIALLY_PAID) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  return InvoiceStatus.PENDING;
}


function buildInvoiceNumber(year: string, serial: number): string {
  return `GTT/INV/${year}/${String(serial).padStart(4, "0")}`;
}

function extractYearFromIsoDate(isoDate: string): string {
  return isIsoDateOnly(isoDate) ? isoDate.slice(0, 4) : toIsoDateOnly(new Date()).slice(0, 4);
}

function toNumberAmount(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDownPaymentByAmount(amount: number, downPaymentIdr: number): number {
  const sanitizedAmount = Math.max(0, Math.round(amount));
  const sanitizedDownPayment = Math.max(0, Math.round(downPaymentIdr));
  return Math.min(sanitizedAmount, sanitizedDownPayment);
}

function resolveDisplayedDownPaymentByAmount(
  amount: number,
  status: InvoiceStatus,
  downPaymentIdr: Prisma.Decimal | number | null | undefined,
): number {
  const sanitizedAmount = Math.max(0, Math.round(amount));
  const normalizedDownPayment = normalizeDownPaymentByAmount(sanitizedAmount, toNumberAmount(downPaymentIdr));
  if (normalizedDownPayment > 0) {
    return normalizedDownPayment;
  }

  return status === InvoiceStatus.PAID ? sanitizedAmount : 0;
}

function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function isInvoiceLineItemCurrency(value: string): value is InvoiceLineItemCurrency {
  return value === "IDR" || value === "USD" || value === "SAR";
}

function extractExchangeRatesFromNotes(notes: string | undefined): { usdToIdr: number; sarToIdr: number } {
  const rates = { usdToIdr: 0, sarToIdr: 0 };
  if (!notes) return rates;
  const match = notes.match(/\[ExchangeRate:USD=(\d+),SAR=(\d+)\]/);
  if (match) {
    rates.usdToIdr = Number.parseInt(match[1], 10);
    rates.sarToIdr = Number.parseInt(match[2], 10);
  }
  return rates;
}

function normalizeInvoiceLineItem(
  value: unknown,
  usdToIdr: number,
  sarToIdr: number,
): InvoiceLineItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const description = getTrimmedString(item.description);
  const currency = getTrimmedString(item.currency).toUpperCase();
  const pax = Math.max(0, Math.round(coerceNumber(item.pax, 0)));
  const unitPrice = Math.max(0, Math.round(coerceNumber(item.unitPrice, 0)));

  // Authoritatively recalculate totalPrice to reinforce data integrity
  const totalPrice = pax * unitPrice;

  // Authoritatively recalculate totalPriceIdr using extracted exchange rates
  let totalPriceIdr = totalPrice;
  if (currency === "USD" && usdToIdr > 0) {
    totalPriceIdr = totalPrice * usdToIdr;
  } else if (currency === "SAR" && sarToIdr > 0) {
    totalPriceIdr = totalPrice * sarToIdr;
  } else if (currency !== "IDR") {
    totalPriceIdr = Math.max(0, Math.round(coerceNumber(item.totalPriceIdr, totalPrice)));
  }

  if (!description || !isInvoiceLineItemCurrency(currency) || pax <= 0 || unitPrice <= 0) {
    return null;
  }

  return {
    description,
    pax,
    currency,
    unitPrice,
    totalPrice,
    totalPriceIdr,
  };
}

function normalizeInvoiceLineItems(items: unknown, notes?: string): InvoiceLineItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const { usdToIdr, sarToIdr } = extractExchangeRatesFromNotes(notes);
  return items
    .map((item) => normalizeInvoiceLineItem(item, usdToIdr, sarToIdr))
    .filter((item): item is InvoiceLineItem => item !== null);
}

function parseStoredInvoiceLineItems(items: unknown): InvoiceLineItem[] | undefined {
  const normalizedItems = normalizeInvoiceLineItems(items);
  return normalizedItems.length > 0 ? normalizedItems : undefined;
}

function resolveInvoiceAmountFromItems(
  amount: number,
  items: ReadonlyArray<InvoiceLineItem> | undefined,
): number {
  const normalizedAmount = Math.max(0, Math.round(amount));
  if (!items || items.length === 0) {
    return normalizedAmount;
  }

  const itemsTotalIdr = items.reduce((total, item) => total + Math.max(0, Math.round(item.totalPriceIdr)), 0);
  return itemsTotalIdr > 0 ? itemsTotalIdr : normalizedAmount;
}

function resolveStoredInvoiceAmount(
  amount: number,
  items: ReadonlyArray<InvoiceLineItem> | undefined,
): number {
  const normalizedAmount = Math.max(0, Math.round(amount));
  if (normalizedAmount > 0 || !items || items.length === 0) {
    return normalizedAmount;
  }

  const itemsTotalIdr = items.reduce((total, item) => total + Math.max(0, Math.round(item.totalPriceIdr)), 0);
  return itemsTotalIdr > 0 ? itemsTotalIdr : normalizedAmount;
}

function hasInvoiceStatusEnumMismatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes('invalid input value for enum "InvoiceStatus"') ||
    message.includes("InvoiceStatus") && message.includes("CANCELLED")
  );
}

function isRetryablePrismaWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

function resolveNextClientSortOrder<T extends { sortOrder: number }>(clients: T[]): number {
  const usedSortOrders = new Set(
    clients
      .map((client) => Math.max(1, Math.round(client.sortOrder)))
      .filter((sortOrder) => Number.isFinite(sortOrder)),
  );

  let nextSortOrder = 1;
  while (usedSortOrders.has(nextSortOrder)) {
    nextSortOrder += 1;
  }

  return nextSortOrder;
}

function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInvoiceClientName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

@Injectable()
export class InvoicesService implements OnModuleInit {
  private readonly dataSource: "memory" | "prisma";
  private readonly logger = createStructuredLogger(InvoicesService.name);
  private readonly memoryInvoiceClients: MemoryInvoiceClient[] = [
    {
      id: randomUUID(),
      name: "Yassir",
      sortOrder: 1,
      groupCode: "9017000001",
      groupName: "Dummy Trip Lengkap",
    },
    {
      id: randomUUID(),
      name: "Haris",
      sortOrder: 2,
    },
    {
      id: randomUUID(),
      name: "JSA",
      sortOrder: 3,
    },
  ];
  private readonly memoryInvoices: MemoryInvoice[] = [];
  private prismaInvoiceDownPaymentColumnState: boolean | null = null;
  private prismaInvoiceDownPaymentColumnInitPromise: Promise<boolean> | null = null;
  private prismaInvoiceRecipientNameColumnState: boolean | null = null;
  private prismaInvoiceRecipientNameColumnInitPromise: Promise<boolean> | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.dataSource = resolveConfiguredDataSource(this.configService);
  }

  async onModuleInit(): Promise<void> {
    if (this.dataSource !== "prisma") {
      return;
    }

    await this.ensurePrismaInvoiceDownPaymentColumn();
    await this.ensurePrismaInvoiceRecipientNameColumn();
  }

  async listClients(): Promise<InvoiceClientListItem[]> {
    if (this.dataSource === "prisma") {
      return this.listClientsWithPrisma();
    }

    return this.listClientsFromMemory();
  }

  async findAll(): Promise<InvoiceListItem[]> {
    if (this.dataSource === "prisma") {
      return this.findAllWithPrisma();
    }

    return this.findAllFromMemory();
  }

  async create(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    const created =
      this.dataSource === "prisma"
        ? await this.createWithPrisma(payload)
        : this.createInMemory(payload);
    this.logInvoiceMutation("invoice.created", created);
    return created;
  }

  async update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    const updated =
      this.dataSource === "prisma"
        ? await this.updateWithPrisma(id, payload)
        : this.updateInMemory(id, payload);
    this.logInvoiceMutation("invoice.updated", updated);
    return updated;
  }

  private resolveClientForCreateInMemory(payload: CreateInvoiceDto): MemoryInvoiceClient {
    const requestedClientId = getTrimmedString(payload.clientId);
    if (requestedClientId) {
      const matchedClient = this.memoryInvoiceClients.find((entry) => entry.id === requestedClientId);
      if (!matchedClient) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }

      return matchedClient;
    }

    const requestedClientName = normalizeInvoiceClientName(getTrimmedString(payload.clientName));
    if (!requestedClientName) {
      throw new BadRequestException("Either clientId or clientName is required.");
    }

    const existingByName = this.memoryInvoiceClients.find(
      (entry) => entry.name.trim().toLowerCase() === requestedClientName.toLowerCase(),
    );
    if (existingByName) {
      return existingByName;
    }

    const nextSortOrder = resolveNextClientSortOrder(this.memoryInvoiceClients);
    const createdClient: MemoryInvoiceClient = {
      id: randomUUID(),
      name: requestedClientName,
      sortOrder: nextSortOrder,
    };
    this.memoryInvoiceClients.push(createdClient);
    return createdClient;
  }

  private async resolveClientForCreateWithPrisma(
    payload: CreateInvoiceDto,
  ): Promise<ResolvedPrismaInvoiceClient> {
    const requestedClientId = getTrimmedString(payload.clientId);
    if (requestedClientId) {
      const matchedClient = await this.prisma.invoiceClient.findUnique({
        where: {
          id: requestedClientId,
        },
        select: {
          id: true,
          groupId: true,
        },
      });

      if (!matchedClient) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }

      return {
        id: matchedClient.id,
        groupId: matchedClient.groupId ?? null,
      };
    }

    const requestedClientName = normalizeInvoiceClientName(getTrimmedString(payload.clientName));
    if (!requestedClientName) {
      throw new BadRequestException("Either clientId or clientName is required.");
    }

    const existingByName = await this.findPrismaInvoiceClientByName(requestedClientName);
    if (existingByName) {
      return existingByName;
    }

    return this.createInvoiceClientWithPrisma(requestedClientName);
  }

  private async createInvoiceClientWithPrisma(clientName: string): Promise<ResolvedPrismaInvoiceClient> {
    const normalizedClientName = normalizeInvoiceClientName(clientName);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.acquirePrismaTransactionLock(tx, "invoice-client-name", normalizedClientName.toLowerCase());

          const existingByName = await this.findPrismaInvoiceClientByName(normalizedClientName, tx);
          if (existingByName) {
            return existingByName;
          }

          await this.acquirePrismaTransactionLock(tx, "invoice-client-sort-order", "global");

          const maxSortOrderAggregate = await tx.invoiceClient.aggregate({
            _max: {
              sortOrder: true,
            },
          });
          const nextSortOrder = (maxSortOrderAggregate._max.sortOrder ?? 0) + 1;
          const createdClient = await tx.invoiceClient.create({
            data: {
              name: normalizedClientName,
              sortOrder: nextSortOrder,
            },
            select: {
              id: true,
              groupId: true,
            },
          });

          this.logger.info(
            {
              action: "invoice-client.created",
              dataSource: this.dataSource,
              clientId: createdClient.id,
              clientName: normalizedClientName,
              sortOrder: nextSortOrder,
            },
            "Invoice client created.",
          );

          return {
            id: createdClient.id,
            groupId: createdClient.groupId ?? null,
          };
        });
      } catch (error: unknown) {
        if (isRetryablePrismaWriteConflict(error) && attempt < 2) {
          continue;
        }

        if (isRetryablePrismaWriteConflict(error)) {
          throw new ConflictException("Failed to create invoice client. Please retry.");
        }

        throw error;
      }
    }

    throw new ConflictException("Failed to create invoice client. Please retry.");
  }

  private listClientsFromMemory(): InvoiceClientListItem[] {
    return [...this.memoryInvoiceClients]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((client) => ({
        id: client.id,
        name: client.name,
        sortOrder: client.sortOrder,
        label: formatClientLabel(client.sortOrder, client.name),
        groupCode: client.groupCode,
        groupName: client.groupName,
      }));
  }

  private findAllFromMemory(): InvoiceListItem[] {
    const todayIso = toIsoDateOnly(new Date());
    this.memoryInvoices.forEach((inv) => {
      const isNoDueDate = inv.notes?.includes("[NoDueDate:true]");
      if (
        !isNoDueDate &&
        (inv.status === InvoiceStatus.PENDING || inv.status === InvoiceStatus.PARTIALLY_PAID) &&
        inv.dueDateIso < todayIso
      ) {
        inv.status = InvoiceStatus.OVERDUE;
      }
    });

    return [...this.memoryInvoices]
      .sort((left, right) => {
        const dueDateDiff = right.dueDateIso.localeCompare(left.dueDateIso);
        if (dueDateDiff !== 0) {
          return dueDateDiff;
        }

        return right.invoiceNumber.localeCompare(left.invoiceNumber);
      })
      .map((invoice) => {
        const client = this.memoryInvoiceClients.find((entry) => entry.id === invoice.clientId);
        if (!client) {
          throw new NotFoundException(`Invoice client '${invoice.clientId}' not found.`);
        }

        return this.mapMemoryInvoiceToListItem(invoice, client);
      });
  }

  private createInMemory(payload: CreateInvoiceDto): InvoiceListItem {
    const client = this.resolveClientForCreateInMemory(payload);

    const issuedDateIso = normalizeIsoDate(payload.issuedDate, "issuedDate");
    const isNoDueDate = !payload.dueDate || !payload.dueDate.trim();
    const dueDateIso = isNoDueDate
      ? issuedDateIso
      : normalizeIsoDate(payload.dueDate!, "dueDate");
    const invoiceYear = extractYearFromIsoDate(dueDateIso);
    const existingInvoiceNumbers = this.memoryInvoices.map((entry) => entry.invoiceNumber);
    const invoiceNumber = buildInvoiceNumber(invoiceYear, this.resolveNextSerial(existingInvoiceNumbers));
    const normalizedItems = payload.items !== undefined ? normalizeInvoiceLineItems(payload.items) : [];
    const baseAmount = resolveInvoiceAmountFromItems(payload.amount, normalizedItems);
    const roundedAmount = Math.max(0, Math.round(baseAmount));
    let notes = getTrimmedString(payload.notes);
    if (isNoDueDate && !notes.includes("[NoDueDate:true]")) {
      notes = `${notes}\n[NoDueDate:true]`.trim();
    }
    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? InvoiceStatus.PENDING,
      dueDateIso,
      roundedAmount,
      payload.downPaymentIdr ?? 0,
      notes,
    );
    const normalizedGroupCode = getTrimmedString(payload.groupCode).toUpperCase();

    const createdInvoice: MemoryInvoice = {
      id: randomUUID(),
      invoiceNumber,
      clientId: client.id,
      groupCode: normalizedGroupCode || client.groupCode,
      groupName: normalizedGroupCode ? undefined : client.groupName,
      issuedDateIso,
      dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: normalizeDownPaymentByAmount(roundedAmount, payload.downPaymentIdr ?? 0),
      status: effectiveStatus,
      notes: notes || undefined,
      recipientName: getTrimmedString(payload.recipientName) || undefined,
      items: normalizedItems.length > 0 ? normalizedItems : undefined,
    };

    this.memoryInvoices.unshift(createdInvoice);
    return this.mapMemoryInvoiceToListItem(createdInvoice, client);
  }

  private updateInMemory(id: string, payload: UpdateInvoiceDto): InvoiceListItem {
    const invoiceIndex = this.memoryInvoices.findIndex((entry) => entry.id === id);
    if (invoiceIndex < 0) {
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }

    const currentInvoice = this.memoryInvoices[invoiceIndex];
    const requestedClientId = getTrimmedString(payload.clientId);
      const requestedClientName = normalizeInvoiceClientName(getTrimmedString(payload.clientName));
    let resolvedClient: MemoryInvoiceClient | undefined;

    if (requestedClientId) {
      resolvedClient = this.memoryInvoiceClients.find((entry) => entry.id === requestedClientId);
      if (!resolvedClient) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }
    } else if (requestedClientName) {
      resolvedClient = this.memoryInvoiceClients.find(
        (entry) => entry.name.trim().toLowerCase() === requestedClientName.toLowerCase(),
      );

      if (!resolvedClient) {
        const nextSortOrder = resolveNextClientSortOrder(this.memoryInvoiceClients);
        resolvedClient = {
          id: randomUUID(),
          name: requestedClientName,
          sortOrder: nextSortOrder,
        };
        this.memoryInvoiceClients.push(resolvedClient);
      }
    } else {
      resolvedClient = this.memoryInvoiceClients.find((entry) => entry.id === currentInvoice.clientId);
    }

    if (!resolvedClient) {
      throw new NotFoundException(`Invoice client '${currentInvoice.clientId}' not found.`);
    }

    const issuedDateIso = payload.issuedDate
      ? normalizeIsoDate(payload.issuedDate, "issuedDate")
      : currentInvoice.issuedDateIso;

    const isNoDueDate = payload.dueDate !== undefined
      ? (!payload.dueDate || !payload.dueDate.trim())
      : (currentInvoice.notes?.includes("[NoDueDate:true]") ?? false);

    const dueDateIso = (payload.dueDate !== undefined && payload.dueDate.trim())
      ? normalizeIsoDate(payload.dueDate!, "dueDate")
      : issuedDateIso;

    const baseAmount = payload.amount !== undefined ? payload.amount : currentInvoice.amount;
    const normalizedItems = payload.items !== undefined ? normalizeInvoiceLineItems(payload.items) : undefined;
    const resolvedAmount =
      payload.items !== undefined ? resolveInvoiceAmountFromItems(baseAmount, normalizedItems) : baseAmount;
    const roundedAmount = Math.max(0, Math.round(resolvedAmount));
    const nextDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr !== undefined ? payload.downPaymentIdr : currentInvoice.downPaymentIdr,
    );

    let notes = payload.notes !== undefined ? payload.notes.trim() : (currentInvoice.notes ?? "");
    if (isNoDueDate) {
      if (!notes.includes("[NoDueDate:true]")) {
        notes = `${notes}\n[NoDueDate:true]`.trim();
      }
    } else {
      notes = notes.replace(/\[NoDueDate:true\]/g, "").trim();
    }

    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? currentInvoice.status,
      dueDateIso,
      roundedAmount,
      nextDownPaymentIdr,
      notes,
    );

    let nextGroupCode = currentInvoice.groupCode;
    let nextGroupName = currentInvoice.groupName;
    if (payload.groupCode !== undefined) {
      const normalizedGroupCode = payload.groupCode.trim().toUpperCase();
      if (normalizedGroupCode.length > 0) {
        nextGroupCode = normalizedGroupCode;
        nextGroupName = undefined;
      } else {
        nextGroupCode = resolvedClient.groupCode;
        nextGroupName = resolvedClient.groupName;
      }
    } else if (!nextGroupCode && resolvedClient.groupCode) {
      nextGroupCode = resolvedClient.groupCode;
      nextGroupName = resolvedClient.groupName;
    }

    const nextRecipientName =
      payload.recipientName !== undefined ? payload.recipientName.trim() || undefined : currentInvoice.recipientName;

    const updatedInvoice: MemoryInvoice = {
      ...currentInvoice,
      clientId: resolvedClient.id,
      groupCode: nextGroupCode,
      groupName: nextGroupName,
      issuedDateIso,
      dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: nextDownPaymentIdr,
      status: effectiveStatus,
      notes: notes || undefined,
      recipientName: nextRecipientName,
      items: normalizedItems !== undefined ? (normalizedItems.length > 0 ? normalizedItems : undefined) : currentInvoice.items,
    };

    this.memoryInvoices[invoiceIndex] = updatedInvoice;
    return this.mapMemoryInvoiceToListItem(updatedInvoice, resolvedClient);
  }

  private mapMemoryInvoiceToListItem(
    invoice: MemoryInvoice,
    client: MemoryInvoiceClient,
  ): InvoiceListItem {
    const baseAmount = resolveStoredInvoiceAmount(invoice.amount, invoice.items);
    const roundedAmount = Math.max(0, Math.round(baseAmount));
    const effectiveStatus = resolveEffectiveStatus(
      invoice.status,
      invoice.dueDateIso,
      roundedAmount,
      invoice.downPaymentIdr,
      invoice.notes,
    );
    const isNoDueDate = invoice.notes?.includes("[NoDueDate:true]");
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: client.id,
      clientName: client.name,
      clientLabel: formatClientLabel(client.sortOrder, client.name),
      clientInitials: getInitials(client.name),
      groupCode: invoice.groupCode ?? client.groupCode,
      groupName: invoice.groupName ?? client.groupName,
      issuedDateIso: invoice.issuedDateIso,
      dueDateIso: isNoDueDate ? "" : invoice.dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: resolveDisplayedDownPaymentByAmount(roundedAmount, effectiveStatus, invoice.downPaymentIdr),
      status: toStatusLabel(effectiveStatus),
      monthKey: resolveMonthKey(invoice.dueDateIso),
      recipientName: invoice.recipientName,
      notes: invoice.notes,
      items: invoice.items?.length ? invoice.items : undefined,
    };
  }

  private async listClientsWithPrisma(): Promise<InvoiceClientListItem[]> {
    const clients = await this.prisma.invoiceClient.findMany({
      include: {
        group: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      sortOrder: client.sortOrder,
      label: formatClientLabel(client.sortOrder, client.name),
      groupCode: client.group?.code,
      groupName: client.group?.name,
    }));
  }

  private async ensurePrismaInvoiceDownPaymentColumn(): Promise<boolean> {
    if (this.dataSource !== "prisma") {
      return false;
    }

    if (this.prismaInvoiceDownPaymentColumnState !== null) {
      return this.prismaInvoiceDownPaymentColumnState;
    }

    if (this.prismaInvoiceDownPaymentColumnInitPromise) {
      return this.prismaInvoiceDownPaymentColumnInitPromise;
    }

    if (typeof this.prisma.$queryRaw !== "function" || typeof this.prisma.$executeRaw !== "function") {
      this.prismaInvoiceDownPaymentColumnState = false;
      return false;
    }

    this.prismaInvoiceDownPaymentColumnInitPromise = (async () => {
      try {
        const existingRows = await this.prisma.$queryRaw<Array<{ exists: number }>>`
          SELECT 1 AS "exists"
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'Invoice'
            AND column_name = 'downPaymentIdr'
          LIMIT 1
        `;

        if (existingRows.length > 0) {
          return true;
        }

        await this.prisma.$executeRaw`
          ALTER TABLE "Invoice"
          ADD COLUMN IF NOT EXISTS "downPaymentIdr" DECIMAL(12,2) NOT NULL DEFAULT 0
        `;

        const verifiedRows = await this.prisma.$queryRaw<Array<{ exists: number }>>`
          SELECT 1 AS "exists"
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'Invoice'
            AND column_name = 'downPaymentIdr'
          LIMIT 1
        `;

        return verifiedRows.length > 0;
      } catch (error: unknown) {
        this.logger.warn(
          {
            action: "invoice.down-payment-column.ensure-failed",
            dataSource: this.dataSource,
            error,
          },
          "Invoice down payment column is not ready yet.",
        );
        return false;
      }
    })();

    try {
      const available = await this.prismaInvoiceDownPaymentColumnInitPromise;
      this.prismaInvoiceDownPaymentColumnState = available;
      return available;
    } finally {
      this.prismaInvoiceDownPaymentColumnInitPromise = null;
    }
  }

  private async ensurePrismaInvoiceRecipientNameColumn(): Promise<boolean> {
    if (this.dataSource !== "prisma") {
      return false;
    }

    if (this.prismaInvoiceRecipientNameColumnState !== null) {
      return this.prismaInvoiceRecipientNameColumnState;
    }

    if (this.prismaInvoiceRecipientNameColumnInitPromise) {
      return this.prismaInvoiceRecipientNameColumnInitPromise;
    }

    if (typeof this.prisma.$queryRaw !== "function" || typeof this.prisma.$executeRaw !== "function") {
      this.prismaInvoiceRecipientNameColumnState = false;
      return false;
    }

    this.prismaInvoiceRecipientNameColumnInitPromise = (async () => {
      try {
        const existingRows = await this.prisma.$queryRaw<Array<{ exists: number }>>`
          SELECT 1 AS "exists"
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'Invoice'
            AND column_name = 'recipientName'
          LIMIT 1
        `;

        if (existingRows.length > 0) {
          return true;
        }

        await this.prisma.$executeRaw`
          ALTER TABLE "Invoice"
          ADD COLUMN IF NOT EXISTS "recipientName" TEXT
        `;

        const verifiedRows = await this.prisma.$queryRaw<Array<{ exists: number }>>`
          SELECT 1 AS "exists"
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'Invoice'
            AND column_name = 'recipientName'
          LIMIT 1
        `;

        return verifiedRows.length > 0;
      } catch (error: unknown) {
        this.logger.warn(
          {
            action: "invoice.recipient-name-column.ensure-failed",
            dataSource: this.dataSource,
            error,
          },
          "Invoice recipient name column is not ready yet.",
        );
        return false;
      }
    })();

    try {
      const available = await this.prismaInvoiceRecipientNameColumnInitPromise;
      this.prismaInvoiceRecipientNameColumnState = available;
      return available;
    } finally {
      this.prismaInvoiceRecipientNameColumnInitPromise = null;
    }
  }

  private resolvePrismaInvoiceInlineDownPayment(
    invoice: PrismaInvoiceSummaryRowWithOptionalDownPayment,
  ): number | undefined {
    if (!Object.prototype.hasOwnProperty.call(invoice, "downPaymentIdr")) {
      return undefined;
    }

    return Math.max(0, Math.round(toNumberAmount(invoice.downPaymentIdr)));
  }

  private async findAllWithPrisma(): Promise<InvoiceListItem[]> {
    const canReadInlineDownPayment = await this.ensurePrismaInvoiceDownPaymentColumn();

    // Lazy sync overdue invoices in the database
    const todayUtc = createUtcDateFromIso(toIsoDateOnly(new Date()));
    await this.prisma.invoice.updateMany({
      where: {
        status: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.PARTIALLY_PAID],
        },
        dueDate: {
          lt: todayUtc,
        },
        OR: [
          { notes: { not: { contains: "[NoDueDate:true]" } } },
          { notes: null },
        ],
      },
      data: {
        status: InvoiceStatus.OVERDUE,
      },
    });

    const invoices = (await this.prisma.invoice.findMany({
      select: canReadInlineDownPayment ? invoiceSummarySelectWithDownPayment : invoiceSummarySelect,
      orderBy: [{ dueDate: "desc" }, { invoiceNumber: "desc" }],
    })) as PrismaInvoiceSummaryRowWithOptionalDownPayment[];

    return invoices.map((invoice) => {
      const downPaymentIdr = this.resolvePrismaInvoiceInlineDownPayment(invoice) ?? 0;

      return this.mapPrismaInvoiceToListItem(invoice, downPaymentIdr);
    });
  }

  private async createWithPrisma(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    const submitTracker = Telemetry.start("invoice_submit_ms");
    validateInvoicePayloadInvariants(payload);

    const queryTracker = Telemetry.start("invoice_db_query_ms");
    const client = await this.resolveClientForCreateWithPrisma(payload);

    const issuedDateIso = normalizeIsoDate(payload.issuedDate, "issuedDate");
    const isNoDueDate = !payload.dueDate || !payload.dueDate.trim();
    const dueDateIso = isNoDueDate
      ? issuedDateIso
      : normalizeIsoDate(payload.dueDate!, "dueDate");
    const invoiceYear = extractYearFromIsoDate(dueDateIso);
    const requestedGroupCode = getTrimmedString(payload.groupCode).toUpperCase();
    let resolvedGroupId: string | null = client.groupId ?? null;
    const normalizedItems = normalizeInvoiceLineItems(payload.items, payload.notes);
    if (requestedGroupCode) {
      const matchedGroup = await this.prisma.group.findUnique({
        where: {
          code: requestedGroupCode,
        },
        select: {
          id: true,
        },
      });

      if (!matchedGroup) {
        Telemetry.end(queryTracker, { action: "create_pre_queries_failed" });
        Telemetry.end(submitTracker, { success: false });
        throw new NotFoundException(`Group '${requestedGroupCode}' not found.`);
      }

      resolvedGroupId = matchedGroup.id;
    }
    Telemetry.end(queryTracker, { action: "create_pre_queries_success" });

    const baseAmount = resolveInvoiceAmountFromItems(payload.amount, normalizedItems);
    const roundedAmount = Math.max(0, Math.round(baseAmount));
    let notes = getTrimmedString(payload.notes);
    if (isNoDueDate && !notes.includes("[NoDueDate:true]")) {
      notes = `${notes}\n[NoDueDate:true]`.trim();
    }
    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? InvoiceStatus.PENDING,
      dueDateIso,
      roundedAmount,
      payload.downPaymentIdr ?? 0,
      notes,
    );
    const normalizedDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr ?? 0,
    );
    const canWriteInlineDownPayment = await this.ensurePrismaInvoiceDownPaymentColumn();

    const txTracker = Telemetry.start("invoice_transaction_ms");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          await this.acquirePrismaTransactionLock(tx, "invoice-number-year", invoiceYear);

          const nextInvoiceNumber = await this.generateNextInvoiceNumberWithPrisma(invoiceYear, tx);
          const createdInvoice = await tx.invoice.create({
            data: {
              invoiceNumber: nextInvoiceNumber,
              clientId: client.id,
              groupId: resolvedGroupId,
              issuedDate: createUtcDateFromIso(issuedDateIso),
              dueDate: createUtcDateFromIso(dueDateIso),
              amount: roundedAmount,
              status: effectiveStatus,
              notes: notes || null,
              recipientName: getTrimmedString(payload.recipientName) || null,
              items: normalizedItems.length > 0 ? (normalizedItems as Prisma.InputJsonValue) : Prisma.JsonNull,
              itemsRel: {
                createMany: {
                  data: normalizedItems.map((item) => ({
                    description: item.description,
                    pax: item.pax,
                    currency: item.currency,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    totalPriceIdr: item.totalPriceIdr,
                  })),
                },
              },
            },
            select: invoiceSummarySelect,
          });

          if (canWriteInlineDownPayment) {
            await this.writePrismaInvoiceDownPaymentWithExecutor(
              tx,
              createdInvoice.id,
              normalizedDownPaymentIdr,
            );
          }

          return createdInvoice;
        });

        Telemetry.end(txTracker, { success: true });
        Telemetry.event("invoice_dual_write_success", { type: "create", id: created.id });

        if (!canWriteInlineDownPayment) {
          await this.writePrismaInvoiceDownPayment(created.id, normalizedDownPaymentIdr);
        }

        const result = this.mapPrismaInvoiceToListItem(created as PrismaInvoiceSummaryRowWithOptionalDownPayment, normalizedDownPaymentIdr);
        Telemetry.end(submitTracker, { success: true, id: created.id });
        return result;
      } catch (error: unknown) {
        Telemetry.event("invoice_dual_write_failed", { type: "create", error: error instanceof Error ? error.message : String(error) });
        if (isRetryablePrismaWriteConflict(error) && attempt < 2) {
          continue;
        }

        Telemetry.end(txTracker, { success: false, error: error instanceof Error ? error.message : String(error) });
        Telemetry.end(submitTracker, { success: false, error: error instanceof Error ? error.message : String(error) });

        if (isRetryablePrismaWriteConflict(error)) {
          throw new ConflictException("Failed to generate a unique invoice number. Please retry.");
        }

        if (hasInvoiceStatusEnumMismatch(error)) {
          throw new BadRequestException(
            "Invoice status CANCELLED belum tersedia di database. Jalankan migrasi terbaru lalu restart backend.",
          );
        }

        throw error;
      }
    }

    Telemetry.end(submitTracker, { success: false, error: "max_attempts_exceeded" });
    throw new ConflictException("Failed to generate invoice number.");
  }

  private async updateWithPrisma(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    const submitTracker = Telemetry.start("invoice_submit_ms");
    validateInvoicePayloadInvariants(payload);
    if (payload.version === undefined) {
      Telemetry.end(submitTracker, { success: false, error: "missing_version" });
      throw new BadRequestException("Concurrency version token is required for invoice updates.");
    }
    const dbQueryTracker = Telemetry.start("invoice_db_query_ms");
    const existingInvoice = await this.prisma.invoice.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        clientId: true,
        groupId: true,
        issuedDate: true,
        dueDate: true,
        amount: true,
        status: true,
        notes: true,
        items: true,
        recipientName: true,
        version: true,
      },
    });

    if (!existingInvoice) {
      Telemetry.end(dbQueryTracker, { action: "update_pre_queries_failed", id });
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }

    const existingDownPaymentIdr = await this.readPrismaInvoiceDownPayment(id);
    Telemetry.end(dbQueryTracker, { action: "update_pre_queries_success", id });

    // Cancelled status business invariant: CANCELLED invoices cannot receive new/increased payments
    if (existingInvoice.status === InvoiceStatus.CANCELLED) {
      if (payload.downPaymentIdr !== undefined && payload.downPaymentIdr > existingDownPaymentIdr) {
        throw new BadRequestException("Invoice yang berstatus CANCELLED tidak boleh menerima pembayaran baru.");
      }
      if (payload.notes !== undefined) {
        const existingPaymentsMatch = existingInvoice.notes?.match(/\[Payments:([^\]]+)\]/);
        const newPaymentsMatch = payload.notes.match(/\[Payments:([^\]]+)\]/);
        const existingPaymentsStr = existingPaymentsMatch ? existingPaymentsMatch[1] : "";
        const newPaymentsStr = newPaymentsMatch ? newPaymentsMatch[1] : "";
        if (newPaymentsStr !== existingPaymentsStr) {
          try {
            const existingPayments: any[] = existingPaymentsStr ? JSON.parse(decodeURIComponent(existingPaymentsStr)) : [];
            const newPayments: any[] = newPaymentsStr ? JSON.parse(decodeURIComponent(newPaymentsStr)) : [];
            const existingTotal = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const newTotal = newPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            if (newTotal > existingTotal || newPayments.length > existingPayments.length) {
              throw new BadRequestException("Invoice yang berstatus CANCELLED tidak boleh menerima pembayaran baru.");
            }
          } catch (e) {
            throw new BadRequestException("Format histori pembayaran tidak valid.");
          }
        }
      }
    }

    const requestedClientId = getTrimmedString(payload.clientId);
    const requestedClientName = getTrimmedString(payload.clientName);
    const hasClientChangeRequest = Boolean(requestedClientId || requestedClientName);
    let resolvedClientId = existingInvoice.clientId;
    let resolvedClientGroupId: string | null = null;
    if (requestedClientId) {
      const matchedClient = await this.prisma.invoiceClient.findUnique({
        where: {
          id: requestedClientId,
        },
        select: {
          id: true,
          groupId: true,
        },
      });

      if (!matchedClient) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }

      resolvedClientId = matchedClient.id;
      resolvedClientGroupId = matchedClient.groupId ?? null;
    } else if (requestedClientName) {
      const existingByName = await this.findPrismaInvoiceClientByName(requestedClientName);

      if (existingByName) {
        resolvedClientId = existingByName.id;
        resolvedClientGroupId = existingByName.groupId ?? null;
      } else {
        const createdClient = await this.createInvoiceClientWithPrisma(requestedClientName);
        resolvedClientId = createdClient.id;
        resolvedClientGroupId = createdClient.groupId ?? null;
      }
    }

    const issuedDateIso = payload.issuedDate
      ? normalizeIsoDate(payload.issuedDate, "issuedDate")
      : toIsoDateOnly(existingInvoice.issuedDate);

    const isNoDueDate = payload.dueDate !== undefined
      ? (!payload.dueDate || !payload.dueDate.trim())
      : (existingInvoice.notes?.includes("[NoDueDate:true]") ?? false);

    const dueDateIso = (payload.dueDate !== undefined && payload.dueDate.trim())
      ? normalizeIsoDate(payload.dueDate!, "dueDate")
      : issuedDateIso;

    const baseAmount =
      payload.amount !== undefined ? payload.amount : toNumberAmount(existingInvoice.amount);
    const resolvedNotesForItems = payload.notes !== undefined ? payload.notes : (existingInvoice.notes ?? "");
    const normalizedItems = payload.items !== undefined ? normalizeInvoiceLineItems(payload.items, resolvedNotesForItems) : [];
    const resolvedAmount =
      payload.items !== undefined ? resolveInvoiceAmountFromItems(baseAmount, normalizedItems) : baseAmount;
    const roundedAmount = Math.max(0, Math.round(resolvedAmount));
    const normalizedDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr !== undefined ? payload.downPaymentIdr : existingDownPaymentIdr,
    );

    let notes = payload.notes !== undefined ? payload.notes.trim() : (existingInvoice.notes ?? "");
    if (isNoDueDate) {
      if (!notes.includes("[NoDueDate:true]")) {
        notes = `${notes}\n[NoDueDate:true]`.trim();
      }
    } else {
      notes = notes.replace(/\[NoDueDate:true\]/g, "").trim();
    }

    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? existingInvoice.status,
      dueDateIso,
      roundedAmount,
      normalizedDownPaymentIdr,
      notes,
    );

    let resolvedGroupId: string | null = existingInvoice.groupId;
    if (payload.groupCode !== undefined) {
      const normalizedGroupCode = payload.groupCode.trim().toUpperCase();
      if (normalizedGroupCode.length === 0) {
        resolvedGroupId = null;
      } else {
        const matchedGroup = await this.prisma.group.findUnique({
          where: {
            code: normalizedGroupCode,
          },
          select: {
            id: true,
          },
        });

        if (!matchedGroup) {
          throw new NotFoundException(`Group '${normalizedGroupCode}' not found.`);
        }

        resolvedGroupId = matchedGroup.id;
      }
    } else if (hasClientChangeRequest && !resolvedGroupId) {
      resolvedGroupId = resolvedClientGroupId;
    }

    const canWriteInlineDownPayment = await this.ensurePrismaInvoiceDownPaymentColumn();

    let updated: PrismaInvoiceSummaryRow;
    const txTracker = Telemetry.start("invoice_transaction_ms");
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        // Build the query clause with version check for optimistic locking
        const whereClause: Prisma.InvoiceWhereInput = {
          id,
          version: payload.version,
        };

        // Perform transactional update using updateMany
        const updateResult = await tx.invoice.updateMany({
          where: whereClause,
          data: {
            clientId: resolvedClientId,
            groupId: resolvedGroupId,
            issuedDate: createUtcDateFromIso(issuedDateIso),
            dueDate: createUtcDateFromIso(dueDateIso),
            amount: roundedAmount,
            status: effectiveStatus,
            notes: notes || null,
            recipientName: payload.recipientName !== undefined ? payload.recipientName.trim() || null : existingInvoice.recipientName,
            version: { increment: 1 },
            ...(payload.items !== undefined
              ? {
                  items:
                    normalizedItems.length > 0
                      ? (normalizedItems as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
                }
              : {}),
          },
        });

        if (updateResult.count === 0) {
          Telemetry.event("invoice_version_conflict", { id, expected: payload.version, actual: existingInvoice.version });
          throw new ConflictException("Invoice telah dimodifikasi oleh transaksi lain. Silakan muat ulang halaman.");
        }

        // Relational items dual-write updates
        if (payload.items !== undefined) {
          await tx.invoiceItem.deleteMany({
            where: { invoiceId: id },
          });

          if (normalizedItems.length > 0) {
            await tx.invoiceItem.createMany({
              data: normalizedItems.map((item) => ({
                invoiceId: id,
                description: item.description,
                pax: item.pax,
                currency: item.currency,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                totalPriceIdr: item.totalPriceIdr,
              })),
            });
          }
        }

        const result = await tx.invoice.findUnique({
          where: { id },
          select: invoiceSummarySelect,
        });

        if (!result) {
          throw new NotFoundException(`Invoice '${id}' not found after update.`);
        }

        if (canWriteInlineDownPayment) {
          await this.writePrismaInvoiceDownPaymentWithExecutor(
            tx,
            result.id,
            normalizedDownPaymentIdr,
          );
        }

        return result;
      });

      Telemetry.end(txTracker, { id, success: true });
      Telemetry.event("invoice_dual_write_success", { type: "update", id });

      if (!canWriteInlineDownPayment) {
        await this.writePrismaInvoiceDownPayment(updated.id, normalizedDownPaymentIdr);
      }
      Telemetry.end(submitTracker, { success: true, id });
    } catch (error: unknown) {
      Telemetry.end(submitTracker, { success: false, error: error instanceof Error ? error.message : String(error) });
      Telemetry.end(txTracker, { id, success: false, error: error instanceof Error ? error.message : String(error) });
      Telemetry.event("invoice_dual_write_failed", { type: "update", id, error: error instanceof Error ? error.message : String(error) });
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Invoice '${id}' not found.`);
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new BadRequestException("Invalid invoice relation payload.");
      }

      if (hasInvoiceStatusEnumMismatch(error)) {
        throw new BadRequestException(
          "Invoice status CANCELLED belum tersedia di database. Jalankan migrasi terbaru lalu restart backend.",
        );
      }

      throw error;
    }

    return this.mapPrismaInvoiceToListItem(updated as PrismaInvoiceSummaryRowWithOptionalDownPayment, normalizedDownPaymentIdr);
  }

  private async writePrismaInvoiceDownPayment(invoiceId: string, downPaymentIdr: number): Promise<void> {
    const canWriteColumn = await this.ensurePrismaInvoiceDownPaymentColumn();
    if (!canWriteColumn || typeof this.prisma.$executeRaw !== "function") {
      return;
    }

    try {
      await this.writePrismaInvoiceDownPaymentWithExecutor(
        this.prisma,
        invoiceId,
        downPaymentIdr,
      );
    } catch (error: unknown) {
      this.logger.warn(
        {
          action: "invoice.down-payment-column.write-failed",
          dataSource: this.dataSource,
          invoiceId,
          error,
        },
        "Invoice down payment value could not be stored.",
      );
    }
  }

  private async readPrismaInvoiceDownPayment(invoiceId: string): Promise<number> {
    const canReadColumn = await this.ensurePrismaInvoiceDownPaymentColumn();
    if (!canReadColumn || typeof this.prisma.$queryRaw !== "function") {
      return 0;
    }

    try {
      const rows = await this.prisma.$queryRaw<PrismaInvoiceDownPaymentRow[]>`
        SELECT "downPaymentIdr"
        FROM "Invoice"
        WHERE "id" = ${invoiceId}
        LIMIT 1
      `;

      return rows.length > 0 ? Math.max(0, Math.round(toNumberAmount(rows[0]?.downPaymentIdr))) : 0;
    } catch (error: unknown) {
      this.logger.warn(
        {
          action: "invoice.down-payment-column.read-single-failed",
          dataSource: this.dataSource,
          invoiceId,
          error,
        },
        "Invoice down payment value could not be read.",
      );
      return 0;
    }
  }

  private mapPrismaInvoiceToListItem(
    invoice: PrismaInvoiceSummaryRowWithOptionalDownPayment,
    downPaymentIdr = 0,
  ): InvoiceListItem {
    const dueDateIso = toIsoDateOnly(invoice.dueDate);
    const issuedDateIso = toIsoDateOnly(invoice.issuedDate);
    
    const legacyItems = parseStoredInvoiceLineItems(invoice.items) ?? [];
    
    // Map itemsRel to InvoiceLineItem[] format
    const relationalItems: InvoiceLineItem[] = (invoice as any).itemsRel?.map((item: any) => ({
      description: item.description,
      pax: item.pax,
      currency: item.currency,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      totalPriceIdr: Number(item.totalPriceIdr),
    })) ?? [];

    // Perform shadow read verification
    const shadowTracker = Telemetry.start("invoice_shadow_compare_ms");
    let shadowMismatch = false;
    if (legacyItems.length !== relationalItems.length) {
      shadowMismatch = true;
    } else {
      for (let i = 0; i < legacyItems.length; i++) {
        const legacy = legacyItems[i];
        const relational = relationalItems[i];
        if (
          legacy.description !== relational.description ||
          legacy.pax !== relational.pax ||
          legacy.currency !== relational.currency ||
          legacy.unitPrice !== relational.unitPrice ||
          legacy.totalPrice !== relational.totalPrice ||
          legacy.totalPriceIdr !== relational.totalPriceIdr
        ) {
          shadowMismatch = true;
          break;
        }
      }
    }
    Telemetry.end(shadowTracker, { id: invoice.id });

    if (shadowMismatch) {
      Telemetry.event("invoice_shadow_mismatch", {
        id: invoice.id,
        legacyCount: legacyItems.length,
        relationalCount: relationalItems.length,
      });
    }

    // Determine return items based on feature flag
    const readFromRelational = process.env.ENABLE_NEW_ITEM_READ === "true";
    const finalItems = readFromRelational ? relationalItems : legacyItems;

    const baseAmount = resolveStoredInvoiceAmount(toNumberAmount(invoice.amount), finalItems);
    const roundedAmount = Math.max(0, Math.round(baseAmount));
    const effectiveStatus = resolveEffectiveStatus(
      invoice.status,
      dueDateIso,
      roundedAmount,
      downPaymentIdr,
      invoice.notes ?? undefined,
    );
    const isNoDueDate = invoice.notes?.includes("[NoDueDate:true]");

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.client.name,
      clientLabel: formatClientLabel(invoice.client.sortOrder, invoice.client.name),
      clientInitials: getInitials(invoice.client.name),
      groupCode: invoice.group?.code,
      groupName: invoice.group?.name,
      issuedDateIso,
      dueDateIso: isNoDueDate ? "" : dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: resolveDisplayedDownPaymentByAmount(roundedAmount, effectiveStatus, downPaymentIdr),
      status: toStatusLabel(effectiveStatus),
      monthKey: resolveMonthKey(dueDateIso),
      recipientName: invoice.recipientName ?? undefined,
      notes: invoice.notes ?? undefined,
      items: finalItems.length ? finalItems : undefined,
      version: invoice.version,
    };
  }

  private resolveNextSerial(existingInvoiceNumbers: string[]): number {
    const maxSerial = existingInvoiceNumbers.reduce((highest, current) => {
      const parsedSerial = extractInvoiceSerial(current);
      if (!parsedSerial) {
        return highest;
      }

      return Math.max(highest, parsedSerial);
    }, 0);

    return maxSerial + 1;
  }

  private async generateNextInvoiceNumberWithPrisma(
    year: string,
    prismaClient: Pick<PrismaService, "invoice"> = this.prisma,
  ): Promise<string> {
    const latest = await prismaClient.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `GTT/INV/${year}/`,
        },
      },
      select: {
        invoiceNumber: true,
      },
      orderBy: {
        invoiceNumber: "desc",
      },
    });

    if (!latest) {
      return buildInvoiceNumber(year, 1);
    }

    const latestSerial = extractInvoiceSerial(latest.invoiceNumber);
    if (latestSerial) {
      return buildInvoiceNumber(year, latestSerial + 1);
    }

    // Fallback for legacy malformed invoice formats that break lexical ordering.
    const records = await prismaClient.invoice.findMany({
      where: {
        invoiceNumber: {
          startsWith: `GTT/INV/${year}/`,
        },
      },
      select: {
        invoiceNumber: true,
      },
    });

    const nextSerial = this.resolveNextSerial(records.map((entry) => entry.invoiceNumber));
    return buildInvoiceNumber(year, nextSerial);
  }

  private async acquirePrismaTransactionLock(
    prismaClient: Pick<PrismaService, "$executeRaw">,
    namespace: string,
    key: string,
  ): Promise<void> {
    // Serialize only the small critical sections that allocate shared identifiers.
    await prismaClient.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${namespace}), hashtext(${key}))
    `;
  }

  private async findPrismaInvoiceClientByName(
    clientName: string,
    prismaClient: Pick<PrismaService, "invoiceClient"> = this.prisma,
  ): Promise<ResolvedPrismaInvoiceClient | null> {
    const normalizedClientName = normalizeInvoiceClientName(clientName);
    const matchedClient = await prismaClient.invoiceClient.findFirst({
      where: {
        name: {
          equals: normalizedClientName,
          mode: "insensitive",
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        groupId: true,
      },
    });

    if (!matchedClient) {
      return null;
    }

    return {
      id: matchedClient.id,
      groupId: matchedClient.groupId ?? null,
    };
  }

  private async writePrismaInvoiceDownPaymentWithExecutor(
    prismaClient: Pick<PrismaService, "$executeRaw">,
    invoiceId: string,
    downPaymentIdr: number,
  ): Promise<void> {
    await prismaClient.$executeRaw`
      UPDATE "Invoice"
      SET "downPaymentIdr" = ${Math.max(0, Math.round(downPaymentIdr))}
      WHERE "id" = ${invoiceId}
    `;
  }

  private logInvoiceMutation(action: string, invoice: InvoiceListItem): void {
    this.logger.info(
      {
        action,
        dataSource: this.dataSource,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        groupCode: invoice.groupCode,
        status: invoice.status,
        amount: invoice.amount,
      },
      "Invoice mutation completed.",
    );
  }

  async backfillLegacyItems(): Promise<{
    processed: number;
    success: number;
    failed: number;
    anomalies: Array<{ id: string; invoiceNumber: string; message: string }>;
  }> {
    if (this.dataSource !== "prisma") {
      return { processed: 0, success: 0, failed: 0, anomalies: [] };
    }

    let processed = 0;
    let success = 0;
    let failed = 0;
    const anomalies: Array<{ id: string; invoiceNumber: string; message: string }> = [];

    let cursor: { id: string } | undefined = undefined;

    while (true) {
      const invoices: Array<{ id: string; invoiceNumber: string; items: any }> = await this.prisma.invoice.findMany({
        take: 200,
        ...(cursor ? { skip: 1, cursor } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          invoiceNumber: true,
          items: true,
        },
      });

      if (invoices.length === 0) {
        break;
      }

      cursor = { id: invoices[invoices.length - 1].id };

      for (const invoice of invoices) {
        processed += 1;
        try {
          // Parse legacy items
          const items = parseStoredInvoiceLineItems(invoice.items) ?? [];

          // Idempotency: clear existing
          await this.prisma.invoiceItem.deleteMany({
            where: { invoiceId: invoice.id },
          });

          if (items.length > 0) {
            // Write to InvoiceItem
            await this.prisma.invoiceItem.createMany({
              data: items.map((item) => ({
                invoiceId: invoice.id,
                description: item.description,
                pax: item.pax,
                currency: item.currency,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                totalPriceIdr: item.totalPriceIdr,
              })),
            });
          }

          // Phase 3D Checksum Verification: read it back and compare
          const writtenItems = await this.prisma.invoiceItem.findMany({
            where: { invoiceId: invoice.id },
            orderBy: { id: 'asc' },
          });

          // Verify length
          if (writtenItems.length !== items.length) {
            const msg = `Count mismatch: legacy=${items.length}, relational=${writtenItems.length}`;
            anomalies.push({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, message: msg });
            console.error(`[TELEMETRY] invoice_backfill_verification_failed, id: ${invoice.id}, error: ${msg}`);
          } else {
            // Verify subtotals
            const legacySubtotal = items.reduce((sum: number, it: InvoiceLineItem) => sum + it.totalPriceIdr, 0);
            const writtenSubtotal = writtenItems.reduce((sum: number, it: any) => sum + Number(it.totalPriceIdr), 0);
            if (Math.abs(legacySubtotal - writtenSubtotal) > 0.01) {
              const msg = `Subtotal mismatch: legacy=${legacySubtotal}, relational=${writtenSubtotal}`;
              anomalies.push({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, message: msg });
              console.error(`[TELEMETRY] invoice_backfill_verification_failed, id: ${invoice.id}, error: ${msg}`);
            } else {
              success += 1;
              console.log(`[TELEMETRY] invoice_backfill_success, id: ${invoice.id}`);
            }
          }
        } catch (error: any) {
          failed += 1;
          const msg = `Exception: ${error.message || String(error)}`;
          anomalies.push({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, message: msg });
          console.error(`[TELEMETRY] invoice_backfill_failed, id: ${invoice.id}, error: ${msg}`);
        }
      }
    }

    return { processed, success, failed, anomalies };
  }
}
