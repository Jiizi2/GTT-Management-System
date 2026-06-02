import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AgreementApprovalStatus, Prisma } from "@prisma/client";
import { resolveConfiguredDataSource } from "../../config/app-config";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  AssignHotelAgreementDraftDto,
  UpsertHotelAgreementDraftDto,
} from "../dto/hotel-agreement-draft.dto";
import type { UpsertGroupVisaHotelDto } from "../dto/group-operations.dto";
import { GroupsService } from "./groups.service";

type DraftStatusFilter = "assigned" | "unassigned";

type MemoryHotelAgreementDraft = {
  id: string;
  city: UpsertHotelAgreementDraftDto["city"];
  agentName?: string;
  hotelName: string;
  agreementNumber: string;
  pax: number;
  status: AgreementApprovalStatus;
  stayStart: string;
  stayEnd: string;
  notes?: string;
  groupCode?: string;
  assignedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type NormalizedHotelAgreementDraftPayload = {
  city: UpsertHotelAgreementDraftDto["city"];
  agentName?: string;
  hotelName: string;
  agreementNumber: string;
  pax: number;
  status: AgreementApprovalStatus;
  stayStart: string;
  stayEnd: string;
  notes?: string;
};

type PrismaHotelAgreementDraftRecord = {
  id: string;
  city: UpsertHotelAgreementDraftDto["city"];
  agentName: string | null;
  hotelName: string;
  agreementNumber: string;
  pax: number;
  status: AgreementApprovalStatus;
  stayStart: Date;
  stayEnd: Date;
  notes: string | null;
  group?: { code: string } | null;
  assignedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toIsoDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.trim().slice(0, 10);
}

function toIsoDateTime(
  value: Date | string | null | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value.trim() || undefined;
}

function normalizeStatusFilter(
  rawStatus?: string,
): DraftStatusFilter | undefined {
  const normalizedStatus = rawStatus?.trim().toLowerCase();
  return normalizedStatus === "assigned" || normalizedStatus === "unassigned"
    ? normalizedStatus
    : undefined;
}

function toUtcMidnightDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

@Injectable()
export class HotelAgreementDraftsService {
  private readonly dataSource: "memory" | "prisma";
  private readonly memoryDrafts: MemoryHotelAgreementDraft[] = [];

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GroupsService) private readonly groupsService: GroupsService,
    private readonly configService?: ConfigService,
  ) {
    this.dataSource = resolveConfiguredDataSource(this.configService);
  }

  async findAll(query?: string, rawStatus?: string): Promise<unknown[]> {
    const status = normalizeStatusFilter(rawStatus);
    if (this.dataSource === "prisma") {
      return this.findAllWithPrisma(query, status);
    }

    return this.findAllFromMemory(query, status);
  }

  async create(payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    const normalizedPayload = this.normalizePayload(payload);
    if (this.dataSource === "prisma") {
      const created = await this.prisma.hotelAgreementDraft.create({
        data: {
          city: normalizedPayload.city,
          agentName: normalizedPayload.agentName ?? null,
          hotelName: normalizedPayload.hotelName,
          agreementNumber: normalizedPayload.agreementNumber,
          pax: normalizedPayload.pax,
          status: normalizedPayload.status,
          stayStart: toUtcMidnightDate(normalizedPayload.stayStart),
          stayEnd: toUtcMidnightDate(normalizedPayload.stayEnd),
          notes: normalizedPayload.notes ?? null,
        },
        include: {
          group: {
            select: {
              code: true,
            },
          },
        },
      });

      return this.mapPrismaDraft(created);
    }

    const now = new Date().toISOString();
    const draft: MemoryHotelAgreementDraft = {
      id: randomUUID(),
      ...normalizedPayload,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryDrafts.unshift(draft);
    return this.mapMemoryDraft(draft);
  }

  async update(
    draftId: string,
    payload: UpsertHotelAgreementDraftDto,
  ): Promise<unknown> {
    const normalizedPayload = this.normalizePayload(payload);
    if (this.dataSource === "prisma") {
      const existing = await this.prisma.hotelAgreementDraft.findUnique({
        where: { id: draftId },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException(
          `Hotel agreement draft '${draftId}' not found.`,
        );
      }

      const updated = await this.prisma.hotelAgreementDraft.update({
        where: { id: draftId },
        data: {
          city: normalizedPayload.city,
          agentName: normalizedPayload.agentName ?? null,
          hotelName: normalizedPayload.hotelName,
          agreementNumber: normalizedPayload.agreementNumber,
          pax: normalizedPayload.pax,
          status: normalizedPayload.status,
          stayStart: toUtcMidnightDate(normalizedPayload.stayStart),
          stayEnd: toUtcMidnightDate(normalizedPayload.stayEnd),
          notes: normalizedPayload.notes ?? null,
        },
        include: {
          group: {
            select: {
              code: true,
            },
          },
        },
      });

      return this.mapPrismaDraft(updated);
    }

    const draft = this.resolveMemoryDraft(draftId);
    Object.assign(draft, normalizedPayload, {
      updatedAt: new Date().toISOString(),
    });
    return this.mapMemoryDraft(draft);
  }

  async remove(draftId: string): Promise<void> {
    if (this.dataSource === "prisma") {
      const removed = await this.prisma.hotelAgreementDraft.deleteMany({
        where: { id: draftId },
      });
      if (removed.count === 0) {
        throw new NotFoundException(
          `Hotel agreement draft '${draftId}' not found.`,
        );
      }
      return;
    }

    const draftIndex = this.memoryDrafts.findIndex(
      (draft) => draft.id === draftId,
    );
    if (draftIndex === -1) {
      throw new NotFoundException(
        `Hotel agreement draft '${draftId}' not found.`,
      );
    }

    this.memoryDrafts.splice(draftIndex, 1);
  }

  async assign(
    draftId: string,
    payload: AssignHotelAgreementDraftDto,
  ): Promise<unknown> {
    const normalizedGroupCode = payload.groupCode.trim().toUpperCase();
    if (!normalizedGroupCode) {
      throw new BadRequestException("Group code is required.");
    }

    if (this.dataSource === "prisma") {
      const draft = await this.prisma.hotelAgreementDraft.findUnique({
        where: { id: draftId },
        include: {
          group: {
            select: {
              code: true,
            },
          },
        },
      });
      if (!draft) {
        throw new NotFoundException(
          `Hotel agreement draft '${draftId}' not found.`,
        );
      }
      if (draft.groupId) {
        throw new ConflictException(
          `Hotel agreement draft '${draftId}' is already assigned.`,
        );
      }

      const targetGroup = await this.prisma.group.findFirst({
        where: {
          OR: [{ id: normalizedGroupCode }, { code: normalizedGroupCode }],
        },
        select: {
          id: true,
          code: true,
        },
      });
      if (!targetGroup) {
        throw new NotFoundException(
          `Group '${normalizedGroupCode}' not found.`,
        );
      }

      await this.groupsService.addVisaHotelAgreement(
        targetGroup.code,
        this.toGroupHotelPayload(draft),
      );

      const assigned = await this.prisma.hotelAgreementDraft.update({
        where: { id: draft.id },
        data: {
          groupId: targetGroup.id,
          assignedAt: new Date(),
        },
        include: {
          group: {
            select: {
              code: true,
            },
          },
        },
      });

      return this.mapPrismaDraft(assigned);
    }

    const draft = this.resolveMemoryDraft(draftId);
    if (draft.groupCode) {
      throw new ConflictException(
        `Hotel agreement draft '${draftId}' is already assigned.`,
      );
    }

    await this.groupsService.addVisaHotelAgreement(
      normalizedGroupCode,
      this.toGroupHotelPayload(draft),
    );
    draft.groupCode = normalizedGroupCode;
    draft.assignedAt = new Date().toISOString();
    draft.updatedAt = draft.assignedAt;
    return this.mapMemoryDraft(draft);
  }

  private findAllFromMemory(
    query?: string,
    status?: DraftStatusFilter,
  ): unknown[] {
    const normalizedQuery = query?.trim().toLowerCase() ?? "";
    return this.memoryDrafts
      .filter((draft) => {
        if (status === "assigned" && !draft.groupCode) {
          return false;
        }
        if (status === "unassigned" && draft.groupCode) {
          return false;
        }
        if (!normalizedQuery) {
          return true;
        }

        return [
          draft.agreementNumber,
          draft.agentName ?? "",
          draft.hotelName,
          draft.groupCode ?? "",
          draft.notes ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .map((draft) => this.mapMemoryDraft(draft));
  }

  private async findAllWithPrisma(
    query?: string,
    status?: DraftStatusFilter,
  ): Promise<unknown[]> {
    const normalizedQuery = query?.trim() ?? "";
    const where: Prisma.HotelAgreementDraftWhereInput = {};

    if (status === "assigned") {
      where.groupId = { not: null };
    } else if (status === "unassigned") {
      where.groupId = null;
    }

    if (normalizedQuery) {
      where.OR = [
        {
          agreementNumber: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          hotelName: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          agentName: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          notes: {
            contains: normalizedQuery,
            mode: "insensitive",
          },
        },
        {
          group: {
            code: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    const drafts = await this.prisma.hotelAgreementDraft.findMany({
      where,
      orderBy: [
        {
          assignedAt: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      include: {
        group: {
          select: {
            code: true,
          },
        },
      },
    });

    return drafts.map((draft) => this.mapPrismaDraft(draft));
  }

  private normalizePayload(
    payload: UpsertHotelAgreementDraftDto,
  ): NormalizedHotelAgreementDraftPayload {
    const stayStart = toIsoDateOnly(payload.stayStart);
    const stayEnd = toIsoDateOnly(payload.stayEnd);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(stayStart) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(stayEnd)
    ) {
      throw new BadRequestException(
        "Agreement stay dates must use YYYY-MM-DD format.",
      );
    }
    if (stayEnd < stayStart) {
      throw new BadRequestException(
        "Agreement stay end date must be on or after the start date.",
      );
    }

    return {
      city: payload.city,
      agentName: payload.agentName?.trim() || undefined,
      hotelName: payload.hotelName.trim(),
      agreementNumber: payload.agreementNumber.trim(),
      pax: payload.pax,
      status: payload.status ?? AgreementApprovalStatus.WAITING,
      stayStart,
      stayEnd,
      notes: payload.notes?.trim() || undefined,
    };
  }

  private resolveMemoryDraft(draftId: string): MemoryHotelAgreementDraft {
    const draft = this.memoryDrafts.find((item) => item.id === draftId);
    if (!draft) {
      throw new NotFoundException(
        `Hotel agreement draft '${draftId}' not found.`,
      );
    }

    return draft;
  }

  private toGroupHotelPayload(
    draft: Pick<
      MemoryHotelAgreementDraft | PrismaHotelAgreementDraftRecord,
      | "city"
      | "hotelName"
      | "agreementNumber"
      | "pax"
      | "status"
      | "stayStart"
      | "stayEnd"
    >,
  ): UpsertGroupVisaHotelDto {
    return {
      city: draft.city,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      pax: draft.pax,
      status: draft.status,
      stayStart: toIsoDateOnly(draft.stayStart),
      stayEnd: toIsoDateOnly(draft.stayEnd),
    };
  }

  private mapMemoryDraft(draft: MemoryHotelAgreementDraft) {
    return {
      id: draft.id,
      city: draft.city,
      agentName: draft.agentName,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      pax: draft.pax,
      status: draft.status,
      stayStart: draft.stayStart,
      stayEnd: draft.stayEnd,
      notes: draft.notes,
      groupCode: draft.groupCode,
      assignmentStatus: draft.groupCode ? "ASSIGNED" : "UNASSIGNED",
      assignedAt: draft.assignedAt,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  private mapPrismaDraft(draft: PrismaHotelAgreementDraftRecord) {
    return {
      id: draft.id,
      city: draft.city,
      agentName: draft.agentName ?? undefined,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      pax: draft.pax,
      status: draft.status,
      stayStart: toIsoDateOnly(draft.stayStart),
      stayEnd: toIsoDateOnly(draft.stayEnd),
      notes: draft.notes ?? undefined,
      groupCode: draft.group?.code,
      assignmentStatus: draft.group ? "ASSIGNED" : "UNASSIGNED",
      assignedAt: toIsoDateTime(draft.assignedAt),
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }
}
