import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { InvoiceStatus } from "@prisma/client";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { InvoiceMemoryStore } from "../../../invoices/application/invoice-memory-store";
import { CreateInvoiceDto } from "../../../invoices/dto/create-invoice.dto";
import { UpdateInvoiceDto } from "../../../invoices/dto/update-invoice.dto";
import { PaginationDto, PaginatedResponseDto } from "../../../invoices/dto/pagination.dto";
import { InvoiceListItem, InvoiceClientListItem } from "../../../invoices/invoices-helpers";
import {
  formatClientLabel,
  getInitials,
  toStatusLabel,
  resolveMonthKey,
  resolveEffectiveStatus,
  resolveDisplayedDownPaymentByAmount,
  resolveStoredInvoiceAmount,
  MemoryInvoice,
  MemoryInvoiceClient,
  MemoryInvoiceItem,
  normalizeIsoDate,
  normalizeInvoiceLineItems,
  resolveInvoiceAmountFromItems,
  getTrimmedString,
  normalizeDownPaymentByAmount,
  normalizeInvoiceClientName,
  resolveNextClientSortOrder,
} from "../../../invoices/invoices-helpers";
import { toIsoDateOnly } from "../../../utils/date-helpers";
import { InvoiceNumberGenerator } from "../../../invoices/domain/invoice-number-generator";

@Injectable()
export class MemoryInvoiceRepository implements InvoiceRepository {
  private readonly generator = new InvoiceNumberGenerator();

  constructor(public readonly memoryStore: InvoiceMemoryStore) {}

