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
  items?: InvoiceLineItem[];
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

  const todayIso = toIsoDateOnly(new Date());
  if (dueDateIso < todayIso) {
    return InvoiceStatus.OVERDUE;
  }

  if (status === InvoiceStatus.OVERDUE) {
    return InvoiceStatus.OVERDUE;
  }

  if (sanitizedDownPayment > 0 && sanitizedDownPayment < sanitizedAmount) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  if (status === InvoiceStatus.PARTIALLY_PAID) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  return InvoiceStatus.PENDING;
}

function normalizeAmountByStatus(amount: number, status: InvoiceStatus): number {
  const sanitizedAmount = Math.max(0, Math.round(amount));
  return sanitizedAmount;
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

function normalizeInvoiceLineItem(value: unknown): InvoiceLineItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const description = getTrimmedString(item.description);
  const currency = getTrimmedString(item.currency).toUpperCase();
  const pax = Math.max(0, Math.round(coerceNumber(item.pax, 0)));
  const unitPrice = Math.max(0, Math.round(coerceNumber(item.unitPrice, 0)));
  const totalPrice = Math.max(0, Math.round(coerceNumber(item.totalPrice, pax * unitPrice)));
  const totalPriceIdr = Math.max(0, Math.round(coerceNumber(item.totalPriceIdr, totalPrice)));

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

function normalizeInvoiceLineItems(items: unknown): InvoiceLineItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeInvoiceLineItem).filter((item): item is InvoiceLineItem => item !== null);
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
      if (
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
    const dueDateIso = normalizeIsoDate(payload.dueDate, "dueDate");
    const invoiceYear = extractYearFromIsoDate(dueDateIso);
    const existingInvoiceNumbers = this.memoryInvoices.map((entry) => entry.invoiceNumber);
    const invoiceNumber = buildInvoiceNumber(invoiceYear, this.resolveNextSerial(existingInvoiceNumbers));
    const normalizedItems = payload.items !== undefined ? normalizeInvoiceLineItems(payload.items) : [];
    const baseAmount = resolveInvoiceAmountFromItems(payload.amount, normalizedItems);
    const roundedAmount = Math.max(0, Math.round(baseAmount));
    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? InvoiceStatus.PENDING,
      dueDateIso,
      roundedAmount,
      payload.downPaymentIdr ?? 0,
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
      notes: getTrimmedString(payload.notes) || undefined,
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
    const dueDateIso = payload.dueDate
      ? normalizeIsoDate(payload.dueDate, "dueDate")
      : currentInvoice.dueDateIso;
    const baseAmount = payload.amount !== undefined ? payload.amount : currentInvoice.amount;
    const normalizedItems = payload.items !== undefined ? normalizeInvoiceLineItems(payload.items) : undefined;
    const resolvedAmount =
      payload.items !== undefined ? resolveInvoiceAmountFromItems(baseAmount, normalizedItems) : baseAmount;
    const roundedAmount = Math.max(0, Math.round(resolvedAmount));
    const nextDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr !== undefined ? payload.downPaymentIdr : currentInvoice.downPaymentIdr,
    );
    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? currentInvoice.status,
      dueDateIso,
      roundedAmount,
      nextDownPaymentIdr,
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

    const nextNotes =
      payload.notes !== undefined ? payload.notes.trim() || undefined : currentInvoice.notes;

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
      notes: nextNotes,
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
    );
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
      dueDateIso: invoice.dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: resolveDisplayedDownPaymentByAmount(roundedAmount, effectiveStatus, invoice.downPaymentIdr),
      status: toStatusLabel(effectiveStatus),
      monthKey: resolveMonthKey(invoice.dueDateIso),
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
    const client = await this.resolveClientForCreateWithPrisma(payload);

    const issuedDateIso = normalizeIsoDate(payload.issuedDate, "issuedDate");
    const dueDateIso = normalizeIsoDate(payload.dueDate, "dueDate");
    const invoiceYear = extractYearFromIsoDate(dueDateIso);
    const requestedGroupCode = getTrimmedString(payload.groupCode).toUpperCase();
    let resolvedGroupId: string | null = client.groupId ?? null;
    const normalizedItems = normalizeInvoiceLineItems(payload.items);
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
        throw new NotFoundException(`Group '${requestedGroupCode}' not found.`);
      }

      resolvedGroupId = matchedGroup.id;
    }

    const baseAmount = resolveInvoiceAmountFromItems(payload.amount, normalizedItems);
    const roundedAmount = Math.max(0, Math.round(baseAmount));
    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? InvoiceStatus.PENDING,
      dueDateIso,
      roundedAmount,
      payload.downPaymentIdr ?? 0,
    );
    const normalizedDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr ?? 0,
    );
    const canWriteInlineDownPayment = await this.ensurePrismaInvoiceDownPaymentColumn();

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
              notes: getTrimmedString(payload.notes) || null,
              items: normalizedItems.length > 0 ? (normalizedItems as Prisma.InputJsonValue) : Prisma.JsonNull,
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

        if (!canWriteInlineDownPayment) {
          await this.writePrismaInvoiceDownPayment(created.id, normalizedDownPaymentIdr);
        }

        return this.mapPrismaInvoiceToListItem(created as PrismaInvoiceSummaryRowWithOptionalDownPayment, normalizedDownPaymentIdr);
      } catch (error: unknown) {
        if (isRetryablePrismaWriteConflict(error) && attempt < 2) {
          continue;
        }

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

    throw new ConflictException("Failed to generate invoice number.");
  }

  private async updateWithPrisma(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
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
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }

    const existingDownPaymentIdr = await this.readPrismaInvoiceDownPayment(id);
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
    const dueDateIso = payload.dueDate
      ? normalizeIsoDate(payload.dueDate, "dueDate")
      : toIsoDateOnly(existingInvoice.dueDate);
    const baseAmount =
      payload.amount !== undefined ? payload.amount : toNumberAmount(existingInvoice.amount);
    const normalizedItems = payload.items !== undefined ? normalizeInvoiceLineItems(payload.items) : [];
    const resolvedAmount =
      payload.items !== undefined ? resolveInvoiceAmountFromItems(baseAmount, normalizedItems) : baseAmount;
    const roundedAmount = Math.max(0, Math.round(resolvedAmount));
    const normalizedDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr !== undefined ? payload.downPaymentIdr : existingDownPaymentIdr,
    );
    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? existingInvoice.status,
      dueDateIso,
      roundedAmount,
      normalizedDownPaymentIdr,
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

    let updated: PrismaInvoiceSummaryRow;
    try {
      updated = await this.prisma.invoice.update({
        where: {
          id,
        },
        data: {
          clientId: resolvedClientId,
          groupId: resolvedGroupId,
          issuedDate: createUtcDateFromIso(issuedDateIso),
          dueDate: createUtcDateFromIso(dueDateIso),
          amount: roundedAmount,
          status: effectiveStatus,
          notes: payload.notes !== undefined ? payload.notes.trim() || null : existingInvoice.notes,
          ...(payload.items !== undefined
            ? {
                items:
                  normalizedItems.length > 0
                    ? (normalizedItems as Prisma.InputJsonValue)
                    : Prisma.JsonNull,
              }
            : {}),
        },
        select: invoiceSummarySelect,
      });
    } catch (error: unknown) {
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

    await this.writePrismaInvoiceDownPayment(updated.id, normalizedDownPaymentIdr);
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
    const items = parseStoredInvoiceLineItems(invoice.items);
    const baseAmount = resolveStoredInvoiceAmount(toNumberAmount(invoice.amount), items);
    const roundedAmount = Math.max(0, Math.round(baseAmount));
    const effectiveStatus = resolveEffectiveStatus(
      invoice.status,
      dueDateIso,
      roundedAmount,
      downPaymentIdr,
    );

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
      dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: resolveDisplayedDownPaymentByAmount(roundedAmount, effectiveStatus, downPaymentIdr),
      status: toStatusLabel(effectiveStatus),
      monthKey: resolveMonthKey(dueDateIso),
      items,
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
}
