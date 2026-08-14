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
import { clampMoney, roundMoney } from "../../../utils/money";
import {
  formatClientLabel,
  getInitials,
  toStatusLabel,
  resolveMonthKey,
  resolveEffectiveStatus,
  resolveDisplayedDownPaymentByAmount,
  resolveStoredInvoiceAmount,
  getTrimmedString,
  normalizeIsoDate,
  normalizeInvoiceLineItems,
  resolveInvoiceAmountFromItems,
  extractInvoiceBrandFromNotes,
  resolveInvoiceNumberPrefix,
  normalizeDownPaymentByAmount,
  normalizeDiscountByGrossAmount,
  resolveNetInvoiceAmount,
  toNumberDiscount,
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

  public prismaInvoiceDownPaymentColumnState: boolean | null = null;
  private prismaInvoiceDownPaymentColumnInitPromise: Promise<boolean> | null = null;
  public prismaInvoiceRecipientNameColumnState: boolean | null = null;
  private prismaInvoiceRecipientNameColumnInitPromise: Promise<boolean> | null = null;
  public prismaInvoiceDiscountColumnState: boolean | null = null;
  private prismaInvoiceDiscountColumnInitPromise: Promise<boolean> | null = null;

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

  async findAll(agentId?: string): Promise<InvoiceListItem[]> {
    const readSelect = await this.buildInvoiceReadSelect();

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
      where: agentId ? { agentId } : undefined,
      select: readSelect,
      orderBy: [{ dueDate: "desc" }, { invoiceNumber: "desc" }],
    })) as PrismaInvoiceSummaryRowWithOptionalDownPayment[];

    return invoices.map((invoice) => {
      const downPaymentIdr = this.resolvePrismaInvoiceInlineDownPayment(invoice) ?? 0;
      return this.mapPrismaInvoiceToListItem(invoice, downPaymentIdr);
    });
  }

  async findAllPaginated(pagination: PaginationDto, agentId?: string): Promise<PaginatedResponseDto<InvoiceListItem>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const readSelect = await this.buildInvoiceReadSelect();

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
      where: agentId ? { agentId } : undefined,
      select: readSelect,
      orderBy: [{ dueDate: "desc" }, { invoiceNumber: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    })) as PrismaInvoiceSummaryRowWithOptionalDownPayment[];

    const data = invoices.map((invoice) => {
      const downPaymentIdr = this.resolvePrismaInvoiceInlineDownPayment(invoice) ?? 0;
      return this.mapPrismaInvoiceToListItem(invoice, downPaymentIdr);
    });

    const total = await this.prisma.invoice.count({ where: agentId ? { agentId } : undefined });

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
    let resolvedAgentId = getTrimmedString(payload.agentId) || "agent_gtt_direct";
    let resolvedGroupId: string | null = client.groupId ?? null;
    const normalizedItems = normalizeInvoiceLineItems(payload.items, payload.notes);

    if (requestedGroupCode) {
      const matchedGroup = await this.prisma.group.findUnique({
        where: {
          code: requestedGroupCode,
        },
        select: {
          id: true,
          agentId: true,
        },
      });

      if (!matchedGroup) {
        Telemetry.end(queryTracker, { action: "create_pre_queries_failed" });
        Telemetry.end(submitTracker, { success: false });
        throw new NotFoundException(`Group '${requestedGroupCode}' not found.`);
      }

      if (payload.agentId && resolvedAgentId !== matchedGroup.agentId) {
        throw new BadRequestException("Invoice dan Group harus berasal dari Agent yang sama.");
      }
      resolvedGroupId = matchedGroup.id;
      resolvedAgentId = matchedGroup.agentId;
    }
    if (resolvedGroupId && !requestedGroupCode) {
      const linkedGroup = await this.prisma.group.findUnique({
        where: { id: resolvedGroupId },
        select: { agentId: true },
      });
      if (linkedGroup) {
        if (payload.agentId && resolvedAgentId !== linkedGroup.agentId) {
          throw new BadRequestException("Invoice dan Group harus berasal dari Agent yang sama.");
        }
        resolvedAgentId = linkedGroup.agentId;
      }
    }
    const agentDelegate = this.prisma.agent;
    if (agentDelegate?.findFirst) {
      const activeAgent = await agentDelegate.findFirst({ where: { id: resolvedAgentId, status: "ACTIVE" }, select: { id: true } });
      if (!activeAgent) throw new BadRequestException("Agent invoice tidak ditemukan atau tidak aktif.");
    }
    Telemetry.end(queryTracker, { action: "create_pre_queries_success" });

    const grossAmount = resolveInvoiceAmountFromItems(payload.amount, normalizedItems);
    const discountIdr = normalizeDiscountByGrossAmount(grossAmount, payload.discountIdr ?? 0);
    const roundedAmount = resolveNetInvoiceAmount(grossAmount, discountIdr);
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
    const canWriteInlineDiscount = await this.ensureInvoiceDiscountColumn();
    const readSelect = await this.buildInvoiceReadSelect();
    // Each brand owns an independent per-year serial; the lock is scoped to the
    // brand prefix so two brands can mint numbers in parallel without collision.
    const invoicePrefix = resolveInvoiceNumberPrefix(extractInvoiceBrandFromNotes(notes));

    const txTracker = Telemetry.start("invoice_transaction_ms");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          await this.acquirePrismaTransactionLock(tx, "invoice-number-year", `${invoicePrefix}-${invoiceYear}`);

          const nextInvoiceNumber = await this.generator.generateNextInvoiceNumberWithPrisma(invoiceYear, tx, invoicePrefix);
          const createdInvoice = await tx.invoice.create({
            data: {
              invoiceNumber: nextInvoiceNumber,
              clientId: client.id,
              agentId: resolvedAgentId,
              groupId: resolvedGroupId,
              issuedDate: createUtcDateFromIso(issuedDateIso),
              dueDate: createUtcDateFromIso(dueDateIso),
              amount: roundedAmount,
              status: effectiveStatus,
              notes: notes || null,
              description: getTrimmedString(payload.description) || null,
              recipientName: getTrimmedString(payload.recipientName) || null,
              itemsRel: {
                createMany: {
                  data: normalizedItems.map((item) => ({
                    description: item.description,
                    pax: item.pax,
                    currency: item.currency,
                    unitPrice: item.unitPrice,
                    totalPrice: roundMoney(item.pax * item.unitPrice),
                    totalPriceIdr: item.totalPriceIdr,
                  })),
                },
              },
              ...(canWriteInlineDownPayment ? { downPaymentIdr: normalizedDownPaymentIdr } : {}),
              ...(canWriteInlineDiscount ? { discountIdr } : {}),
            },
            select: readSelect,
          });

          if (!canWriteInlineDownPayment) {
            await this.writePrismaInvoiceDownPaymentWithExecutor(tx, createdInvoice.id, normalizedDownPaymentIdr);
          }
          if (!canWriteInlineDiscount) {
            await this.writePrismaInvoiceDiscountWithExecutor(tx, createdInvoice.id, discountIdr);
          }

          return createdInvoice;
        });

        Telemetry.end(txTracker, { attempt: attempt + 1, success: true });
        Telemetry.end(submitTracker, { success: true });
        return this.mapPrismaInvoiceToListItem(created as PrismaInvoiceSummaryRowWithOptionalDownPayment, normalizedDownPaymentIdr, discountIdr);
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
    const canWriteInlineDiscount = await this.ensureInvoiceDiscountColumn();
    const existing = (await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        agentId: true,
        groupId: true,
        invoiceNumber: true,
        dueDate: true,
        issuedDate: true,
        amount: true,
        downPaymentIdr: true,
        notes: true,
        description: true,
        recipientName: true,
        status: true,
        version: true,
        ...(canWriteInlineDiscount ? { discountIdr: true } : {}),
        itemsRel: {
          select: {
            id: true,
          },
        },
      },
    })) as
      | (Prisma.InvoiceGetPayload<{
          select: {
            id: true;
            clientId: true;
            agentId: true;
            groupId: true;
            invoiceNumber: true;
            dueDate: true;
            issuedDate: true;
            amount: true;
            downPaymentIdr: true;
            notes: true;
            description: true;
            recipientName: true;
            status: true;
            version: true;
            itemsRel: { select: { id: true } };
          };
        }> & { discountIdr?: Prisma.Decimal | number | null })
      | null;

    if (!existing) {
      Telemetry.end(queryTracker, { action: "update_queries_failed" });
      Telemetry.end(submitTracker, { success: false });
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }

    if (existing.version !== undefined && existing.version !== payload.version) {
      Telemetry.end(queryTracker, { action: "update_version_conflict" });
      Telemetry.end(submitTracker, { success: false });
      throw new ConflictException(
        "Invoice telah dimodifikasi oleh transaksi lain. Silakan muat ulang halaman dan coba lagi.",
      );
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
    let resolvedAgentId = getTrimmedString(payload.agentId) || existing.agentId;
    let resolvedGroupId: string | null = existing.groupId;
    const normalizedItems = payload.items === undefined
      ? undefined
      : normalizeInvoiceLineItems(payload.items, payload.notes ?? existing.notes ?? undefined);

    if (payload.groupCode !== undefined && requestedGroupCode) {
      const matchedGroup = await this.prisma.group.findUnique({
        where: {
          code: requestedGroupCode,
        },
        select: {
          id: true,
          agentId: true,
        },
      });

      if (!matchedGroup) {
        Telemetry.end(queryTracker, { action: "update_queries_failed" });
        Telemetry.end(submitTracker, { success: false });
        throw new NotFoundException(`Group '${requestedGroupCode}' not found.`);
      }

      if (payload.agentId && resolvedAgentId !== matchedGroup.agentId) {
        throw new BadRequestException("Invoice dan Group harus berasal dari Agent yang sama.");
      }
      resolvedGroupId = matchedGroup.id;
      resolvedAgentId = matchedGroup.agentId;
    } else if (payload.groupCode !== undefined) {
      resolvedGroupId = null;
    } else if ((payload.clientId !== undefined || payload.clientName !== undefined) && client.groupId) {
      resolvedGroupId = client.groupId;
    }
    if (resolvedGroupId) {
      const linkedGroup = await this.prisma.group.findUnique({
        where: { id: resolvedGroupId },
        select: { agentId: true },
      });
      if (linkedGroup) {
        if (payload.agentId && resolvedAgentId !== linkedGroup.agentId) {
          throw new BadRequestException("Invoice dan Group harus berasal dari Agent yang sama.");
        }
        resolvedAgentId = linkedGroup.agentId;
      }
    }
    const agentDelegate = this.prisma.agent;
    if (agentDelegate?.findFirst) {
      const activeAgent = await agentDelegate.findFirst({
        where: { id: resolvedAgentId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!activeAgent) throw new BadRequestException("Agent invoice tidak ditemukan atau tidak aktif.");
    }
    Telemetry.end(queryTracker, { action: "update_queries_success" });

    // `existing.amount` is the stored NET total; reconstruct the gross subtotal so
    // a discount change (or an unchanged discount alongside an item change) is
    // applied exactly once. When the form submits items, gross comes from them and
    // any `payload.amount` is ignored — matching create().
    const existingDiscount = toNumberDiscount(existing.discountIdr);
    const existingGross = clampMoney(Number(existing.amount) + existingDiscount);
    const grossAmount = normalizedItems === undefined
      ? clampMoney(payload.amount ?? existingGross)
      : resolveInvoiceAmountFromItems(payload.amount ?? existingGross, normalizedItems);
    const nextDiscountIdr = normalizeDiscountByGrossAmount(
      grossAmount,
      payload.discountIdr ?? existingDiscount,
    );
    const roundedAmount = resolveNetInvoiceAmount(grossAmount, nextDiscountIdr);
    let notes = payload.notes === undefined ? (existing.notes ?? "") : getTrimmedString(payload.notes);
    if (isNoDueDate && !notes.includes("[NoDueDate:true]")) {
      notes = `${notes}\n[NoDueDate:true]`.trim();
    } else if (payload.dueDate !== undefined && !isNoDueDate) {
      notes = notes.replace("[NoDueDate:true]", "").trim();
    }
    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? existing.status,
      dueDateIso,
      roundedAmount,
      payload.downPaymentIdr ?? Number(existing.downPaymentIdr),
      notes,
    );
    const nextDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr ?? Number(existing.downPaymentIdr),
    );
    const canWriteInlineDownPayment = await this.ensureInvoiceDownPaymentColumn();
    const readSelect = await this.buildInvoiceReadSelect();

    const txTracker = Telemetry.start("invoice_transaction_ms");
    let updated: unknown = null;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        const scalarDataClause: Prisma.InvoiceUncheckedUpdateManyInput = {
          clientId: client.id,
          agentId: resolvedAgentId,
          groupId: resolvedGroupId,
          issuedDate: createUtcDateFromIso(issuedDateIso),
          dueDate: createUtcDateFromIso(dueDateIso),
          amount: roundedAmount,
          status: effectiveStatus,
          notes: notes || null,
          description: payload.description === undefined
            ? existing.description
            : (getTrimmedString(payload.description) || null),
          recipientName: payload.recipientName === undefined
            ? existing.recipientName
            : (getTrimmedString(payload.recipientName) || null),
          version: { increment: 1 },
          ...(canWriteInlineDownPayment ? { downPaymentIdr: nextDownPaymentIdr } : {}),
          ...(canWriteInlineDiscount ? { discountIdr: nextDiscountIdr } : {}),
        };


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
                    data: normalizedItems!.map((item) => ({
                    description: item.description,
                    pax: item.pax,
                    currency: item.currency,
                    unitPrice: item.unitPrice,
                    totalPrice: roundMoney(item.pax * item.unitPrice),
                    totalPriceIdr: item.totalPriceIdr,
                  })),
                },
              },
            },
          });
        }

        if (!canWriteInlineDiscount) {
          await this.writePrismaInvoiceDiscountWithExecutor(tx, existing.id, nextDiscountIdr);
        }

        const nextInvoice = await tx.invoice.findUnique({
          where: {
            id: existing.id,
          },
          select: readSelect,
        });

        if (!canWriteInlineDownPayment) {
          await this.writePrismaInvoiceDownPaymentWithExecutor(tx, existing.id, nextDownPaymentIdr);
        }

        return nextInvoice;
      });

      Telemetry.end(txTracker, { success: true });
      Telemetry.end(submitTracker, { success: true });
    } catch (error) {
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

    return this.mapPrismaInvoiceToListItem(updated as PrismaInvoiceSummaryRowWithOptionalDownPayment, nextDownPaymentIdr, nextDiscountIdr);
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

  async ensureInvoiceDiscountColumn(): Promise<boolean> {
    if (this.prismaInvoiceDiscountColumnState !== null) {
      return this.prismaInvoiceDiscountColumnState;
    }

    if (this.prismaInvoiceDiscountColumnInitPromise) {
      return this.prismaInvoiceDiscountColumnInitPromise;
    }

    this.prismaInvoiceDiscountColumnInitPromise = (async () => {
      try {
        await this.prisma.$queryRawUnsafe(`SELECT "discountIdr" FROM "Invoice" LIMIT 1`);
        this.prismaInvoiceDiscountColumnState = true;
        return true;
      } catch {
        this.prismaInvoiceDiscountColumnState = false;
        return false;
      } finally {
        this.prismaInvoiceDiscountColumnInitPromise = null;
      }
    })();

    return this.prismaInvoiceDiscountColumnInitPromise;
  }

  /**
   * The read select is assembled at runtime because `downPaymentIdr` and
   * `discountIdr` are each probed lazily: an environment that has not run the
   * matching migration must still read the rest of the invoice. A missing column
   * simply means that field is absent from the row (and treated as 0).
   */
  private async buildInvoiceReadSelect(): Promise<Prisma.InvoiceSelect> {
    const canReadDownPayment = await this.ensureInvoiceDownPaymentColumn();
    const canReadDiscount = await this.ensureInvoiceDiscountColumn();
    const base = canReadDownPayment ? invoiceSummarySelectWithDownPayment : invoiceSummarySelect;
    return canReadDiscount ? { ...base, discountIdr: true } : { ...base };
  }

  private resolvePrismaInvoiceInlineDownPayment(invoice: PrismaInvoiceSummaryRowWithOptionalDownPayment): number | null {
    if ("downPaymentIdr" in invoice && invoice.downPaymentIdr !== null && invoice.downPaymentIdr !== undefined) {
      return Number(invoice.downPaymentIdr);
    }
    return null;
  }

  private resolvePrismaInvoiceInlineDiscount(invoice: PrismaInvoiceSummaryRowWithOptionalDownPayment): number {
    if ("discountIdr" in invoice && invoice.discountIdr !== null && invoice.discountIdr !== undefined) {
      return toNumberDiscount(invoice.discountIdr);
    }
    return 0;
  }

  private mapPrismaInvoiceToListItem(
    invoice: PrismaInvoiceSummaryRowWithOptionalDownPayment,
    downPaymentIdr = 0,
    discountOverride?: number,
  ): InvoiceListItem {
    const dueDateIso = toIsoDateOnly(invoice.dueDate);
    const issuedDateIso = toIsoDateOnly(invoice.issuedDate);

    const discountIdr = discountOverride ?? this.resolvePrismaInvoiceInlineDiscount(invoice);

    const relationalItems = invoice.itemsRel?.map((item) => ({
      description: item.description,
      pax: item.pax,
      currency: item.currency,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
      totalPriceIdr: Number(item.totalPriceIdr),
    })) ?? [];

    const resolvedItems = relationalItems;
    const baseAmount = resolveStoredInvoiceAmount(Number(invoice.amount), resolvedItems, discountIdr);
    const roundedAmount = clampMoney(baseAmount);
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
      agentId: invoice.agentId || "agent_gtt_direct",
      agentName: invoice.agent?.name ?? "GTT Direct",
      clientName: invoice.client.name,
      clientLabel: formatClientLabel(invoice.client.sortOrder, invoice.client.name),
      clientInitials: getInitials(invoice.client.name),
      groupCode: invoice.group?.code,
      groupName: invoice.group?.name,
      issuedDateIso,
      dueDateIso: isNoDueDate ? "" : dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: resolveDisplayedDownPaymentByAmount(roundedAmount, effectiveStatus, downPaymentIdr),
      discountIdr: clampMoney(discountIdr),
      status: toStatusLabel(effectiveStatus),
      monthKey: resolveMonthKey(dueDateIso),
      recipientName: invoice.recipientName ?? undefined,
      notes: invoice.notes ?? undefined,
      description: invoice.description ?? undefined,
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

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const lockTracker = Telemetry.start("invoice_lock_ms");
          await this.acquirePrismaTransactionLock(tx, "invoice_client_write", "global");
          Telemetry.end(lockTracker, { name: clientName });

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

  private async writePrismaInvoiceDiscountWithExecutor(
    executor: Prisma.TransactionClient,
    invoiceId: string,
    discountIdr: number,
  ): Promise<void> {
    try {
      await executor.$executeRawUnsafe(
        `UPDATE "Invoice" SET "discountIdr" = $1 WHERE "id" = $2`,
        discountIdr,
        invoiceId,
      );
    } catch {
      // Ignored for databases with missing discountIdr column
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
