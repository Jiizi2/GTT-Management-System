import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { CreateInvoiceDto } from "../../../invoices/dto/create-invoice.dto";
import { UpdateInvoiceDto } from "../../../invoices/dto/update-invoice.dto";
import { PaginationDto, PaginatedResponseDto } from "../../../invoices/dto/pagination.dto";
import { InvoiceListItem, InvoiceClientListItem, hasInvoiceStatusEnumMismatch } from "../../../invoices/invoices-helpers";
import { Telemetry } from "../../../logging/telemetry";
import { InvoiceValidator } from "../../../invoices/domain/invoice-validator";
import { InvoiceNumberGenerator } from "../../../invoices/domain/invoice-number-generator";
import { toIsoDateOnly, toUtcMidnightDate as createUtcDateFromIso } from "../../../utils/date-helpers";
import {
  formatClientLabel,
  getInitials,
  toStatusLabel,
  resolveMonthKey,
  resolveEffectiveStatus,
  resolveDisplayedDownPaymentByAmount,
  resolveStoredInvoiceAmount,
  parseStoredInvoiceLineItems,
  getTrimmedString,
  normalizeIsoDate,
  normalizeInvoiceLineItems,
  resolveInvoiceAmountFromItems,
  normalizeDownPaymentByAmount,
  normalizeInvoiceClientName,
  resolveNextClientSortOrder,
  PrismaInvoiceSummaryRowWithOptionalDownPayment,
  invoiceSummarySelect,
  invoiceSummarySelectWithDownPayment,
} from "../../../invoices/invoices-helpers";