  async listClients(): Promise<InvoiceClientListItem[]> {
    return [...this.memoryStore.clients]
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

  async findAll(agentId?: string): Promise<InvoiceListItem[]> {
    const todayIso = toIsoDateOnly(new Date());
    this.memoryStore.invoices.forEach((inv) => {
      const isNoDueDate = inv.notes?.includes("[NoDueDate:true]");
      if (
        !isNoDueDate &&
        (inv.status === InvoiceStatus.PENDING || inv.status === InvoiceStatus.PARTIALLY_PAID) &&
        inv.dueDateIso < todayIso
      ) {
        inv.status = InvoiceStatus.OVERDUE;
      }
    });

    return [...this.memoryStore.invoices].filter((invoice) => !agentId || invoice.agentId === agentId)
      .sort((left, right) => {
        const dueDateDiff = right.dueDateIso.localeCompare(left.dueDateIso);
        if (dueDateDiff !== 0) {
          return dueDateDiff;
        }
        return right.invoiceNumber.localeCompare(left.invoiceNumber);
      })
      .map((invoice) => {
        const client = this.memoryStore.clients.find((entry) => entry.id === invoice.clientId);
        if (!client) {
          throw new NotFoundException(`Invoice client '${invoice.clientId}' not found.`);
        }
        return this.mapMemoryInvoiceToListItem(invoice, client);
      });
  }

  async findAllPaginated(pagination: PaginationDto, agentId?: string): Promise<PaginatedResponseDto<InvoiceListItem>> {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const allMapped = await this.findAll(agentId);
    const sliced = allMapped.slice((page - 1) * limit, page * limit);
    return {
      data: sliced,
      total: allMapped.length,
      page,
      limit,
      totalPages: Math.ceil(allMapped.length / limit),
    };
  }

  async create(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    const client = this.resolveClientForCreateInMemory(payload);

    const issuedDateIso = normalizeIsoDate(payload.issuedDate, "issuedDate");
    const isNoDueDate = !payload.dueDate || !payload.dueDate.trim();
    const dueDateIso = isNoDueDate
      ? issuedDateIso
      : normalizeIsoDate(payload.dueDate!, "dueDate");
    const invoiceYear = this.generator.extractYearFromIsoDate(dueDateIso);

    const existingInvoiceNumbers = this.memoryStore.invoices.map((inv) => inv.invoiceNumber);

    const invoiceNumber = this.generator.buildInvoiceNumber(
      invoiceYear,
      this.generator.resolveNextSerial(existingInvoiceNumbers),
    );
    const normalizedItems = normalizeInvoiceLineItems(payload.items, payload.notes) as MemoryInvoiceItem[];
    const baseAmount = resolveInvoiceAmountFromItems(payload.amount, normalizedItems);
    const roundedAmount = Math.max(0, Math.round(baseAmount));

    let notes = getTrimmedString(payload.notes);
    if (isNoDueDate) {
      if (!notes.includes("[NoDueDate:true]")) {
        notes = `${notes}\n[NoDueDate:true]`.trim();
      }
    } else if (payload.dueDate !== undefined) {
      notes = notes.replace("[NoDueDate:true]", "").trim();
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

    let groupCode = client.groupCode;
    let groupName = client.groupName;
    const requestedGroupCode = getTrimmedString(payload.groupCode).toUpperCase();
    if (requestedGroupCode) {
      groupCode = requestedGroupCode;
      groupName = undefined;
    }

    const createdInvoice: MemoryInvoice = {
      id: randomUUID(),
      invoiceNumber,
      clientId: client.id,
      agentId: payload.agentId?.trim() || "agent_gtt_direct",
      groupId: undefined,
      issuedDateIso,
      dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: normalizedDownPaymentIdr,
      status: effectiveStatus,
      notes: notes || undefined,
      description: getTrimmedString(payload.description) || undefined,
      recipientName: getTrimmedString(payload.recipientName) || undefined,
      items: normalizedItems,
      version: 0,
    };

    (createdInvoice as any).groupCode = groupCode;
    (createdInvoice as any).groupName = groupName;

    this.memoryStore.invoices.push(createdInvoice);
    return this.mapMemoryInvoiceToListItem(createdInvoice, client);
  }

  async update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    const invoiceIndex = this.memoryStore.invoices.findIndex((entry) => entry.id === id);
    if (invoiceIndex === -1) {
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }

    const currentInvoice = this.memoryStore.invoices[invoiceIndex];
    const client = this.resolveClientForUpdateInMemory(payload, currentInvoice.clientId);

    const issuedDateIso = payload.issuedDate
      ? normalizeIsoDate(payload.issuedDate, "issuedDate")
      : currentInvoice.issuedDateIso;
    const isNoDueDate = payload.dueDate === undefined
      ? currentInvoice.notes?.includes("[NoDueDate:true]")
      : (!payload.dueDate || !payload.dueDate.trim());
    const dueDateIso = payload.dueDate === undefined
      ? currentInvoice.dueDateIso
      : (isNoDueDate
          ? issuedDateIso
          : normalizeIsoDate(payload.dueDate!, "dueDate"));

    const baseAmount = payload.amount !== undefined ? payload.amount : currentInvoice.amount;
    const resolvedNotesForItems = payload.notes !== undefined ? payload.notes : (currentInvoice.notes ?? "");
    const normalizedItems = payload.items !== undefined
      ? (normalizeInvoiceLineItems(payload.items, resolvedNotesForItems) as MemoryInvoiceItem[])
      : (currentInvoice.items ?? []);
    const resolvedAmount = payload.items !== undefined
      ? resolveInvoiceAmountFromItems(baseAmount, normalizedItems)
      : baseAmount;
    const roundedAmount = Math.max(0, Math.round(resolvedAmount));

    let notes = payload.notes === undefined ? (currentInvoice.notes ?? "") : getTrimmedString(payload.notes);
    if (isNoDueDate) {
      if (!notes.includes("[NoDueDate:true]")) {
        notes = `${notes}\n[NoDueDate:true]`.trim();
      }
    } else if (payload.dueDate !== undefined) {
      notes = notes.replace("[NoDueDate:true]", "").trim();
    }

    const effectiveStatus = resolveEffectiveStatus(
      payload.status ?? currentInvoice.status,
      dueDateIso,
      roundedAmount,
      payload.downPaymentIdr !== undefined ? payload.downPaymentIdr : currentInvoice.downPaymentIdr,
      notes,
    );

    const normalizedDownPaymentIdr = normalizeDownPaymentByAmount(
      roundedAmount,
      payload.downPaymentIdr !== undefined ? payload.downPaymentIdr : currentInvoice.downPaymentIdr,
    );

    let groupCode = (currentInvoice as any).groupCode;
    let groupName = (currentInvoice as any).groupName;
    if (payload.groupCode !== undefined) {
      const requestedGroupCode = getTrimmedString(payload.groupCode).toUpperCase();
      if (requestedGroupCode) {
        groupCode = requestedGroupCode;
        groupName = undefined;
      } else {
        groupCode = undefined;
        groupName = undefined;
      }
    }

    const updatedInvoice: MemoryInvoice = {
      ...currentInvoice,
      clientId: client.id,
      agentId: payload.agentId?.trim() || currentInvoice.agentId || "agent_gtt_direct",
      issuedDateIso,
      dueDateIso,
      amount: roundedAmount,
      downPaymentIdr: normalizedDownPaymentIdr,
      status: effectiveStatus,
      notes: notes || undefined,
      description: payload.description === undefined
        ? currentInvoice.description
        : (getTrimmedString(payload.description) || undefined),
      recipientName: payload.recipientName === undefined
        ? currentInvoice.recipientName
        : (getTrimmedString(payload.recipientName) || undefined),
      items: normalizedItems,
      version: currentInvoice.version + 1,
    };

    (updatedInvoice as any).groupCode = groupCode;
    (updatedInvoice as any).groupName = groupName;

    this.memoryStore.invoices[invoiceIndex] = updatedInvoice;
    return this.mapMemoryInvoiceToListItem(updatedInvoice, client);
  }

  async delete(id: string): Promise<void> {
    const index = this.memoryStore.invoices.findIndex((inv) => inv.id === id);
    if (index === -1) {
      throw new NotFoundException(`Invoice '${id}' not found.`);
    }
    this.memoryStore.invoices.splice(index, 1);
  }

  async ensureInvoiceDownPaymentColumn(): Promise<boolean> {
    return true;
  }

  async ensureInvoiceRecipientNameColumn(): Promise<boolean> {
    return true;
  }

  private resolveClientForCreateInMemory(payload: CreateInvoiceDto): MemoryInvoiceClient {
    const requestedClientId = getTrimmedString(payload.clientId);
    if (requestedClientId) {
      const matchedClient = this.memoryStore.clients.find((entry) => entry.id === requestedClientId);
      if (!matchedClient) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }
      return matchedClient;
    }

    const requestedClientName = normalizeInvoiceClientName(getTrimmedString(payload.clientName));
    if (!requestedClientName) {
      throw new BadRequestException("Either clientId or clientName is required.");
    }

    const existingByName = this.memoryStore.clients.find(
      (entry) => entry.name.trim().toLowerCase() === requestedClientName.toLowerCase(),
    );
    if (existingByName) {
      return existingByName;
    }

    const nextSortOrder = resolveNextClientSortOrder(this.memoryStore.clients);
    const createdClient: MemoryInvoiceClient = {
      id: randomUUID(),
      name: requestedClientName,
      sortOrder: nextSortOrder,
    };
    this.memoryStore.clients.push(createdClient);
    return createdClient;
  }

