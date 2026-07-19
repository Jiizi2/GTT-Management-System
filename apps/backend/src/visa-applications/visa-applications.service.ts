import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  AgentStatus,
  VisaApplicationDocumentStatus,
  VisaApplicationStatus,
  VisaApplicationVisaStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  deriveVisaApplicationStatus,
  hasReachedVisaSubmission,
  type VisaApplicationFacets,
} from "./domain/derive-visa-application-status";
import type {
  ListVisaApplicationsDto,
  UpdateVisaApplicationProgressDto,
  VisaApplicationListView,
} from "./dto/visa-application.dto";

const groupSelect = {
  id: true,
  code: true,
  name: true,
  arrivalDate: true,
  returnDate: true,
  pax: true,
  packageName: true,
  agentId: true,
} as const;

const baseInclude = {
  agent: { select: { id: true, code: true, name: true } },
  group: { select: groupSelect },
  documents: {
    orderBy: { type: "asc" as const },
    select: {
      id: true,
      type: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      reviewNote: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const adminDetailInclude = {
  ...baseInclude,
  progressAuditLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    include: { actorAuthUser: { select: { id: true, name: true, email: true } } },
  },
} as const;

const adminListInclude = {
  ...baseInclude,
  progressAuditLogs: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    include: { actorAuthUser: { select: { id: true, name: true, email: true } } },
  },
} as const;

type AccountActor = { id: string };

function trimNullable(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

function viewWhere(view: VisaApplicationListView): Prisma.VisaApplicationWhereInput {
  if (view === "revision") return { documentStatus: VisaApplicationDocumentStatus.NEED_REVISION };
  if (view === "completed") return { status: VisaApplicationStatus.COMPLETED };
  if (view === "issued") {
    return { visaStatus: { in: [VisaApplicationVisaStatus.ISSUED, VisaApplicationVisaStatus.COMPLETED] } };
  }
  if (view === "in-progress") {
    return {
      status: { not: VisaApplicationStatus.COMPLETED },
      documentStatus: { not: VisaApplicationDocumentStatus.NEED_REVISION },
    };
  }
  if (view === "incomplete") return { status: { not: VisaApplicationStatus.COMPLETED } };
  return {};
}

@Injectable()
export class VisaApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForAgent(agentId: string) {
    const rows = await this.prisma.visaApplication.findMany({
      where: { agentId },
      include: baseInclude,
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => this.toAgentView(row));
  }

  async listForAdmin(query: ListVisaApplicationsDto = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const view = query.view ?? "incomplete";
    const needle = query.q?.trim();
    const commonWhere: Prisma.VisaApplicationWhereInput = {
      ...(query.agentId?.trim() ? { agentId: query.agentId.trim() } : {}),
      ...(query.linked === "true" ? { groupId: { not: null } } : {}),
      ...(query.linked === "false" ? { groupId: null } : {}),
      ...(needle
        ? {
            OR: [
              { applicationNumber: { contains: needle, mode: "insensitive" } },
              { packageName: { contains: needle, mode: "insensitive" } },
              { departureCity: { contains: needle, mode: "insensitive" } },
              { group: { is: { code: { contains: needle, mode: "insensitive" } } } },
              { group: { is: { name: { contains: needle, mode: "insensitive" } } } },
              { agent: { is: { name: { contains: needle, mode: "insensitive" } } } },
            ],
          }
        : {}),
    };
    const where = { AND: [commonWhere, viewWhere(view)] } satisfies Prisma.VisaApplicationWhereInput;
    const [total, priorityTotal, incomplete, revision, inProgress, issued, completed] = await this.prisma.$transaction([
      this.prisma.visaApplication.count({ where }),
      this.prisma.visaApplication.count({
        where: { AND: [where, { documentStatus: VisaApplicationDocumentStatus.NEED_REVISION }] },
      }),
      this.prisma.visaApplication.count({ where: { AND: [commonWhere, viewWhere("incomplete")] } }),
      this.prisma.visaApplication.count({ where: { AND: [commonWhere, viewWhere("revision")] } }),
      this.prisma.visaApplication.count({ where: { AND: [commonWhere, viewWhere("in-progress")] } }),
      this.prisma.visaApplication.count({ where: { AND: [commonWhere, viewWhere("issued")] } }),
      this.prisma.visaApplication.count({ where: { AND: [commonWhere, viewWhere("completed")] } }),
    ]);
    const offset = (page - 1) * pageSize;
    const priorityTake = Math.max(0, Math.min(pageSize, priorityTotal - offset));
    const regularTake = pageSize - priorityTake;
    const [priorityItems, regularItems] = await this.prisma.$transaction([
      this.prisma.visaApplication.findMany({
        where: { AND: [where, { documentStatus: VisaApplicationDocumentStatus.NEED_REVISION }] },
        include: adminListInclude,
        orderBy: { updatedAt: query.view === "completed" ? "desc" : "asc" },
        skip: Math.min(offset, priorityTotal),
        take: priorityTake,
      }),
      this.prisma.visaApplication.findMany({
        where: { AND: [where, { documentStatus: { not: VisaApplicationDocumentStatus.NEED_REVISION } }] },
        include: adminListInclude,
        orderBy: { updatedAt: query.view === "completed" ? "desc" : "asc" },
        skip: Math.max(0, offset - priorityTotal),
        take: regularTake,
      }),
    ]);
    const items = [...priorityItems, ...regularItems];
    return {
      items: items.map((item) => ({ ...item, dataWarnings: this.buildDataWarnings(item) })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
      summary: { incomplete, revision, inProgress, issued, completed },
    };
  }

  async detailForAdmin(id: string) {
    const row = await this.prisma.visaApplication.findUnique({ where: { id }, include: adminDetailInclude });
    if (!row) throw new NotFoundException("VISA_APPLICATION_NOT_FOUND");
    return { ...row, dataWarnings: this.buildDataWarnings(row) };
  }

  async detailForAgent(agentId: string, id: string) {
    const row = await this.prisma.visaApplication.findFirst({ where: { id, agentId }, include: baseInclude });
    if (!row) throw new NotFoundException("VISA_APPLICATION_NOT_FOUND");
    return this.toAgentView(row);
  }

  async updateProgress(id: string, payload: UpdateVisaApplicationProgressDto, actor: AccountActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.visaApplication.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("VISA_APPLICATION_NOT_FOUND");
      const facets: VisaApplicationFacets = {
        documentStatus: payload.documentStatus ?? current.documentStatus,
        agreementStatus: payload.agreementStatus ?? current.agreementStatus,
        nusukStatus: payload.nusukStatus ?? current.nusukStatus,
        paymentStatus: payload.paymentStatus ?? current.paymentStatus,
        visaStatus: payload.visaStatus ?? current.visaStatus,
      };
      const status = deriveVisaApplicationStatus(facets);
      const now = new Date();
      const data: Prisma.VisaApplicationUpdateInput = {
        ...facets,
        status,
        nusukGroupNumber: trimNullable(payload.nusukGroupNumber),
        nusukReferenceNumber: trimNullable(payload.nusukReferenceNumber),
        adminNote: trimNullable(payload.adminNote),
        submittedAt:
          hasReachedVisaSubmission(facets.visaStatus) && !current.submittedAt ? now : undefined,
        completedAt:
          status === VisaApplicationStatus.COMPLETED ? current.completedAt ?? now : null,
      };
      const updated = await tx.visaApplication.update({ where: { id }, data, include: baseInclude });
      const changes = this.buildChanges(current, updated, payload);
      await tx.visaApplicationProgressAuditLog.create({
        data: {
          visaApplicationId: id,
          actorAuthUserId: actor.id,
          action: "PROGRESS_UPDATED",
          changes: changes as Prisma.InputJsonValue,
        },
      });
      return updated;
    });
  }

  async linkGroup(id: string, groupId: string | null, actor: AccountActor) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.visaApplication.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("VISA_APPLICATION_NOT_FOUND");
      if (!groupId) {
        const updated = await tx.visaApplication.update({
          where: { id },
          data: { group: { disconnect: true } },
          include: baseInclude,
        });
        await tx.visaApplicationProgressAuditLog.create({
          data: {
            visaApplicationId: id,
            actorAuthUserId: actor.id,
            action: "GROUP_UNLINKED",
            changes: { groupId: { before: current.groupId, after: null } },
          },
        });
        return updated;
      }
      const group = await tx.group.findUnique({
        where: { id: groupId },
        select: { ...groupSelect, agent: { select: { status: true } } },
      });
      if (!group) throw new NotFoundException("GROUP_NOT_FOUND");
      if (group.agentId !== current.agentId) {
        throw new BadRequestException("Visa application and Group must belong to the same Agent.");
      }
      if (group.agent.status !== AgentStatus.ACTIVE) {
        throw new BadRequestException("GROUP_AGENT_IS_NOT_ACTIVE");
      }
      const occupied = await tx.visaApplication.findFirst({ where: { groupId, id: { not: id } }, select: { id: true } });
      if (occupied) throw new ConflictException("GROUP_ALREADY_LINKED_TO_VISA_APPLICATION");
      const updated = await tx.visaApplication.update({
        where: { id },
        data: { group: { connect: { id: groupId } } },
        include: baseInclude,
      });
      await tx.visaApplicationProgressAuditLog.create({
        data: {
          visaApplicationId: id,
          actorAuthUserId: actor.id,
          action: "GROUP_LINKED",
          changes: { groupId: { before: current.groupId, after: groupId }, groupCode: group.code },
        },
      });
      return updated;
    });
  }

  private toAgentView<
    T extends {
      adminNote?: unknown;
      progressAuditLogs?: unknown;
      createdByPortalUserId?: unknown;
      dataWarnings?: unknown;
      documents?: Array<Record<string, unknown>>;
    },
  >(row: T) {
    const {
      adminNote: _adminNote,
      progressAuditLogs: _audit,
      createdByPortalUserId: _creator,
      dataWarnings: _warnings,
      ...publicView
    } = row;
    const documents = publicView.documents?.map(({ storageKey: _storageKey, ...document }) => document);
    return documents ? { ...publicView, documents } : publicView;
  }

  private buildDataWarnings(row: {
    agentId: string;
    departureDate: Date;
    returnDate: Date;
    packageName: string;
    passengerCount: number;
    group: null | {
      agentId: string;
      arrivalDate: Date;
      returnDate: Date;
      packageName: string;
      pax: number;
    };
  }): string[] {
    if (!row.group) return [];
    const warnings: string[] = [];
    const dateKey = (value: Date) => value.toISOString().slice(0, 10);
    if (row.agentId !== row.group.agentId) warnings.push("Agent aplikasi berbeda dari Agent Group.");
    if (dateKey(row.departureDate) !== dateKey(row.group.arrivalDate)) warnings.push("Tanggal berangkat berbeda dari Group.");
    if (dateKey(row.returnDate) !== dateKey(row.group.returnDate)) warnings.push("Tanggal pulang berbeda dari Group.");
    if (row.passengerCount !== row.group.pax) warnings.push("Jumlah jamaah berbeda dari Group.");
    if (row.packageName.trim() !== row.group.packageName.trim()) warnings.push("Paket berbeda dari Group.");
    return warnings;
  }

  private buildChanges(
    current: Record<string, unknown>,
    updated: Record<string, unknown>,
    payload: UpdateVisaApplicationProgressDto,
  ): Record<string, { before: unknown; after: unknown }> {
    const fields = [
      "documentStatus",
      "agreementStatus",
      "nusukStatus",
      "paymentStatus",
      "visaStatus",
      "nusukGroupNumber",
      "nusukReferenceNumber",
      "adminNote",
    ] as const;
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const field of fields) {
      if (payload[field] !== undefined && current[field] !== updated[field]) {
        changes[field] = { before: current[field] ?? null, after: updated[field] ?? null };
      }
    }
    if (current.status !== updated.status) {
      changes.status = { before: current.status, after: updated.status };
    }
    return changes;
  }
}