type ResolvedPrismaInvoiceClient = {
  id: string;
  groupId?: string;
};

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  private readonly validator = new InvoiceValidator();
  private readonly generator = new InvoiceNumberGenerator();
  private isProduction = process.env.NODE_ENV === "production";

  private prismaInvoiceDownPaymentColumnState: boolean | null = null;
  private prismaInvoiceDownPaymentColumnInitPromise: Promise<boolean> | null = null;
  private prismaInvoiceRecipientNameColumnState: boolean | null = null;
  private prismaInvoiceRecipientNameColumnInitPromise: Promise<boolean> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async listClients(): Promise<InvoiceClientListItem[]> {
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

  async findAll(): Promise<InvoiceListItem[]> {
    const canReadInlineDownPayment = await this.ensureInvoiceDownPaymentColumn();

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

  async findAllPaginated(pagination: PaginationDto): Promise<PaginatedResponseDto<InvoiceListItem>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const canReadInlineDownPayment = await this.ensureInvoiceDownPaymentColumn();

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
      skip: (page - 1) * limit,
      take: limit,
    })) as PrismaInvoiceSummaryRowWithOptionalDownPayment[];

    const data = invoices.map((invoice) => {
      const downPaymentIdr = this.resolvePrismaInvoiceInlineDownPayment(invoice) ?? 0;
      return this.mapPrismaInvoiceToListItem(invoice, downPaymentIdr);
    });

    const total = await this.prisma.invoice.count();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    const submitTracker = Telemetry.start("invoice_submit_ms");
    this.validator.validateInvoicePayloadInvariants(payload);

    const queryTracker = Telemetry.start("invoice_db_query_ms");
    const client = await this.resolveClientForCreateWithPrisma(payload);

    const issuedDateIso = normalizeIsoDate(payload.issuedDate, "issuedDate");
    const isNoDueDate = !payload.dueDate || !payload.dueDate.trim();
    const dueDateIso = isNoDueDate
      ? issuedDateIso
      : normalizeIsoDate(payload.dueDate!, "dueDate");
    const invoiceYear = this.generator.extractYearFromIsoDate(dueDateIso);
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
    const canWriteInlineDownPayment = await this.ensureInvoiceDownPaymentColumn();

    const txTracker = Telemetry.start("invoice_transaction_ms");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          await this.acquirePrismaTransactionLock(tx, "invoice-number-year", invoiceYear);

          const nextInvoiceNumber = await this.generator.generateNextInvoiceNumberWithPrisma(invoiceYear, tx);
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
              description: getTrimmedString(payload.description) || null,
              recipientName: getTrimmedString(payload.recipientName) || null,
              items: normalizedItems.length > 0 ? (normalizedItems as Prisma.InputJsonValue) : Prisma.JsonNull,
              itemsRel: {
                createMany: {
                  data: normalizedItems.map((item) => ({
                    description: item.description,
                    pax: item.pax,
                    currency: item.currency,
                    unitPrice: item.unitPrice,
                    totalPrice: item.pax * item.unitPrice,
                    totalPriceIdr: item.totalPriceIdr,
                  })),
                },
              },
              ...(canWriteInlineDownPayment ? { downPaymentIdr: normalizedDownPaymentIdr } : {}),
            },
            select: canWriteInlineDownPayment ? invoiceSummarySelectWithDownPayment : invoiceSummarySelect,
          });

          if (!canWriteInlineDownPayment) {
            await this.writePrismaInvoiceDownPaymentWithExecutor(tx, createdInvoice.id, normalizedDownPaymentIdr);
          }

          return createdInvoice;
        });

        Telemetry.end(txTracker, { attempt: attempt + 1, success: true });
        Telemetry.end(submitTracker, { success: true });
        return this.mapPrismaInvoiceToListItem(created as PrismaInvoiceSummaryRowWithOptionalDownPayment, normalizedDownPaymentIdr);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034")
        ) {
          continue;
        }
        Telemetry.end(txTracker, { attempt: attempt + 1, success: false });
        Telemetry.end(submitTracker, { success: false });
        if (hasInvoiceStatusEnumMismatch(error)) {
          throw new BadRequestException(
            "Invoice status CANCELLED belum tersedia di database. Jalankan migrasi terbaru lalu restart backend.",
          );
        }
        throw error;
      }
    }

    Telemetry.end(txTracker, { success: false, reason: "max_attempts_exhausted" });
    Telemetry.end(submitTracker, { success: false });
    throw new ConflictException("Failed to generate a unique invoice number. Please retry.");
  }

  async update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    const submitTracker = Telemetry.start("invoice_update_ms");
    this.validator.validateInvoicePayloadInvariants(payload);

    const queryTracker = Telemetry.start("invoice_db_query_ms");
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        invoiceNumber: true,
        dueDate: true,
        issuedDate: true,
        amount: true,
        notes: true,
        status: true,
        items: true,
        version: true,
        itemsRel: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existing) {
      Telemetry.end(queryTracker, { action: "update_queries_failed" });
      Telemetry.end(submitTracker, { success: false });
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }

    const client = await this.resolveClientForUpdateWithPrisma(payload, existing.clientId);

    const issuedDateIso = payload.issuedDate
      ? normalizeIsoDate(payload.issuedDate, "issuedDate")
      : toIsoDateOnly(existing.issuedDate);
    const isNoDueDate = payload.dueDate === undefined
      ? existing.notes?.includes("[NoDueDate:true]")
      : (!payload.dueDate || !payload.dueDate.trim());
    const dueDateIso = payload.dueDate === undefined
      ? toIsoDateOnly(existing.dueDate)
      : (isNoDueDate
          ? issuedDateIso
          : normalizeIsoDate(payload.dueDate!, "dueDate"));
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
        Telemetry.end(queryTracker, { action: "update_queries_failed" });
        Telemetry.end(submitTracker, { success: false });
        throw new NotFoundException(`Group '${requestedGroupCode}' not found.`);
      }

      resolvedGroupId = matchedGroup.id;
    }
    Telemetry.end(queryTracker, { action: "update_queries_success" });

    const baseAmount = resolveInvoiceAmountFromItems(payload.amount ?? Number(existing.amount), normalizedItems);
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
    const nextDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr ?? 0,
    );
    const canWriteInlineDownPayment = await this.ensureInvoiceDownPaymentColumn();

    const txTracker = Telemetry.start("invoice_transaction_ms");
    let updated: unknown = null;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const scalarDataClause: Prisma.InvoiceUncheckedUpdateManyInput = {
          clientId: client.id,
          groupId: resolvedGroupId,
          issuedDate: createUtcDateFromIso(issuedDateIso),
          dueDate: createUtcDateFromIso(dueDateIso),
          amount: roundedAmount,
          status: effectiveStatus,
          notes: notes || null,
          description: getTrimmedString(payload.description) || null,
          recipientName: getTrimmedString(payload.recipientName) || null,
          version: { increment: 1 },
          ...(canWriteInlineDownPayment ? { downPaymentIdr: nextDownPaymentIdr } : {}),
        };

        if (payload.items !== undefined) {
          scalarDataClause.items = normalizedItems.length > 0 ? (normalizedItems as Prisma.InputJsonValue) : Prisma.JsonNull;
        }

        const updateResult = await tx.invoice.updateMany({
          where: {
            id: existing.id,
            version: payload.version,
          },
          data: scalarDataClause,
        });

        if (updateResult.count === 0) {
          throw new Prisma.PrismaClientKnownRequestError(
            "An operation failed because it depends on one or more records that were required but not found.",
            {
              code: "P2025",
              clientVersion: "unit-test",
            },
          );
        }

        if (payload.items !== undefined) {
          await tx.invoiceItem.deleteMany({
            where: {
              invoiceId: existing.id,
            },
          });

          await tx.invoice.update({
            where: {
              id: existing.id,
            },
            data: {
              itemsRel: {
                createMany: {
                  data: normalizedItems.map((item) => ({
                    description: item.description,
                    pax: item.pax,
                    currency: item.currency,
                    unitPrice: item.unitPrice,
                    totalPrice: item.pax * item.unitPrice,
                    totalPriceIdr: item.totalPriceIdr,
                  })),
                },
              },
            },
          });
        }

        const nextInvoice = await tx.invoice.findUnique({
          where: {
            id: existing.id,
          },
          select: canWriteInlineDownPayment ? invoiceSummarySelectWithDownPayment : invoiceSummarySelect,
        });

        if (!canWriteInlineDownPayment) {
          await this.writePrismaInvoiceDownPaymentWithExecutor(tx, existing.id, nextDownPaymentIdr);
        }

        return nextInvoice;
      });

      Telemetry.end(txTracker, { success: true });
      Telemetry.end(submitTracker, { success: true });
    } catch (error: any) {
      Telemetry.end(txTracker, { success: false });
      Telemetry.end(submitTracker, { success: false });

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        throw new BadRequestException("Invalid invoice relation payload. Please check client or group reference.");
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        throw new ConflictException(
          "Invoice telah dimodifikasi oleh transaksi lain. Silakan muat ulang halaman dan coba lagi.",
        );
      }

      if (hasInvoiceStatusEnumMismatch(error)) {
        throw new BadRequestException(
          "Invoice status CANCELLED belum tersedia di database. Jalankan migrasi terbaru lalu restart backend.",
        );
      }

      throw error;
    }

    return this.mapPrismaInvoiceToListItem(updated as PrismaInvoiceSummaryRowWithOptionalDownPayment, nextDownPaymentIdr);
  }

  async backfillLegacyItems(): Promise<{ count: number }> {
    const listTracker = Telemetry.start("invoice_backfill_list_ms");
    const targetInvoices = await this.prisma.invoice.findMany({
      where: {
        items: {
          not: Prisma.JsonNull,
        },
      },
      select: {
        id: true,
        items: true,
        itemsRel: {
          select: {
            id: true,
          },
        },
      },
    });
    Telemetry.end(listTracker, { count: targetInvoices.length });

    const eligibleInvoices = targetInvoices.filter((inv) => inv.itemsRel.length === 0);
    const executeTracker = Telemetry.start("invoice_backfill_execute_ms");
    let count = 0;
    
    await this.prisma.$transaction(async (tx) => {
      for (const inv of eligibleInvoices) {
        const legacyItems = parseStoredInvoiceLineItems(inv.items) ?? [];
        if (legacyItems.length > 0) {
          await tx.invoiceItem.createMany({
            data: legacyItems.map((item) => ({
              invoiceId: inv.id,
              description: item.description,
              pax: item.pax,
              currency: item.currency,
              unitPrice: item.unitPrice,
              totalPrice: item.pax * item.unitPrice,
              totalPriceIdr: item.pax * item.unitPrice,
            })),
          });
          count += 1;
        }
      }
    });

    Telemetry.end(executeTracker, { success: true, count });
    return { count };
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }

    await this.prisma.invoice.delete({
      where: { id },
    });
  }

  async ensureInvoiceDownPaymentColumn(): Promise<boolean> {
    if (this.prismaInvoiceDownPaymentColumnState !== null) {
      return this.prismaInvoiceDownPaymentColumnState;
    }

    if (this.prismaInvoiceDownPaymentColumnInitPromise) {
      return this.prismaInvoiceDownPaymentColumnInitPromise;
    }

    this.prismaInvoiceDownPaymentColumnInitPromise = (async () => {
      try {
        await this.prisma.$queryRawUnsafe(`SELECT "downPaymentIdr" FROM "Invoice" LIMIT 1`);
        this.prismaInvoiceDownPaymentColumnState = true;
        return true;
      } catch {
        this.prismaInvoiceDownPaymentColumnState = false;
        return false;
      } finally {
        this.prismaInvoiceDownPaymentColumnInitPromise = null;
      }
    })();

    return this.prismaInvoiceDownPaymentColumnInitPromise;
  }

  async ensureInvoiceRecipientNameColumn(): Promise<boolean> {
    if (this.prismaInvoiceRecipientNameColumnState !== null) {
      return this.prismaInvoiceRecipientNameColumnState;
    }

    if (this.prismaInvoiceRecipientNameColumnInitPromise) {
      return this.prismaInvoiceRecipientNameColumnInitPromise;
    }

    this.prismaInvoiceRecipientNameColumnInitPromise = (async () => {
      try {
        await this.prisma.$queryRawUnsafe(`SELECT "recipientName" FROM "Invoice" LIMIT 1`);
        this.prismaInvoiceRecipientNameColumnState = true;
        return true;
      } catch {
        this.prismaInvoiceRecipientNameColumnState = false;
        return false;
      } finally {
        this.prismaInvoiceRecipientNameColumnInitPromise = null;
      }
    })();

    return this.prismaInvoiceRecipientNameColumnInitPromise;
  }

  private resolvePrismaInvoiceInlineDownPayment(invoice: PrismaInvoiceSummaryRowWithOptionalDownPayment): number | null {
    if ("downPaymentIdr" in invoice && invoice.downPaymentIdr !== null && invoice.downPaymentIdr !== undefined) {
      return Number(invoice.downPaymentIdr);
    }
    return null;
  }

  private mapPrismaInvoiceToListItem(
    invoice: PrismaInvoiceSummaryRowWithOptionalDownPayment,
    downPaymentIdr = 0,
  ): InvoiceListItem {
    const dueDateIso = toIsoDateOnly(invoice.dueDate);
    const issuedDateIso = toIsoDateOnly(invoice.issuedDate);
    
    const legacyItems = parseStoredInvoiceLineItems(invoice.items) ?? [];
    const relationalItems = (invoice as any).itemsRel?.map((item: any) => ({
      description: item.description,
      pax: item.pax,
      currency: item.currency,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      totalPriceIdr: Number(item.totalPriceIdr),
    })) ?? [];

    if (!this.isProduction) {
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
            legacy.unitPrice !== relational.unitPrice
          ) {
            shadowMismatch = true;
            break;
          }
        }
      }

      if (shadowMismatch) {
        // Log shadow mismatch but do not disrupt runtime
      }
    }

    const resolvedItems = relationalItems.length > 0 ? relationalItems : legacyItems;
    const baseAmount = resolveStoredInvoiceAmount(Number(invoice.amount), resolvedItems);
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
      recipientName: (invoice as any).recipientName ?? undefined,
      notes: invoice.notes ?? undefined,
      description: (invoice as any).description ?? undefined,
      items: resolvedItems.length > 0 ? resolvedItems : undefined,
      version: invoice.version,
    };
  }

  private async resolveClientForCreateWithPrisma(
    payload: CreateInvoiceDto,
  ): Promise<ResolvedPrismaInvoiceClient> {
    const requestedClientId = getTrimmedString(payload.clientId);
    if (requestedClientId) {
      const client = await this.prisma.invoiceClient.findUnique({
        where: { id: requestedClientId },
        select: {
          id: true,
          groupId: true,
        },
      });

      if (!client) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }

      return {
        id: client.id,
        groupId: client.groupId ?? undefined,
      };
    }

    const requestedClientName = getTrimmedString(payload.clientName);
    const normalizedName = normalizeInvoiceClientName(requestedClientName);
    if (!normalizedName) {
      throw new BadRequestException("Either clientId or clientName is required.");
    }

    const existingClient = await this.findPrismaInvoiceClientByName(normalizedName);
    if (existingClient) {
      return existingClient;
    }

    return this.createInvoiceClientWithPrisma(normalizedName);
  }

  private async resolveClientForUpdateWithPrisma(
    payload: UpdateInvoiceDto,
    currentClientId: string,
  ): Promise<ResolvedPrismaInvoiceClient> {
    const requestedClientId = getTrimmedString(payload.clientId);
    const requestedClientName = getTrimmedString(payload.clientName);

    if (requestedClientId) {
      const client = await this.prisma.invoiceClient.findUnique({
        where: { id: requestedClientId },
        select: {
          id: true,
          groupId: true,
        },
      });

      if (!client) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }

      return {
        id: client.id,
        groupId: client.groupId ?? undefined,
      };
    }

    if (requestedClientName) {
      const normalizedName = normalizeInvoiceClientName(requestedClientName);
      const existingClient = await this.findPrismaInvoiceClientByName(normalizedName);
      if (existingClient) {
        return existingClient;
      }

      return this.createInvoiceClientWithPrisma(normalizedName);
    }

    const currentClient = await this.prisma.invoiceClient.findUnique({
      where: { id: currentClientId },
      select: {
        id: true,
        groupId: true,
      },
    });

    if (!currentClient) {
      throw new NotFoundException(`Invoice client '${currentClientId}' not found.`);
    }

    return {
      id: currentClient.id,
      groupId: currentClient.groupId ?? undefined,
    };
  }

  private async createInvoiceClientWithPrisma(clientName: string): Promise<ResolvedPrismaInvoiceClient> {
    const createTracker = Telemetry.start("invoice_client_create_ms");
    const lockTracker = Telemetry.start("invoice_lock_ms");
    await this.acquirePrismaTransactionLock(this.prisma, "invoice_client_write", clientName);
    Telemetry.end(lockTracker, { name: clientName });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const existing = await this.findPrismaInvoiceClientByName(clientName, tx);
          if (existing) {
            return existing;
          }

          const summary = await tx.invoiceClient.aggregate({
            _max: {
              sortOrder: true,
            },
          });
          const maxSortOrder = summary._max.sortOrder;
          const nextSortOrder = maxSortOrder !== null && maxSortOrder !== undefined ? maxSortOrder + 1 : 1;
          return await tx.invoiceClient.create({
            data: {
              name: clientName,
              sortOrder: nextSortOrder,
            },
            select: {
              id: true,
              groupId: true,
            },
          });
        });

        Telemetry.end(createTracker, { attempt: attempt + 1, success: true });
        return {
          id: created.id,
          groupId: created.groupId ?? undefined,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === "P2002" || error.code === "P2034")
        ) {
          continue;
        }
        Telemetry.end(createTracker, { attempt: attempt + 1, success: false });
        throw error;
      }
    }

    Telemetry.end(createTracker, { success: false, reason: "max_attempts_exhausted" });
    throw new BadRequestException("Transaction conflict resolving invoice client. Please try again.");
  }

  private async findPrismaInvoiceClientByName(
    normalizedName: string,
    prismaClient: Pick<PrismaService, "invoiceClient"> = this.prisma,
  ): Promise<ResolvedPrismaInvoiceClient | null> {
    const client = await prismaClient.invoiceClient.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        groupId: true,
      },
    });

    if (!client) {
      return null;
    }

    return {
      id: client.id,
      groupId: client.groupId ?? undefined,
    };
  }

  private async writePrismaInvoiceDownPaymentWithExecutor(
    executor: Prisma.TransactionClient,
    invoiceId: string,
    downPaymentIdr: number,
  ): Promise<void> {
    try {
      await executor.$executeRawUnsafe(
        `UPDATE "Invoice" SET "downPaymentIdr" = $1 WHERE "id" = $2`,
        downPaymentIdr,
        invoiceId,
      );
    } catch {
      // Ignored for databases with missing downPaymentIdr column
    }
  }

  private async acquirePrismaTransactionLock(
    tx: Prisma.TransactionClient,
    lockKey: string,
    lockValue: string,
  ): Promise<void> {
    try {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}), hashtext(${lockValue}))
      `;
    } catch {
      // No-op for DBs that do not support pg_advisory_xact_lock
    }
  }
}