  private resolveClientForUpdateInMemory(payload: UpdateInvoiceDto, currentClientId: string): MemoryInvoiceClient {
    const requestedClientId = getTrimmedString(payload.clientId);
    const requestedClientName = getTrimmedString(payload.clientName);

    if (requestedClientId) {
      const matchedClient = this.memoryStore.clients.find((entry) => entry.id === requestedClientId);
      if (!matchedClient) {
        throw new NotFoundException(`Invoice client '${requestedClientId}' not found.`);
      }
      return matchedClient;
    }

    if (requestedClientName) {
      const normalizedName = normalizeInvoiceClientName(requestedClientName);
      const existingByName = this.memoryStore.clients.find(
        (entry) => entry.name.trim().toLowerCase() === normalizedName.toLowerCase(),
      );
      if (existingByName) {
        return existingByName;
      }

      const nextSortOrder = resolveNextClientSortOrder(this.memoryStore.clients);
      const createdClient: MemoryInvoiceClient = {
        id: randomUUID(),
        name: normalizedName,
        sortOrder: nextSortOrder,
      };
      this.memoryStore.clients.push(createdClient);
      return createdClient;
    }

    const currentClient = this.memoryStore.clients.find((entry) => entry.id === currentClientId);
    if (!currentClient) {
      throw new NotFoundException(`Invoice client '${currentClientId}' not found.`);
    }
    return currentClient;
  }

  private mapMemoryInvoiceToListItem(invoice: any, client: any): InvoiceListItem {
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
      agentId: invoice.agentId || "agent_gtt_direct",
      agentName: "GTT Direct",
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
      description: invoice.description,
      items: invoice.items?.length ? invoice.items : undefined,
      version: invoice.version,
    };
  }
}
