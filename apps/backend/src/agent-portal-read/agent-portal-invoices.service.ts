import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type InvoiceStatus } from "@prisma/client";
import { resolveConfiguredDataSource } from "../config/app-config";
import { GroupMemoryStore } from "../infrastructure/repositories/memory/group-memory-store";
import { InvoiceMemoryStore } from "../invoices/application/invoice-memory-store";
import type { MemoryInvoice } from "../invoices/invoices-helpers";
import { PrismaService } from "../prisma/prisma.service";
import type { AgentPortalInvoiceQueryDto } from "./dto/agent-portal-invoice-query.dto";

const missing = (): NotFoundException => new NotFoundException("RESOURCE_NOT_FOUND");
const toIso = (value: Date | string): string => new Date(value).toISOString();

type SafeInvoiceSource = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedDate: Date | string;
  dueDate: Date | string;
  group: { id: string; code: string; name: string } | null;
};

function project(invoice: SafeInvoiceSource) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issuedDate: toIso(invoice.issuedDate),
    dueDate: toIso(invoice.dueDate),
    group: invoice.group,
  };
}

@Injectable()
export class AgentPortalInvoicesService {
  private readonly dataSource: "memory" | "prisma";

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly invoices: InvoiceMemoryStore,
    private readonly groups: GroupMemoryStore,
  ) {
    this.dataSource = resolveConfiguredDataSource(config);
  }

  async list(agentId: string, query: AgentPortalInvoiceQueryDto) {
    return this.dataSource === "prisma" ? this.listPrisma(agentId, query) : this.listMemory(agentId, query);
  }

  async detail(agentId: string, id: string) {
    if (this.dataSource === "memory") {
      const invoice = this.invoices.invoices.find((row) => row.id === id && row.agentId === agentId);
      if (!invoice || !this.memoryOwnershipIsConsistent(invoice, agentId)) throw missing();
      return project(this.memorySource(invoice));
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        agentId,
        OR: [{ groupId: null }, { group: { agentId } }],
      },
      select: {
        id: true, invoiceNumber: true, status: true, issuedDate: true, dueDate: true,
        group: { select: { id: true, code: true, name: true } },
      },
    });
    if (!invoice) throw missing();
    return project(invoice);
  }

  private async listPrisma(agentId: string, query: AgentPortalInvoiceQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      agentId,
      status: query.status,
      dueDate: query.dueFrom || query.dueTo ? {
        gte: query.dueFrom ? new Date(`${query.dueFrom}T00:00:00.000Z`) : undefined,
        lte: query.dueTo ? new Date(`${query.dueTo}T23:59:59.999Z`) : undefined,
      } : undefined,
      OR: [{ groupId: null }, { group: { agentId } }],
    };
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const direction = query.sortDirection ?? "desc";
    const sortBy = query.sortBy ?? "dueDate";
    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [{ [sortBy]: direction }, { id: direction }];
    const [total, rows] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, invoiceNumber: true, status: true, issuedDate: true, dueDate: true,
          group: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);
    return { items: rows.map(project), total, page, pageSize };
  }

  private listMemory(agentId: string, query: AgentPortalInvoiceQueryDto) {
    const from = query.dueFrom ? new Date(`${query.dueFrom}T00:00:00.000Z`) : null;
    const to = query.dueTo ? new Date(`${query.dueTo}T23:59:59.999Z`) : null;
    const sortBy = query.sortBy ?? "dueDate";
    const direction = query.sortDirection === "asc" ? 1 : -1;
    const filtered = this.invoices.invoices
      .filter((invoice) => invoice.agentId === agentId && this.memoryOwnershipIsConsistent(invoice, agentId))
      .filter((invoice) => !query.status || invoice.status === query.status)
      .filter((invoice) => !from || new Date(invoice.dueDateIso) >= from)
      .filter((invoice) => !to || new Date(invoice.dueDateIso) <= to)
      .sort((left, right) => {
        const leftValue = sortBy === "issuedDate" ? left.issuedDateIso : sortBy === "dueDate" ? left.dueDateIso : left.invoiceNumber;
        const rightValue = sortBy === "issuedDate" ? right.issuedDateIso : sortBy === "dueDate" ? right.dueDateIso : right.invoiceNumber;
        return leftValue.localeCompare(rightValue) * direction || left.id.localeCompare(right.id) * direction;
      });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize).map((invoice) => project(this.memorySource(invoice))),
      total: filtered.length, page, pageSize,
    };
  }

  private memoryOwnershipIsConsistent(invoice: MemoryInvoice, agentId: string): boolean {
    if (!invoice.groupId) return true;
    return this.groups.groups.some((group) => group.id === invoice.groupId && group.agentId === agentId);
  }

  private memorySource(invoice: MemoryInvoice): SafeInvoiceSource {
    const linkedGroup = invoice.groupId ? this.groups.groups.find((group) => group.id === invoice.groupId) : null;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      issuedDate: invoice.issuedDateIso,
      dueDate: invoice.dueDateIso,
      group: linkedGroup ? { id: linkedGroup.id, code: linkedGroup.code, name: linkedGroup.name } : null,
    };
  }
}
