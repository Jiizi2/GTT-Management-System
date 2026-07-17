import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { AgreementApprovalStatus, Prisma } from "@prisma/client";
import { GroupsService } from "../../../groups/application/groups.service";
import { HotelAgreementDraftRepository } from "../../../domain/repositories/hotel-agreement-draft.repository";
import {
  UpsertHotelAgreementDraftDto,
  AssignHotelAgreementDraftDto,
} from "../../../groups/dto/hotel-agreement-draft.dto";
import { toIsoDateOnly, isIsoDateOnly } from "../../../utils/date-helpers";
import { randomUUID } from "node:crypto";

type DraftStatusFilter = "assigned" | "unassigned";

type MemoryHotelAgreementDraft = {
  id: string;
  city: UpsertHotelAgreementDraftDto["city"];
  agentName?: string;
  agentId: string;
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

function readText(val: any): string {
  if (typeof val === "string") return val;
  return String(val ?? "");
}

function readNumber(val: any): number | null {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const num = Number(val);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function doesHotelSnapshotMatchDraftIgnoringPax(
  h: GroupHotelAgreementSnapshot,
  draft: Pick<MemoryHotelAgreementDraft, "id" | "agreementNumber" | "city" | "hotelName">,
): boolean {
  const sourceDraftId = readText(h.sourceDraftId);
  if (sourceDraftId && sourceDraftId === draft.id) {
    return true;
  }

  const numberMatch =
    readText(h.agreementNumber).trim().toUpperCase() ===
    draft.agreementNumber.trim().toUpperCase();
  const cityMatch =
    readText(h.city).trim().toLowerCase() === draft.city.trim().toLowerCase();

  return numberMatch && cityMatch;
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
export class MemoryHotelAgreementDraftRepository implements HotelAgreementDraftRepository {
  public readonly memoryDrafts: MemoryHotelAgreementDraft[] = [];

  constructor(private readonly groupsService: GroupsService) {}

  private normalizeStatusFilter(rawStatus?: string): DraftStatusFilter | undefined {
    if (!rawStatus) return undefined;
    const trimmed = rawStatus.trim().toLowerCase();
    return trimmed === "assigned" || trimmed === "unassigned" ? (trimmed as DraftStatusFilter) : undefined;
  }

  private normalizePayload(payload: UpsertHotelAgreementDraftDto) {
    const stayStart = toIsoDateOnly(payload.stayStart);
    const stayEnd = toIsoDateOnly(payload.stayEnd);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(stayStart) || !/^\d{4}-\d{2}-\d{2}$/.test(stayEnd)) {
      throw new BadRequestException("Agreement stay dates must use YYYY-MM-DD format.");
    }
    if (stayEnd < stayStart) {
      throw new BadRequestException("Agreement stay end date must be on or after the start date.");
    }

    return {
      city: payload.city,
      agentId: payload.agentId?.trim() || "agent_gtt_direct",
      agentName: payload.agentId === "agent_gtt_direct" || !payload.agentId ? "GTT Direct" : undefined,
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
      throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
    }
    return draft;
  }

  private toGroupHotelPayload(draft: any, sourceDraftId: string) {
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

  private async getMemoryDraftRemainingAndGroups(
    draft: MemoryHotelAgreementDraft,
  ): Promise<{ remainingPax: number; assignedGroups: Array<{ groupCode: string; pax: number }> }> {
    const groups = (await this.groupsService.findAll()) as any[];
    const assignedAgreements: Array<{ groupCode: string; pax: number; stayStart: string; stayEnd: string }> = [];
    
    for (const g of groups) {
      const code = g.code;
      if (!code) continue;
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      for (const h of agreements) {
        if (doesHotelSnapshotMatchDraftIgnoringPax(h, draft)) {
          const pax = readNumber(h.pax) ?? 0;
          assignedAgreements.push({
            groupCode: code,
            pax,
            stayStart: toIsoDateOnly(readText(h.stayStart)),
            stayEnd: toIsoDateOnly(readText(h.stayEnd)),
          });
        }
      }
    }

    const draftNights = getStayNights(draft.stayStart, draft.stayEnd);
    let maxOccupied = 0;
    for (const night of draftNights) {
      const occupiedOnNight = assignedAgreements
        .filter((a) => night >= a.stayStart && night < a.stayEnd)
        .reduce((sum, a) => sum + a.pax, 0);
      if (occupiedOnNight > maxOccupied) {
        maxOccupied = occupiedOnNight;
      }
    }

    const remainingPax = Math.max(0, draft.pax - maxOccupied);
    return {
      remainingPax,
      assignedGroups: assignedAgreements.map((a) => ({ groupCode: a.groupCode, pax: a.pax })),
    };
  }

  async findAll(query?: string, rawStatus?: string, agentId?: string): Promise<unknown[]> {
    const status = this.normalizeStatusFilter(rawStatus);
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const draft of this.memoryDrafts) {
      if (draft.status === AgreementApprovalStatus.WAITING && new Date(draft.updatedAt).getTime() < cutoffMs) {
        draft.status = AgreementApprovalStatus.REJECTED;
      }
    }

    const groups = (await this.groupsService.findAll()) as any[];
    const assignedPaxMap = new Map<string, number>();
    const assignedGroupsMap = new Map<string, Array<{ groupCode: string; pax: number }>>();

    for (const g of groups) {
      const code = g.code;
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
        if (agentId && draft.agentId !== agentId) return false;
        if (status === "assigned" && !draft.groupCode) {
          // In memory, draft.groupCode might be checked or we check assignedGroupsMap
          const key = `${draft.city.toUpperCase()}_${draft.agreementNumber.trim().toUpperCase()}`;
          const isAssigned = (assignedGroupsMap.get(key) ?? []).length > 0;
          if (!isAssigned) return false;
        }
        if (status === "unassigned") {
          const key = `${draft.city.toUpperCase()}_${draft.agreementNumber.trim().toUpperCase()}`;
          const isAssigned = (assignedGroupsMap.get(key) ?? []).length > 0;
          if (isAssigned) return false;
        }
        if (!normalizedQuery) {
          return true;
        }

        const key = `${draft.city.toUpperCase()}_${draft.agreementNumber.trim().toUpperCase()}`;
        const assigned = assignedGroupsMap.get(key) ?? [];
        const matchGroup = assigned.some((a) => a.groupCode.toLowerCase().includes(normalizedQuery));

        return [
          draft.agreementNumber,
          draft.agentName ?? "",
          draft.hotelName,
          draft.notes ?? "",
        ].some((value) => value.toLowerCase().includes(normalizedQuery)) || matchGroup;
      })
      .map((draft) => {
        const key = `${draft.city.toUpperCase()}_${draft.agreementNumber.trim().toUpperCase()}`;
        const assignedPax = assignedPaxMap.get(key) ?? 0;
        const remainingPax = Math.max(0, draft.pax - assignedPax);
        const assignedGroups = assignedGroupsMap.get(key) ?? [];
        return this.mapMemoryDraft(draft, remainingPax, assignedGroups);
      });
  }

  async create(payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    const normalizedPayload = this.normalizePayload(payload);
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

  async update(draftId: string, payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    const normalizedPayload = this.normalizePayload(payload);
    const draftIndex = this.memoryDrafts.findIndex((item) => item.id === draftId);
    if (draftIndex === -1) {
      throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
    }

    const draft = this.memoryDrafts[draftIndex];
    const updatedDraft: MemoryHotelAgreementDraft = {
      ...draft,
      ...normalizedPayload,
      updatedAt: new Date().toISOString(),
    };

    // Cascade update to linked group visa agreements in memory
    const groups = (await this.groupsService.findAll()) as any[];
    for (const g of groups) {
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      const matchedAgreement = agreements.find((h: any) =>
        doesHotelSnapshotMatchDraftIgnoringPax(h, draft),
      );

      if (matchedAgreement) {
        const nextAgreement = {
          city: normalizedPayload.city,
          hotelName: normalizedPayload.hotelName,
          agreementNumber: normalizedPayload.agreementNumber,
          status: normalizedPayload.status,
          stayStart: normalizedPayload.stayStart,
          stayEnd: normalizedPayload.stayEnd,
          pax: matchedAgreement.pax,
        };
        await this.groupsService.updateVisaHotelAgreement(g.code, matchedAgreement.id, nextAgreement);
      }
    }

    this.memoryDrafts[draftIndex] = updatedDraft;
    const { remainingPax, assignedGroups } = await this.getMemoryDraftRemainingAndGroups(updatedDraft);
    return this.mapMemoryDraft(updatedDraft, remainingPax, assignedGroups);
  }

  async remove(draftId: string): Promise<void> {
    const draftIndex = this.memoryDrafts.findIndex((item) => item.id === draftId);
    if (draftIndex === -1) {
      throw new NotFoundException(`Hotel agreement draft '${draftId}' not found.`);
    }

    this.memoryDrafts.splice(draftIndex, 1);
  }

  async assign(draftId: string, payload: AssignHotelAgreementDraftDto): Promise<unknown> {
    const normalizedGroupCode = payload.groupCode.trim().toUpperCase();
    if (!normalizedGroupCode) {
      throw new BadRequestException("Group code is required.");
    }

    const draft = this.resolveMemoryDraft(draftId);

    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    if (draft.status === AgreementApprovalStatus.WAITING && new Date(draft.updatedAt).getTime() < cutoffMs) {
      draft.status = AgreementApprovalStatus.REJECTED;
    }

    if (draft.status === AgreementApprovalStatus.REJECTED) {
      throw new BadRequestException(
        "Hotel agreement ini berstatus ditolak (Rejected). Silakan edit nomor agreement untuk mengajukan kembali.",
      );
    }

    const targetGroup = (await this.groupsService.findOneByIdOrCode(normalizedGroupCode)) as any;
    if (!targetGroup) {
      throw new NotFoundException(`Group '${normalizedGroupCode}' not found.`);
    }
    if (targetGroup.agentId !== draft.agentId) {
      throw new BadRequestException("Hotel agreement dan Group harus berasal dari Agent yang sama.");
    }

    const customStart = payload.stayStart ? toIsoDateOnly(payload.stayStart) : undefined;
    const customEnd = payload.stayEnd ? toIsoDateOnly(payload.stayEnd) : undefined;

    const existingAgreements = targetGroup.visaSetup?.hotelAgreements ?? [];
    const allocatedStay = (customStart && customEnd)
      ? { stayStart: customStart, stayEnd: customEnd }
      : calculateAllocatedStayDates(
          { arrivalDate: targetGroup.arrivalDate, returnDate: targetGroup.returnDate },
          draft,
          existingAgreements.map((a: any) => ({ stayStart: readText(a.stayStart), stayEnd: readText(a.stayEnd) })),
        );

    const groups = (await this.groupsService.findAll()) as any[];
    const assignedAgreements: Array<{ pax: number; stayStart: string; stayEnd: string }> = [];
    for (const g of groups) {
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      for (const h of agreements) {
        if (doesHotelSnapshotMatchDraftIgnoringPax(h, draft)) {
          assignedAgreements.push({
            pax: readNumber(h.pax) ?? 0,
            stayStart: toIsoDateOnly(readText(h.stayStart)),
            stayEnd: toIsoDateOnly(readText(h.stayEnd)),
          });
        }
      }
    }

    const allocatedNights = getStayNights(allocatedStay.stayStart, allocatedStay.stayEnd);
    let minRemaining = draft.pax;
    for (const night of allocatedNights) {
      const occupiedOnNight = assignedAgreements
        .filter((a) => night >= a.stayStart && night < a.stayEnd)
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

    const alreadyAssignedToTarget = existingAgreements.some((h: any) =>
      doesHotelSnapshotMatchDraftIgnoringPax(h, draft),
    );
    if (alreadyAssignedToTarget) {
      throw new ConflictException(`Agreement ${draft.agreementNumber} is already assigned to group '${targetGroup.code}'.`);
    }

    const paxToAssign = Math.min(targetGroup.pax, minRemaining);

    const groupHotelPayload = {
      ...this.toGroupHotelPayload(draft, draft.id),
      pax: paxToAssign,
      stayStart: allocatedStay.stayStart,
      stayEnd: allocatedStay.stayEnd,
    };

    await this.groupsService.addVisaHotelAgreement(normalizedGroupCode, groupHotelPayload);

    draft.updatedAt = new Date().toISOString();
    const updated = this.resolveMemoryDraft(draft.id);
    const { remainingPax: updatedRemaining, assignedGroups: updatedGroups } = await this.getMemoryDraftRemainingAndGroups(updated);
    return this.mapMemoryDraft(updated, updatedRemaining, updatedGroups);
  }

  async unassign(draftId: string, groupCode?: string): Promise<unknown> {
    const draft = this.resolveMemoryDraft(draftId);
    const groups = (await this.groupsService.findAll()) as any[];
    const targetGroups = groupCode
      ? groups.filter((g) => g.code.trim().toUpperCase() === groupCode.trim().toUpperCase())
      : groups;

    let unassignedAny = false;

    for (const g of targetGroups) {
      const agreements = g.visaSetup?.hotelAgreements ?? [];
      const matchedAgreement = agreements.find((a: any) =>
        doesHotelSnapshotMatchDraftIgnoringPax(a, draft),
      );

      if (matchedAgreement) {
        await this.groupsService.removeVisaHotelAgreement(g.code, matchedAgreement.id);
        unassignedAny = true;
      }
    }

    if (!unassignedAny) {
      throw new NotFoundException(`No assignments found for agreement ${draft.agreementNumber}`);
    }

    draft.updatedAt = new Date().toISOString();
    const updated = this.resolveMemoryDraft(draft.id);
    const { remainingPax, assignedGroups } = await this.getMemoryDraftRemainingAndGroups(updated);
    return this.mapMemoryDraft(updated, remainingPax, assignedGroups);
  }
}
