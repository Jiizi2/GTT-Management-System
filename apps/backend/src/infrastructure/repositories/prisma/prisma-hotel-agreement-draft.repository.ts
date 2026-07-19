import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { AgreementApprovalStatus, AgreementCity, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { GroupsService } from "../../../groups/application/groups.service";
import { HotelAgreementDraftRepository } from "../../../domain/repositories/hotel-agreement-draft.repository";
import {
  UpsertHotelAgreementDraftDto,
  AssignHotelAgreementDraftDto,
} from "../../../groups/dto/hotel-agreement-draft.dto";
import { toIsoDateOnly, toUtcMidnightDate, isIsoDateOnly } from "../../../utils/date-helpers";

type DraftStatusFilter = "assigned" | "unassigned";

type PrismaHotelAgreementDraftRecord = {
  id: string;
  city: UpsertHotelAgreementDraftDto["city"];
  agentId: string;
  groupName: string;
  agent?: { id: string; code: string; name: string };
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

function buildPrismaDraftAgreementMatchers(
  draft: Pick<PrismaHotelAgreementDraftRecord, "id">
) {
  return [{ sourceDraftId: draft.id }];
}

function getStayNights(startIso: string, endIso: string): string[] {
  const nights: string[] = [];
  const current = new Date(`${startIso}T12:00:00.000Z`);
  const end = new Date(`${endIso}T12:00:00.000Z`);
  while (current < end) {
    nights.push(toIsoDateOnly(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return nights;
}

function getStayPeriods(agreements: { stayStartIso: string; stayEndIso: string }[]) {
  const dates = Array.from(
    new Set(
      agreements.flatMap((a) => [a.stayStartIso.trim(), a.stayEndIso.trim()]).filter(isIsoDateOnly)
    )
  ).sort();
  const periods = [];
  for (let i = 0; i < dates.length - 1; i++) {
    periods.push({
      startIso: dates[i],
      endIso: dates[i + 1],
    });
  }
  return periods;
}

function calculateAllocatedStayDates(
  group: { arrivalDate: Date | string | null | undefined; returnDate: Date | string | null | undefined },
  draft: { stayStart: Date | string; stayEnd: Date | string },
  existingAgreements: Array<{ stayStart: Date | string; stayEnd: Date | string }>
): { stayStart: string; stayEnd: string } {
  const groupStart = group.arrivalDate ? toIsoDateOnly(group.arrivalDate) : "";
  const groupEnd = group.returnDate ? toIsoDateOnly(group.returnDate) : "";
  const draftStart = toIsoDateOnly(draft.stayStart);
  const draftEnd = toIsoDateOnly(draft.stayEnd);

  if (!isIsoDateOnly(groupStart) || !isIsoDateOnly(groupEnd)) {
    return { stayStart: draftStart, stayEnd: draftEnd };
  }

  const groupNights = getStayNights(groupStart, groupEnd);
  const draftNights = getStayNights(draftStart, draftEnd);

  const coveredNights = new Set<string>();
  for (const agreement of existingAgreements) {
    const aggStart = toIsoDateOnly(agreement.stayStart);
    const aggEnd = toIsoDateOnly(agreement.stayEnd);
    if (isIsoDateOnly(aggStart) && isIsoDateOnly(aggEnd)) {
      const aggNights = getStayNights(aggStart, aggEnd);
      for (const night of aggNights) {
        coveredNights.add(night);
      }
    }
  }

  const overlappingNights = groupNights.filter(
    (night) => !coveredNights.has(night) && draftNights.includes(night)
  );

  if (overlappingNights.length === 0) {
    const intersection = groupNights.filter((night) => draftNights.includes(night));
    if (intersection.length > 0) {
      const sorted = intersection.sort();
      const lastNight = sorted[sorted.length - 1];
      const nextDay = new Date(Date.parse(lastNight) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return { stayStart: sorted[0], stayEnd: nextDay };
    }
    return { stayStart: draftStart, stayEnd: draftEnd };
  }

  const sortedNights = overlappingNights.sort();
  const stayStart = sortedNights[0];
  const lastNight = sortedNights[sortedNights.length - 1];
  const stayEnd = new Date(Date.parse(lastNight) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return { stayStart, stayEnd };
}

@Injectable()
export class PrismaHotelAgreementDraftRepository implements HotelAgreementDraftRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly groupsService: GroupsService,
  ) {}

  private normalizeStatusFilter(rawStatus?: string): DraftStatusFilter | undefined {
    if (!rawStatus) return undefined;
    const trimmed = rawStatus.trim().toLowerCase();
    return trimmed === "assigned" || trimmed === "unassigned" ? (trimmed as DraftStatusFilter) : undefined;
  }

  private normalizePayload(payload: UpsertHotelAgreementDraftDto) {
    const city = payload.city;
    if (city !== AgreementCity.MAKKAH && city !== AgreementCity.MADINAH) {
      throw new BadRequestException("City must be either 'MAKKAH' or 'MADINAH'.");
    }

    const hotelName = payload.hotelName.trim();
    if (!hotelName) {
      throw new BadRequestException("Hotel name is required.");
    }

    const agreementNumber = payload.agreementNumber.trim().toUpperCase();
    if (!agreementNumber) {
      throw new BadRequestException("Agreement number is required.");
    }

    const pax = Math.max(1, Math.floor(payload.pax));
    const stayStart = toIsoDateOnly(payload.stayStart);
    const stayEnd = toIsoDateOnly(payload.stayEnd);

    if (Date.parse(stayEnd) <= Date.parse(stayStart)) {
      throw new BadRequestException("Stay end date must be after stay start date.");
    }

    return {
      city,
      agentId: payload.agentId?.trim() || "agent_gtt_direct",
      groupName: payload.groupName?.trim() || "",
      hotelName,
      agreementNumber,
      pax,
      status: payload.status || AgreementApprovalStatus.WAITING,
      stayStart,
      stayEnd,
      notes: payload.notes?.trim(),
    };
  }

  private toGroupHotelPayload(draft: any, sourceDraftId: string) {
    return {
      sourceDraftId,
      city: draft.city,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      status: draft.status,
    };
  }

  private async getPrismaDraftRemainingAndGroups(
    draft: Pick<PrismaHotelAgreementDraftRecord, "agreementNumber" | "city" | "pax" | "hotelName" | "stayStart" | "stayEnd" | "id">
  ) {
    const assignedAgreements = await this.prisma.visaHotelAgreement.findMany({
      where: {
        OR: buildPrismaDraftAgreementMatchers(draft),
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

    const draftNights = getStayNights(toIsoDateOnly(draft.stayStart), toIsoDateOnly(draft.stayEnd));
    let maxOccupied = 0;
    for (const night of draftNights) {
      const occupiedOnNight = assignedAgreements
        .filter((a) => {
          const aStart = toIsoDateOnly(a.stayStart);
          const aEnd = toIsoDateOnly(a.stayEnd);
          return night >= aStart && night < aEnd;
        })
        .reduce((sum, a) => sum + a.pax, 0);

      if (occupiedOnNight > maxOccupied) {
        maxOccupied = occupiedOnNight;
      }
    }

    const remainingPax = Math.max(0, draft.pax - maxOccupied);
    const groups = assignedAgreements
      .map((a) => {
        const code = a.visaSetup?.group?.code;
        if (!code) return null;
        return {
          groupCode: code,
          pax: a.pax,
          stayStart: toIsoDateOnly(a.stayStart),
          stayEnd: toIsoDateOnly(a.stayEnd),
        };
      })
      .filter((g): g is { groupCode: string; pax: number; stayStart: string; stayEnd: string } => g !== null);

    return {
      remainingPax,
      assignedGroups: groups,
    };
  }

  private mapPrismaDraft(draft: PrismaHotelAgreementDraftRecord, remainingPax: number, assignedGroups: any[]) {
    const isAssigned = assignedGroups.length > 0;
    const assignmentStatus = isAssigned
      ? remainingPax > 0
        ? "Partially Assigned"
        : "Assigned"
      : "Unassigned";

    return {
      id: draft.id,
      city: draft.city,
      agentName: draft.agent?.name,
      agentId: draft.agentId,
      agent: draft.agent,
      groupName: draft.groupName,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      pax: draft.pax,
      status: draft.status,
      stayStart: toIsoDateOnly(draft.stayStart),
      stayEnd: toIsoDateOnly(draft.stayEnd),
      notes: draft.notes ?? undefined,
      remainingPax,
      assignedGroups,
      assignmentStatus,
    };
  }

  async findAll(query?: string, rawStatus?: string, agentId?: string): Promise<unknown[]> {
    const status = this.normalizeStatusFilter(rawStatus);
    const normalizedQuery = query?.trim().toLowerCase();

    const drafts = await this.prisma.hotelAgreementDraft.findMany({
      where: agentId ? { agentId } : undefined, orderBy: { createdAt: "desc" }, include: { agent: { select: { id: true, code: true, name: true } } },
    });

    const mapped = await Promise.all(
      drafts.map(async (draft) => {
        const { remainingPax, assignedGroups } = await this.getPrismaDraftRemainingAndGroups(draft);
        return this.mapPrismaDraft(draft, remainingPax, assignedGroups);
      })
    );

    return mapped.filter((draft) => {
      if (status === "assigned") {
        if (draft.assignedGroups.length === 0) return false;
      } else if (status === "unassigned") {
        if (draft.assignedGroups.length > 0) return false;
      }

      if (normalizedQuery) {
        const matchNumber = draft.agreementNumber.toLowerCase().includes(normalizedQuery);
        const matchHotel = draft.hotelName.toLowerCase().includes(normalizedQuery);
        const matchAgent = draft.agentName?.toLowerCase().includes(normalizedQuery) ?? false;
        const matchGroupName = draft.groupName.toLowerCase().includes(normalizedQuery);
        const matchGroup = draft.assignedGroups.some((g: any) => g.groupCode.toLowerCase().includes(normalizedQuery));
        return matchNumber || matchHotel || matchAgent || matchGroupName || matchGroup;
      }

      return true;
    });
  }

  async create(payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    const normalizedPayload = this.normalizePayload(payload);
    const created = await this.prisma.hotelAgreementDraft.create({
      data: {
        city: normalizedPayload.city,
        agentId: normalizedPayload.agentId,
        groupName: normalizedPayload.groupName,
        hotelName: normalizedPayload.hotelName,
        agreementNumber: normalizedPayload.agreementNumber,
        pax: normalizedPayload.pax,
        status: normalizedPayload.status,
        stayStart: toUtcMidnightDate(normalizedPayload.stayStart),
        stayEnd: toUtcMidnightDate(normalizedPayload.stayEnd),
        notes: normalizedPayload.notes ?? null,
      },
      include: { agent: { select: { id: true, code: true, name: true } } },
    });

    const { remainingPax, assignedGroups } = await this.getPrismaDraftRemainingAndGroups(created);
    return this.mapPrismaDraft(created, remainingPax, assignedGroups);
  }

  async update(draftId: string, payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    const normalizedPayload = this.normalizePayload(payload);
    const existing = await this.prisma.hotelAgreementDraft.findUnique({
      where: { id: draftId },
      select: { id: true, agreementNumber: true, city: true },
    });
    if (!existing) {
      throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
    }

    const updated = await this.prisma.hotelAgreementDraft.update({
      where: { id: draftId },
      data: {
        city: normalizedPayload.city,
        agentId: normalizedPayload.agentId,
        groupName: normalizedPayload.groupName,
        hotelName: normalizedPayload.hotelName,
        agreementNumber: normalizedPayload.agreementNumber,
        pax: normalizedPayload.pax,
        status: normalizedPayload.status,
        stayStart: toUtcMidnightDate(normalizedPayload.stayStart),
        stayEnd: toUtcMidnightDate(normalizedPayload.stayEnd),
        notes: normalizedPayload.notes ?? null,
      },
      include: { agent: { select: { id: true, code: true, name: true } } },
    });

    await this.prisma.visaHotelAgreement.updateMany({
      where: {
        sourceDraftId: existing.id,
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

  async remove(draftId: string): Promise<void> {
    const existing = await this.prisma.hotelAgreementDraft.findUnique({
      where: { id: draftId },
    });
    if (!existing) {
      throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
    }

    await this.prisma.hotelAgreementDraft.delete({
      where: { id: draftId },
    });
  }

  async assign(draftId: string, payload: AssignHotelAgreementDraftDto): Promise<unknown> {
    const normalizedGroupCode = payload.groupCode.trim().toUpperCase();
    if (!normalizedGroupCode) {
      throw new BadRequestException("Group code is required.");
    }

    let assignmentResult;
    try {
      assignmentResult = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('hotel-draft-assignment'), hashtext(${draftId}))`;
        const draft = await tx.hotelAgreementDraft.findUnique({ where: { id: draftId } });
        if (!draft) throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);

        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (draft.status === AgreementApprovalStatus.WAITING && draft.updatedAt < cutoff) {
          await tx.hotelAgreementDraft.update({
            where: { id: draft.id },
            data: { status: AgreementApprovalStatus.REJECTED },
          });
          return { expired: true as const };
        }
        if (draft.status === AgreementApprovalStatus.REJECTED) {
          throw new BadRequestException("Hotel agreement ini berstatus ditolak (Rejected). Edit draft untuk mengajukan kembali.");
        }

        const targetGroup = await tx.group.findFirst({
      where: {
        OR: [{ id: normalizedGroupCode }, { code: normalizedGroupCode }],
      },
      select: {
        id: true,
        code: true,
        agentId: true,
        pax: true,
        arrivalDate: true,
        returnDate: true,
        visaSetup: {
          select: {
            hotelAgreements: {
              select: {
                id: true,
                city: true,
                stayStart: true,
                stayEnd: true,
              },
            },
          },
        },
      },
        });
        if (!targetGroup) throw new NotFoundException(`Group '${normalizedGroupCode}' not found.`);
        if (targetGroup.agentId !== draft.agentId) {
          throw new BadRequestException("Hotel agreement dan Group harus berasal dari Agent yang sama.");
        }

    const customStart = payload.stayStart ? toIsoDateOnly(payload.stayStart) : undefined;
    const customEnd = payload.stayEnd ? toIsoDateOnly(payload.stayEnd) : undefined;

    const existingAgreements = targetGroup.visaSetup?.hotelAgreements ?? [];
    const allocatedStay = (customStart && customEnd)
      ? { stayStart: customStart, stayEnd: customEnd }
      : calculateAllocatedStayDates(targetGroup, draft as any, existingAgreements);

        const assignedAgreements = await tx.visaHotelAgreement.findMany({
          where: { sourceDraftId: draft.id },
        });

    const allocatedNights = getStayNights(allocatedStay.stayStart, allocatedStay.stayEnd);
    let minRemaining = draft.pax;
    for (const night of allocatedNights) {
      const occupiedOnNight = assignedAgreements
        .filter((a) => {
          const aStart = toIsoDateOnly(a.stayStart);
          const aEnd = toIsoDateOnly(a.stayEnd);
          return night >= aStart && night < aEnd;
        })
        .reduce((sum, a) => sum + a.pax, 0);
      const remainingOnNight = Math.max(0, draft.pax - occupiedOnNight);
      if (remainingOnNight < minRemaining) {
        minRemaining = remainingOnNight;
      }
    }

    if (minRemaining <= 0) {
      throw new ConflictException(
        `Hotel agreement draft '${draftId}' is already fully assigned (capacity: ${draft.pax} pax) or has no remaining capacity for the required period (${allocatedStay.stayStart} s/d ${allocatedStay.stayEnd}).`,
      );
    }

        const targetGroupAgreement = await tx.visaHotelAgreement.findFirst({
      where: {
        visaSetup: {
          groupId: targetGroup.id,
        },
        sourceDraftId: draft.id,
      },
    });
    if (targetGroupAgreement) {
      throw new ConflictException(`Agreement ${draft.agreementNumber} is already assigned to group '${targetGroup.code}'.`);
    }

    const paxToAssign = Math.min(targetGroup.pax, minRemaining);

        const visaSetup = await tx.visaSetup.upsert({
          where: { groupId: targetGroup.id },
          update: {},
          create: {
            groupId: targetGroup.id,
            syarikah: "Not assigned",
          },
          select: { id: true },
        });
        await tx.visaHotelAgreement.create({
          data: {
            visaSetupId: visaSetup.id,
            sourceDraftId: draft.id,
            city: draft.city,
            hotelName: draft.hotelName,
            agreementNumber: draft.agreementNumber,
            pax: paxToAssign,
            status: draft.status,
            stayStart: toUtcMidnightDate(allocatedStay.stayStart),
            stayEnd: toUtcMidnightDate(allocatedStay.stayEnd),
          },
        });
        return { expired: false as const, draft };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
        throw new ConflictException("Assignment berubah secara bersamaan. Muat ulang dan coba lagi.");
      }
      throw error;
    }

    if (assignmentResult.expired) {
      throw new BadRequestException(
        "Hotel agreement ini telah melewati batas waktu 24 jam. Edit draft untuk mengajukan kembali.",
      );
    }

    const assigned = assignmentResult.draft;
    if (!assigned) {
      throw new NotFoundException(`Draft not found after assignment.`);
    }

    const { remainingPax: updatedRemainingPax, assignedGroups } = await this.getPrismaDraftRemainingAndGroups(assigned);
    return this.mapPrismaDraft(assigned, updatedRemainingPax, assignedGroups);
  }

  async unassign(draftId: string, groupCode?: string): Promise<unknown> {
    const draft = await this.prisma.hotelAgreementDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) {
      throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
    }

    const assignments = await this.prisma.visaHotelAgreement.findMany({
      where: {
        sourceDraftId: draft.id,
        ...(groupCode
          ? {
              visaSetup: {
                group: {
                  code: groupCode.trim().toUpperCase(),
                },
              },
            }
          : {}),
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

    if (assignments.length === 0) {
      throw new NotFoundException(`No assignments found for agreement ${draft.agreementNumber}`);
    }

    for (const assoc of assignments) {
      const gCode = assoc.visaSetup?.group?.code;
      if (!gCode) continue;

      await this.prisma.visaHotelAgreement.delete({ where: { id: assoc.id } });
    }

    const updated = await this.prisma.hotelAgreementDraft.findUnique({
      where: { id: draft.id },
    });
    if (!updated) {
      throw new NotFoundException(`Draft not found after unassignment.`);
    }

    const { remainingPax, assignedGroups } = await this.getPrismaDraftRemainingAndGroups(updated);
    return this.mapPrismaDraft(updated, remainingPax, assignedGroups);
  }
}
