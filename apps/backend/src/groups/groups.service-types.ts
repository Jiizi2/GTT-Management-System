import {
  AgreementApprovalStatus,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { CreateGroupDto } from "./dto/create-group.dto";
import {
  groupDetailSelection,
  groupSummarySelection,
} from "../infrastructure/repositories/prisma/helpers/prisma-group.helpers";

export type MemoryItineraryItem = Omit<
  NonNullable<CreateGroupDto["itinerary"]>[number],
  "sortOrder" | "title"
> & {
  id: string;
  sortOrder: number;
  title: string;
};

export type MemoryVisaHotelAgreement = Omit<
  NonNullable<NonNullable<CreateGroupDto["visaSetup"]>["hotelAgreements"]>[number],
  "status"
> & {
  id: string;
  status: AgreementApprovalStatus;
};

export type MemoryRaudhahAppointment = Omit<
  NonNullable<NonNullable<CreateGroupDto["visaSetup"]>["raudhahAppointments"]>[number],
  "status"
> & {
  id: string;
  status: GroupRaudhahStatus;
  tasrehPrinted: boolean;
};

export type MemoryChecklistDriver = Omit<
  NonNullable<NonNullable<CreateGroupDto["checklistAssignments"]>[number]["drivers"]>[number],
  "slotNumber"
> & {
  slotNumber: number;
};

export type MemoryChecklistAssignment = Omit<
  NonNullable<CreateGroupDto["checklistAssignments"]>[number],
  "drivers"
> & {
  id: string;
  drivers: MemoryChecklistDriver[];
};

export type MemoryVisaSetup = Omit<
  NonNullable<CreateGroupDto["visaSetup"]>,
  "hotelAgreements" | "raudhahAppointments"
> & {
  hotelAgreements: MemoryVisaHotelAgreement[];
  raudhahAppointments: MemoryRaudhahAppointment[];
};

export type MemoryGroupRecord = Omit<
  CreateGroupDto,
  "tone" | "totalBuses" | "itinerary" | "visaSetup" | "checklistAssignments" | "parentGroupId"
> & {
  id: string;
  tone: GroupTone;
  totalBuses: number | null;
  itinerary: MemoryItineraryItem[];
  visaSetup?: MemoryVisaSetup;
  checklistAssignments: MemoryChecklistAssignment[];
  parentGroupId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemoryGroupSummaryRecord = Omit<
  MemoryGroupRecord,
  "musyrif" | "timeline" | "checklistAssignments"
>;

export type PrismaGroupSummaryRecord = Prisma.GroupGetPayload<{
  select: typeof groupSummarySelection;
}>;

export type PrismaGroupDetailRecord = Prisma.GroupGetPayload<{
  select: typeof groupDetailSelection;
}>;

export type GroupSummaryRecord = PrismaGroupSummaryRecord | MemoryGroupSummaryRecord;
export type GroupDetailRecord = PrismaGroupDetailRecord | MemoryGroupRecord;
export type GroupRecord = GroupSummaryRecord | GroupDetailRecord;

export type ChecklistAssignmentSyncResult = {
  id: string;
  groupCode: string;
  tripDate: string;
  activity: string;
  tripLabel: string;
  requiredBusCount: number;
  scheduledTime: string;
  transferByTrain: boolean;
  trainDepartureTime?: string;
  stationPickupTime?: string;
  status: ChecklistAssignmentStatus;
  drivers: Array<{
    slotNumber: number;
    name: string;
    phone: string;
    plateNumber: string;
    isVerified: boolean;
  }>;
};

export type MemoryAuditLog = {
  id: string;
  action: string;
  entity: string;
  groupCode?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type GroupListFilter = "all" | "not-issued" | "missing-hotel" | "unpaid";
export type GroupResponseProjection = "summary" | "detail";

export type FindAllOptions = {
  page?: number;
  pageSize?: number;
  filter?: string;
  activeOnly?: boolean;
  projection?: GroupResponseProjection;
  agentId?: string;
};

export type PaginatedGroupList<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type GroupListResult<T extends GroupRecord = GroupRecord> =
  | T[]
  | PaginatedGroupList<T>;

export const DAY_IN_MS = 24 * 60 * 60 * 1000;
