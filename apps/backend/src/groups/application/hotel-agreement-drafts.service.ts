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
  createdAt: Date;
  updatedAt: Date;
};

type GroupHotelAgreementSnapshot = {
  id?: unknown;
  sourceDraftId?: unknown;
  city?: unknown;
  hotelName?: unknown;
  agreementNumber?: unknown;
  pax?: unknown;
  stayStart?: unknown;
  stayEnd?: unknown;
};

type GroupWithVisaHotelAgreements = {
  visaSetup?: {
    hotelAgreements?: GroupHotelAgreementSnapshot[];
  };
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

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function doesHotelSnapshotMatchDraft(
  hotel: GroupHotelAgreementSnapshot,
  draft: Pick<
    MemoryHotelAgreementDraft | PrismaHotelAgreementDraftRecord,
    | "id"
    | "city"
    | "hotelName"
    | "agreementNumber"
    | "pax"
    | "stayStart"
    | "stayEnd"
  >,
): boolean {
  if (readText(hotel.sourceDraftId) === draft.id) {
    return true;
  }

  return (
    readText(hotel.city).toUpperCase() === draft.city &&
    readText(hotel.agreementNumber).toUpperCase() ===
      draft.agreementNumber.trim().toUpperCase() &&
    readText(hotel.hotelName).toUpperCase() ===
      draft.hotelName.trim().toUpperCase() &&
    readNumber(hotel.pax) === draft.pax &&
    toIsoDateOnly(readText(hotel.stayStart)) === toIsoDateOnly(draft.stayStart) &&
    toIsoDateOnly(readText(hotel.stayEnd)) === toIsoDateOnly(draft.stayEnd)
  );
}

function doesHotelSnapshotMatchDraftIgnoringPax(
  hotel: GroupHotelAgreementSnapshot,
  draft: Pick<
    MemoryHotelAgreementDraft | PrismaHotelAgreementDraftRecord,
    | "id"
    | "city"
    | "hotelName"
    | "agreementNumber"
    | "stayStart"
    | "stayEnd"
  >,
): boolean {
  if (readText(hotel.sourceDraftId) === draft.id) {
    return true;
  }

  return (
    readText(hotel.city).toUpperCase() === draft.city &&
    readText(hotel.agreementNumber).toUpperCase() ===
      draft.agreementNumber.trim().toUpperCase() &&
    readText(hotel.hotelName).toUpperCase() ===
      draft.hotelName.trim().toUpperCase() &&
    toIsoDateOnly(readText(hotel.stayStart)) === toIsoDateOnly(draft.stayStart) &&
    toIsoDateOnly(readText(hotel.stayEnd)) === toIsoDateOnly(draft.stayEnd)
  );
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

  private async getPrismaDraftRemainingAndGroups(
    draft: Pick<PrismaHotelAgreementDraftRecord, "agreementNumber" | "city" | "pax" | "hotelName" | "stayStart" | "stayEnd" | "id">
  ) {
    const assignedAgreements = await this.prisma.visaHotelAgreement.findMany({
      where: {
        agreementNumber: draft.agreementNumber,
        city: draft.city,
      },
      include: {
        visaSetup: {
          select: {
            group: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    const totalAssignedPax = assignedAgreements.reduce((sum, h) => sum + h.pax, 0);
    const remainingPax = Math.max(0, draft.pax - totalAssignedPax);
    const assignedGroups = assignedAgreements.map((a) => ({
      groupCode: a.visaSetup.group?.code ?? "",
      pax: a.pax,
    })).filter((g) => g.groupCode !== "");

    return { remainingPax, assignedGroups };
  }

  private async getMemoryDraftRemainingAndGroups(
    draft: Pick<MemoryHotelAgreementDraft, "agreementNumber" | "city" | "pax" | "hotelName" | "stayStart" | "stayEnd" | "id">
  ) {
    const groups = (await this.groupsService.findAll()) as GroupWithVisaHotelAgreements[];
    let totalAssignedPax = 0;
    const assignedGroups: Array<{ groupCode: string; pax: number }> = [];

    for (const g of groups) {
      const code = (g as any).code;
      if (!code) continue;
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      for (const h of agreements) {
        if (doesHotelSnapshotMatchDraftIgnoringPax(h, draft)) {
          const pax = readNumber(h.pax) ?? 0;
          totalAssignedPax += pax;
          assignedGroups.push({ groupCode: code, pax });
        }
      }
    }

    const remainingPax = Math.max(0, draft.pax - totalAssignedPax);
    return { remainingPax, assignedGroups };
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
      });

      const { remainingPax, assignedGroups } = await this.getPrismaDraftRemainingAndGroups(created);
      return this.mapPrismaDraft(created, remainingPax, assignedGroups);
    }

    const now = new Date().toISOString();
    const draft: MemoryHotelAgreementDraft = {
      id: randomUUID(),
      ...normalizedPayload,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryDrafts.unshift(draft);
    const { remainingPax, assignedGroups } = await this.getMemoryDraftRemainingAndGroups(draft);
    return this.mapMemoryDraft(draft, remainingPax, assignedGroups);
  }

  async update(
    draftId: string,
    payload: UpsertHotelAgreementDraftDto,
  ): Promise<unknown> {
    const normalizedPayload = this.normalizePayload(payload);
    if (this.dataSource === "prisma") {
      const existing = await this.prisma.hotelAgreementDraft.findUnique({
        where: { id: draftId },
        select: { id: true, agreementNumber: true, city: true },
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
      });

      // Cascade update to all linked group agreements with matching agreement number and city
      await this.prisma.visaHotelAgreement.updateMany({
        where: {
          agreementNumber: existing.agreementNumber,
          city: existing.city,
        },
        data: {
          agreementNumber: normalizedPayload.agreementNumber,
          city: normalizedPayload.city,
          hotelName: normalizedPayload.hotelName,
          status: normalizedPayload.status,
          stayStart: toUtcMidnightDate(normalizedPayload.stayStart),
          stayEnd: toUtcMidnightDate(normalizedPayload.stayEnd),
        },
      });

      const { remainingPax, assignedGroups } = await this.getPrismaDraftRemainingAndGroups(updated);
      return this.mapPrismaDraft(updated, remainingPax, assignedGroups);
    }

    const draft = this.resolveMemoryDraft(draftId);
    const originalAgreementNumber = draft.agreementNumber;
    const originalCity = draft.city;

    Object.assign(draft, normalizedPayload, {
      updatedAt: new Date().toISOString(),
    });

    const groups = (await this.groupsService.findAll()) as any[];
    for (const g of groups) {
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      for (const h of agreements) {
        if (
          h.city === originalCity &&
          h.agreementNumber?.trim().toUpperCase() === originalAgreementNumber.trim().toUpperCase()
        ) {
          h.agreementNumber = normalizedPayload.agreementNumber;
          h.city = normalizedPayload.city;
          h.hotelName = normalizedPayload.hotelName;
          h.status = normalizedPayload.status;
          h.stayStart = normalizedPayload.stayStart;
          h.stayEnd = normalizedPayload.stayEnd;
        }
      }
    }

    const { remainingPax, assignedGroups } = await this.getMemoryDraftRemainingAndGroups(draft);
    return this.mapMemoryDraft(draft, remainingPax, assignedGroups);
  }

  async remove(draftId: string): Promise<void> {
    if (this.dataSource === "prisma") {
      const draft = await this.prisma.hotelAgreementDraft.findUnique({
        where: { id: draftId },
      });
      if (!draft) {
        throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
      }

      const assignedAgreements = await this.prisma.visaHotelAgreement.findMany({
        where: {
          agreementNumber: draft.agreementNumber,
          city: draft.city,
        },
        include: {
          visaSetup: {
            include: {
              group: true,
            },
          },
        },
      });

      if (assignedAgreements.length > 0) {
        const groupCodes = Array.from(new Set(assignedAgreements.map(a => a.visaSetup?.group?.code).filter(Boolean))).join(", ");
        throw new BadRequestException(`Draft tidak dapat dihapus karena sudah di-assign pada grup: ${groupCodes}`);
      }

      await this.prisma.hotelAgreementDraft.deleteMany({
        where: { id: draftId },
      });
      return;
    }

    const draftIndex = this.memoryDrafts.findIndex(
      (draft) => draft.id === draftId,
    );
    if (draftIndex === -1) {
      throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
    }

    const draft = this.memoryDrafts[draftIndex];
    const { assignedGroups } = await this.getMemoryDraftRemainingAndGroups(draft);
    if (assignedGroups.length > 0) {
      const groupCodes = Array.from(new Set(assignedGroups.map(g => g.groupCode))).join(", ");
      throw new BadRequestException(`Draft tidak dapat dihapus karena sudah di-assign pada grup: ${groupCodes}`);
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
      });
      if (!draft) {
        throw new NotFoundException(
          `Hotel agreement draft '${draftId}' not found.`,
        );
      }

      // Check auto-reject before assignment
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (
        draft.status === AgreementApprovalStatus.WAITING &&
        draft.updatedAt < cutoff
      ) {
        await this.prisma.hotelAgreementDraft.update({
          where: { id: draft.id },
          data: { status: AgreementApprovalStatus.REJECTED },
        });
        throw new BadRequestException(
          "Hotel agreement ini berstatus ditolak (Rejected) karena telah melewati batas waktu 24 jam. Silakan edit nomor agreement untuk mengajukan kembali.",
        );
      }

      if (draft.status === AgreementApprovalStatus.REJECTED) {
        throw new BadRequestException(
          "Hotel agreement ini berstatus ditolak (Rejected). Silakan edit nomor agreement untuk mengajukan kembali.",
        );
      }

      // Calculate already assigned pax
      const assignedAgreements = await this.prisma.visaHotelAgreement.findMany({
        where: {
          agreementNumber: draft.agreementNumber,
          city: draft.city,
        },
      });
      const totalAssignedPax = assignedAgreements.reduce((sum, h) => sum + h.pax, 0);
      const remainingCapacity = draft.pax - totalAssignedPax;

      if (remainingCapacity <= 0) {
        throw new ConflictException(
          `Hotel agreement draft '${draftId}' is already fully assigned (capacity: ${draft.pax} pax).`,
        );
      }

      const targetGroup = await this.prisma.group.findFirst({
        where: {
          OR: [{ id: normalizedGroupCode }, { code: normalizedGroupCode }],
        },
        select: {
          id: true,
          code: true,
          pax: true,
        },
      });
      if (!targetGroup) {
        throw new NotFoundException(
          `Group '${normalizedGroupCode}' not found.`,
        );
      }

      // Check if target group is already assigned to this agreement
      const targetGroupAgreement = await this.prisma.visaHotelAgreement.findFirst({
        where: {
          visaSetup: {
            groupId: targetGroup.id,
          },
          agreementNumber: draft.agreementNumber,
          city: draft.city,
        },
      });
      if (targetGroupAgreement) {
        throw new ConflictException(
          `Agreement ${draft.agreementNumber} is already assigned to group '${targetGroup.code}'.`,
        );
      }

      const paxToAssign = Math.min(targetGroup.pax, remainingCapacity);

      const groupHotelPayload = {
        ...this.toGroupHotelPayload(draft, draft.id),
        pax: paxToAssign,
      };

      await this.groupsService.addVisaHotelAgreement(
        targetGroup.code,
        groupHotelPayload,
      );

      const nextRemaining = remainingCapacity - paxToAssign;

      const assigned = await this.prisma.hotelAgreementDraft.findUnique({
        where: { id: draft.id }
      });

      if (!assigned) {
        throw new NotFoundException(`Draft not found after assignment.`);
      }

      const { assignedGroups } = await this.getPrismaDraftRemainingAndGroups(assigned);
      return this.mapPrismaDraft(assigned, nextRemaining, assignedGroups);
    }

    const draft = this.resolveMemoryDraft(draftId);

    // Check auto-reject before assignment
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    if (
      draft.status === AgreementApprovalStatus.WAITING &&
      new Date(draft.updatedAt).getTime() < cutoffMs
    ) {
      draft.status = AgreementApprovalStatus.REJECTED;
    }

    if (draft.status === AgreementApprovalStatus.REJECTED) {
      throw new BadRequestException(
        "Hotel agreement ini berstatus ditolak (Rejected). Silakan edit nomor agreement untuk mengajukan kembali.",
      );
    }

    // Calculate already assigned pax in memory
    const groups = (await this.groupsService.findAll()) as GroupWithVisaHotelAgreements[];
    let totalAssignedPax = 0;
    for (const g of groups) {
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      for (const h of agreements) {
        if (doesHotelSnapshotMatchDraftIgnoringPax(h, draft)) {
          totalAssignedPax += readNumber(h.pax) ?? 0;
        }
      }
    }
    const remainingCapacity = draft.pax - totalAssignedPax;

    if (remainingCapacity <= 0) {
      throw new ConflictException(
        `Hotel agreement draft '${draftId}' is already fully assigned (capacity: ${draft.pax} pax).`,
      );
    }

    const targetGroup = (await this.groupsService.findOneByIdOrCode(
      normalizedGroupCode,
    )) as { id: string; code: string; pax: number; visaSetup?: { hotelAgreements?: GroupHotelAgreementSnapshot[] } } | null;
    if (!targetGroup) {
      throw new NotFoundException(
        `Group '${normalizedGroupCode}' not found.`,
      );
    }

    // Check if target group is already assigned to this agreement
    const targetAgreements = targetGroup.visaSetup?.hotelAgreements ?? [];
    const alreadyAssignedToTarget = targetAgreements.some((h) =>
      doesHotelSnapshotMatchDraftIgnoringPax(h, draft),
    );
    if (alreadyAssignedToTarget) {
      throw new ConflictException(
        `Agreement ${draft.agreementNumber} is already assigned to group '${targetGroup.code}'.`,
      );
    }

    const paxToAssign = Math.min(targetGroup.pax, remainingCapacity);

    const groupHotelPayload = {
      ...this.toGroupHotelPayload(draft, draft.id),
      pax: paxToAssign,
    };

    await this.groupsService.addVisaHotelAgreement(
      normalizedGroupCode,
      groupHotelPayload,
    );

    const nextRemaining = remainingCapacity - paxToAssign;
    draft.updatedAt = new Date().toISOString();

    const { assignedGroups } = await this.getMemoryDraftRemainingAndGroups(draft);
    return this.mapMemoryDraft(draft, nextRemaining, assignedGroups);
  }

  async unassign(draftId: string, groupCode?: string): Promise<unknown> {
    if (this.dataSource === "prisma") {
      const draft = await this.prisma.hotelAgreementDraft.findUnique({
        where: { id: draftId }
      });
      if (!draft) {
        throw new NotFoundException(
          `Hotel agreement draft '${draftId}' not found.`,
        );
      }

      let targetGroupCode = groupCode?.trim().toUpperCase();

      if (targetGroupCode) {
        const targetGroup = await this.prisma.group.findFirst({
          where: {
            OR: [{ id: targetGroupCode }, { code: targetGroupCode }],
          },
          select: {
            id: true,
            code: true,
          },
        });

        if (targetGroup) {
          const targetGroupAgreement = await this.prisma.visaHotelAgreement.findFirst({
            where: {
              visaSetup: {
                groupId: targetGroup.id,
              },
              agreementNumber: draft.agreementNumber,
              city: draft.city,
            },
            select: {
              id: true,
            },
          });

          if (targetGroupAgreement) {
            await this.groupsService.removeVisaHotelAgreement(
              targetGroup.code,
              targetGroupAgreement.id,
            );
          }
        }
      } else {
        const allAssigned = await this.prisma.visaHotelAgreement.findMany({
          where: {
            agreementNumber: draft.agreementNumber,
            city: draft.city,
          },
          include: {
            visaSetup: {
              select: {
                group: {
                  select: {
                    code: true,
                  },
                },
              },
            },
          },
        });

        for (const item of allAssigned) {
          const code = item.visaSetup.group?.code;
          if (code) {
            await this.groupsService.removeVisaHotelAgreement(code, item.id);
          }
        }
      }

      const unassigned = await this.prisma.hotelAgreementDraft.findUnique({
        where: { id: draft.id }
      });
      if (!unassigned) {
        throw new NotFoundException(`Draft not found after unassignment.`);
      }

      const nextAssigned = await this.prisma.visaHotelAgreement.findMany({
        where: {
          agreementNumber: draft.agreementNumber,
          city: draft.city,
        },
      });
      const nextTotal = nextAssigned.reduce((sum, h) => sum + h.pax, 0);
      const nextRemaining = Math.max(0, draft.pax - nextTotal);

      const { assignedGroups } = await this.getPrismaDraftRemainingAndGroups(unassigned);
      return this.mapPrismaDraft(unassigned, nextRemaining, assignedGroups);
    }

    const draft = this.resolveMemoryDraft(draftId);
    let targetGroupCode = groupCode?.trim().toUpperCase();
    if (!targetGroupCode && draft.groupCode) {
      targetGroupCode = draft.groupCode;
    }

    if (targetGroupCode) {
      const group = (await this.groupsService.findOneByIdOrCode(
        targetGroupCode,
      )) as GroupWithVisaHotelAgreements;
      const groupHotel = group?.visaSetup?.hotelAgreements?.find((hotel) =>
        doesHotelSnapshotMatchDraftIgnoringPax(hotel, draft),
      );
      const groupHotelId = readText(groupHotel?.id);
      if (groupHotelId) {
        await this.groupsService.removeVisaHotelAgreement(
          targetGroupCode,
          groupHotelId,
        );
      }
    } else {
      const groups = (await this.groupsService.findAll()) as GroupWithVisaHotelAgreements[];
      for (const g of groups) {
        const code = (g as any).code;
        const groupHotel = g.visaSetup?.hotelAgreements?.find((hotel) =>
          doesHotelSnapshotMatchDraftIgnoringPax(hotel, draft),
        );
        const groupHotelId = readText(groupHotel?.id);
        if (groupHotelId && code) {
          await this.groupsService.removeVisaHotelAgreement(code, groupHotelId);
        }
      }
    }

    draft.updatedAt = new Date().toISOString();

    const groups = (await this.groupsService.findAll()) as GroupWithVisaHotelAgreements[];
    let nextTotal = 0;
    for (const g of groups) {
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      for (const h of agreements) {
        if (doesHotelSnapshotMatchDraftIgnoringPax(h, draft)) {
          nextTotal += readNumber(h.pax) ?? 0;
        }
      }
    }
    const nextRemaining = Math.max(0, draft.pax - nextTotal);

    const { assignedGroups } = await this.getMemoryDraftRemainingAndGroups(draft);
    return this.mapMemoryDraft(draft, nextRemaining, assignedGroups);
  }

  private async findAllFromMemory(
    query?: string,
    status?: DraftStatusFilter,
  ): Promise<unknown[]> {
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    for (const draft of this.memoryDrafts) {
      if (
        draft.status === AgreementApprovalStatus.WAITING &&
        new Date(draft.updatedAt).getTime() < cutoffMs
      ) {
        draft.status = AgreementApprovalStatus.REJECTED;
      }
    }

    const groups = (await this.groupsService.findAll()) as GroupWithVisaHotelAgreements[];
    const assignedPaxMap = new Map<string, number>();
    const assignedGroupsMap = new Map<string, Array<{ groupCode: string; pax: number }>>();

    for (const g of groups) {
      const code = (g as any).code;
      if (!code) continue;
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      for (const h of agreements) {
        const key = `${readText(h.city).toUpperCase()}_${readText(h.agreementNumber).trim().toUpperCase()}`;
        
        const prevPax = assignedPaxMap.get(key) ?? 0;
        assignedPaxMap.set(key, prevPax + (readNumber(h.pax) ?? 0));

        const prevGroups = assignedGroupsMap.get(key) ?? [];
        prevGroups.push({ groupCode: code, pax: readNumber(h.pax) ?? 0 });
        assignedGroupsMap.set(key, prevGroups);
      }
    }

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
      .map((draft) => {
        const key = `${draft.city}_${draft.agreementNumber.trim().toUpperCase()}`;
        const assignedPax = assignedPaxMap.get(key) ?? 0;
        const remainingPax = Math.max(0, draft.pax - assignedPax);
        const assignedGroups = assignedGroupsMap.get(key) ?? [];
        return this.mapMemoryDraft(draft, remainingPax, assignedGroups);
      });
  }

  private async findAllWithPrisma(
    query?: string,
    status?: DraftStatusFilter,
  ): Promise<unknown[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.prisma.hotelAgreementDraft.updateMany({
      where: {
        status: AgreementApprovalStatus.WAITING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: AgreementApprovalStatus.REJECTED,
      },
    });

    const normalizedQuery = query?.trim() ?? "";
    const where: Prisma.HotelAgreementDraftWhereInput = {};

    if (status === "assigned") {
      const assignedAgreements = await this.prisma.visaHotelAgreement.findMany({ select: { agreementNumber: true, city: true } });
      const assignedPairs = Array.from(new Set(assignedAgreements.map(a => `${a.city}:${a.agreementNumber}`)));
      if (assignedPairs.length > 0) {
        where.OR = assignedPairs.map(p => {
          const [c, n] = p.split(":");
          return { city: c as any, agreementNumber: n };
        });
      } else {
        where.id = "no-match"; // force empty result
      }
    } else if (status === "unassigned") {
      const assignedAgreements = await this.prisma.visaHotelAgreement.findMany({ select: { agreementNumber: true, city: true } });
      const assignedPairs = Array.from(new Set(assignedAgreements.map(a => `${a.city}:${a.agreementNumber}`)));
      if (assignedPairs.length > 0) {
        where.NOT = assignedPairs.map(p => {
          const [c, n] = p.split(":");
          return { city: c as any, agreementNumber: n };
        });
      }
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
      ];
    }

    const drafts = await this.prisma.hotelAgreementDraft.findMany({
      where,
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      });

    const assignedAgreements = await this.prisma.visaHotelAgreement.findMany({
      include: {
        visaSetup: {
          select: {
            group: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    return drafts.map((draft) => {
      const matchingAgreements = assignedAgreements.filter(
        (a) =>
          a.agreementNumber.trim().toUpperCase() ===
            draft.agreementNumber.trim().toUpperCase() &&
          a.city === draft.city,
      );
      const totalAssignedPax = matchingAgreements.reduce((sum, h) => sum + h.pax, 0);
      const remainingPax = Math.max(0, draft.pax - totalAssignedPax);
      const assignedGroups = matchingAgreements.map((a) => ({
        groupCode: a.visaSetup.group?.code ?? "",
        pax: a.pax,
      })).filter((g) => g.groupCode !== "");

      return this.mapPrismaDraft(draft, remainingPax, assignedGroups);
    });
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
      | "id"
      | "city"
      | "hotelName"
      | "agreementNumber"
      | "pax"
      | "status"
      | "stayStart"
      | "stayEnd"
    >,
    sourceDraftId?: string,
  ): UpsertGroupVisaHotelDto {
    return {
      city: draft.city,
      sourceDraftId: sourceDraftId?.trim() || undefined,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      pax: draft.pax,
      status: draft.status,
      stayStart: toIsoDateOnly(draft.stayStart),
      stayEnd: toIsoDateOnly(draft.stayEnd),
    };
  }



  private mapMemoryDraft(
    draft: MemoryHotelAgreementDraft,
    remainingPax?: number,
    assignedGroups?: Array<{ groupCode: string; pax: number }>,
  ) {
    return {
      id: draft.id,
      city: draft.city,
      agentName: draft.agentName,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      pax: draft.pax,
      remainingPax: remainingPax !== undefined ? remainingPax : draft.pax,
      assignedGroups: assignedGroups ?? [],
      status: draft.status,
      stayStart: draft.stayStart,
      stayEnd: draft.stayEnd,
      notes: draft.notes,
      groupCode: undefined,
      assignmentStatus: remainingPax !== undefined && remainingPax <= 0 ? "Assigned" : (assignedGroups && assignedGroups.length > 0 ? "Partially Assigned" : "Unassigned"),
      assignedAt: undefined,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }

  private mapPrismaDraft(
    draft: PrismaHotelAgreementDraftRecord,
    remainingPax?: number,
    assignedGroups?: Array<{ groupCode: string; pax: number }>,
  ) {
    return {
      id: draft.id,
      city: draft.city,
      agentName: draft.agentName ?? undefined,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      pax: draft.pax,
      remainingPax: remainingPax !== undefined ? remainingPax : draft.pax,
      assignedGroups: assignedGroups ?? [],
      status: draft.status,
      stayStart: toIsoDateOnly(draft.stayStart),
      stayEnd: toIsoDateOnly(draft.stayEnd),
      notes: draft.notes ?? undefined,
      groupCode: undefined,
      assignmentStatus: remainingPax !== undefined && remainingPax <= 0 ? "Assigned" : (assignedGroups && assignedGroups.length > 0 ? "Partially Assigned" : "Unassigned"),
      assignedAt: undefined,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    };
  }
}
