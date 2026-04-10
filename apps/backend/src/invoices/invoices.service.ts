import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";

type InvoiceStatusLabel = "Paid" | "Pending" | "Overdue" | "Cancelled";

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
  status: InvoiceStatusLabel;
  monthKey: string;
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
  status: InvoiceStatus;
  notes?: string;
};

type PrismaInvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: {
    client: true;
    group: {
      select: {
        code: true;
        name: true;
      };
    };
  };
}>;

type ResolvedPrismaInvoiceClient = {
  id: string;
  groupId: string | null;
};

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function createUtcDateFromIso(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

  return "Pending";
}

function resolveMonthKey(isoDate: string): string {
  return isIsoDateOnly(isoDate) ? isoDate.slice(0, 7) : "unknown";
}

function resolveEffectiveStatus(status: InvoiceStatus, dueDateIso: string): InvoiceStatus {
  if (status === InvoiceStatus.CANCELLED) {
    return InvoiceStatus.CANCELLED;
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

  return InvoiceStatus.PENDING;
}

function normalizeAmountByStatus(amount: number, status: InvoiceStatus): number {
  const sanitizedAmount = Math.max(0, Math.round(amount));
  if (status === InvoiceStatus.CANCELLED) {
    return 0;
  }

  return sanitizedAmount;
}

function buildInvoiceNumber(year: string, serial: number): string {
  return `GTT/INV/${year}/${String(serial).padStart(4, "0")}`;
}

function extractYearFromIsoDate(isoDate: string): string {
  return isIsoDateOnly(isoDate) ? isoDate.slice(0, 4) : toIsoDateOnly(new Date()).slice(0, 4);
}

function toNumberAmount(value: Prisma.Decimal | number): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasInvoiceStatusEnumMismatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes('invalid input value for enum "InvoiceStatus"') ||
    message.includes("InvoiceStatus") && message.includes("CANCELLED")
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

@Injectable()
export class InvoicesService {
  private readonly dataSource: "memory" | "prisma";
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

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    const configuredSource = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
    this.dataSource = configuredSource === "prisma" ? "prisma" : "memory";
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
    if (this.dataSource === "prisma") {
      return this.createWithPrisma(payload);
    }

    return this.createInMemory(payload);
  }

  async update(id: string, payload: UpdateInvoiceDto): Promise<InvoiceListItem> {
    if (this.dataSource === "prisma") {
      return this.updateWithPrisma(id, payload);
    }

    return this.updateInMemory(id, payload);
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

    const requestedClientName = getTrimmedString(payload.clientName);
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

    const requestedClientName = getTrimmedString(payload.clientName);
    if (!requestedClientName) {
      throw new BadRequestException("Either clientId or clientName is required.");
    }

    const existingByName = await this.prisma.invoiceClient.findFirst({
      where: {
        name: requestedClientName,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        groupId: true,
      },
    });
    if (existingByName) {
      return {
        id: existingByName.id,
        groupId: existingByName.groupId ?? null,
      };
    }

    return this.createInvoiceClientWithPrisma(requestedClientName);
  }

  private async createInvoiceClientWithPrisma(clientName: string): Promise<ResolvedPrismaInvoiceClient> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const maxSortOrderAggregate = await this.prisma.invoiceClient.aggregate({
        _max: {
          sortOrder: true,
        },
      });
      const nextSortOrder = (maxSortOrderAggregate._max.sortOrder ?? 0) + 1;

      try {
        const createdClient = await this.prisma.invoiceClient.create({
          data: {
            name: clientName,
            sortOrder: nextSortOrder,
          },
          select: {
            id: true,
            groupId: true,
          },
        });

        return {
          id: createdClient.id,
          groupId: createdClient.groupId ?? null,
        };
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < 2
        ) {
          continue;
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
    const effectiveStatus = resolveEffectiveStatus(payload.status ?? InvoiceStatus.PENDING, dueDateIso);
    const normalizedGroupCode = getTrimmedString(payload.groupCode).toUpperCase();

    const createdInvoice: MemoryInvoice = {
      id: randomUUID(),
      invoiceNumber,
      clientId: client.id,
      groupCode: normalizedGroupCode || client.groupCode,
      groupName: normalizedGroupCode ? undefined : client.groupName,
      issuedDateIso,
      dueDateIso,
      amount: normalizeAmountByStatus(payload.amount, effectiveStatus),
      status: effectiveStatus,
      notes: getTrimmedString(payload.notes) || undefined,
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
    const requestedClientName = getTrimmedString(payload.clientName);
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
    const effectiveStatus = resolveEffectiveStatus(payload.status ?? currentInvoice.status, dueDateIso);
    const baseAmount = payload.amount !== undefined ? payload.amount : currentInvoice.amount;
    const roundedAmount = normalizeAmountByStatus(baseAmount, effectiveStatus);

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
      status: effectiveStatus,
      notes: nextNotes,
    };

    this.memoryInvoices[invoiceIndex] = updatedInvoice;
    return this.mapMemoryInvoiceToListItem(updatedInvoice, resolvedClient);
  }

  private mapMemoryInvoiceToListItem(
    invoice: MemoryInvoice,
    client: MemoryInvoiceClient,
  ): InvoiceListItem {
    const effectiveStatus = resolveEffectiveStatus(invoice.status, invoice.dueDateIso);
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
      amount: normalizeAmountByStatus(invoice.amount, effectiveStatus),
      status: toStatusLabel(effectiveStatus),
      monthKey: resolveMonthKey(invoice.dueDateIso),
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

  private async findAllWithPrisma(): Promise<InvoiceListItem[]> {
    const invoices = await this.prisma.invoice.findMany({
      include: {
        client: true,
        group: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: [{ dueDate: "desc" }, { invoiceNumber: "desc" }],
    });

    return invoices.map((invoice) => this.mapPrismaInvoiceToListItem(invoice));
  }

  private async createWithPrisma(payload: CreateInvoiceDto): Promise<InvoiceListItem> {
    const client = await this.resolveClientForCreateWithPrisma(payload);

    const issuedDateIso = normalizeIsoDate(payload.issuedDate, "issuedDate");
    const dueDateIso = normalizeIsoDate(payload.dueDate, "dueDate");
    const invoiceYear = extractYearFromIsoDate(dueDateIso);
    const requestedGroupCode = getTrimmedString(payload.groupCode).toUpperCase();
    let resolvedGroupId: string | null = client.groupId ?? null;
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

    const effectiveStatus = resolveEffectiveStatus(payload.status ?? InvoiceStatus.PENDING, dueDateIso);
    const roundedAmount = normalizeAmountByStatus(payload.amount, effectiveStatus);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const nextInvoiceNumber = await this.generateNextInvoiceNumberWithPrisma(invoiceYear);
      try {
        const created = await this.prisma.invoice.create({
          data: {
            invoiceNumber: nextInvoiceNumber,
            clientId: client.id,
            groupId: resolvedGroupId,
            issuedDate: createUtcDateFromIso(issuedDateIso),
            dueDate: createUtcDateFromIso(dueDateIso),
            amount: roundedAmount,
            status: effectiveStatus,
            notes: getTrimmedString(payload.notes) || null,
          },
          include: {
            client: true,
            group: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        });

        return this.mapPrismaInvoiceToListItem(created);
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt === 0
        ) {
          continue;
        }

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException(`Invoice '${id}' not found.`);
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
      const existingByName = await this.prisma.invoiceClient.findFirst({
        where: {
          name: requestedClientName,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          groupId: true,
        },
      });

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
    const effectiveStatus = resolveEffectiveStatus(payload.status ?? existingInvoice.status, dueDateIso);
    const baseAmount =
      payload.amount !== undefined ? payload.amount : toNumberAmount(existingInvoice.amount);
    const roundedAmount = normalizeAmountByStatus(baseAmount, effectiveStatus);

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

    let updated: PrismaInvoiceWithRelations;
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
        },
        include: {
          client: true,
          group: {
            select: {
              code: true,
              name: true,
            },
          },
        },
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

    return this.mapPrismaInvoiceToListItem(updated);
  }

  private mapPrismaInvoiceToListItem(invoice: PrismaInvoiceWithRelations): InvoiceListItem {
    const dueDateIso = toIsoDateOnly(invoice.dueDate);
    const issuedDateIso = toIsoDateOnly(invoice.issuedDate);
    const effectiveStatus = resolveEffectiveStatus(invoice.status, dueDateIso);

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
      amount: normalizeAmountByStatus(toNumberAmount(invoice.amount), effectiveStatus),
      status: toStatusLabel(effectiveStatus),
      monthKey: resolveMonthKey(dueDateIso),
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

  private async generateNextInvoiceNumberWithPrisma(year: string): Promise<string> {
    const latest = await this.prisma.invoice.findFirst({
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
    const records = await this.prisma.invoice.findMany({
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
}
