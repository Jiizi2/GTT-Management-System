import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupLifecycleStatus,
  GroupTone,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";

export class GroupMusyrifResponseDto {
  @ApiProperty({ example: "Ust. Ahmad Hidayat" })
  name!: string;

  @ApiProperty({ example: "+62 812-3456-7890" })
  phone!: string;

  @ApiProperty({ example: "https://example.com/avatar.jpg" })
  avatar!: string;
}

export class GroupNextActivityResponseDto {
  @ApiProperty({ example: "Arrival and transfer to Makkah hotel" })
  title!: string;

  @ApiProperty({ example: "12 Apr" })
  dateLabel!: string;

  @ApiProperty({ example: "09:30" })
  timeLabel!: string;

  @ApiProperty({ example: "flight_land" })
  icon!: string;
}

export class GroupTimelineItemResponseDto {
  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: "12 Apr" })
  dateLabel!: string;

  @ApiProperty({ example: "Jeddah Arrival" })
  title!: string;

  @ApiProperty({ example: true })
  isCurrent!: boolean;

  @ApiPropertyOptional({ example: "Arrival and transfer to hotel" })
  nextActivity?: string;
}

export class GroupItineraryItemResponseDto {
  @ApiProperty({ example: "clitineraryitemid123" })
  id!: string;

  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: "12 Apr" })
  dateLabel!: string;

  @ApiProperty({ example: "2026" })
  yearLabel!: string;

  @ApiProperty({ example: "Arrival" })
  category!: string;

  @ApiPropertyOptional({ example: "arrival" })
  categoryKey?: string;

  @ApiProperty({ example: "Arrival and transfer to Makkah hotel" })
  title!: string;

  @ApiProperty({ example: "09:30 | SV-827 | JED Airport" })
  meta!: string;

  @ApiProperty({ example: "flight_land" })
  icon!: string;

  @ApiProperty({ example: true })
  highlighted!: boolean;

  @ApiPropertyOptional({ example: "2026-04-12" })
  isoDate?: string;

  @ApiPropertyOptional({ example: "09:30" })
  time?: string;

  @ApiPropertyOptional({ example: "SV-827" })
  flightNumber?: string;

  @ApiPropertyOptional({ example: "Swissotel Al Maqam" })
  hotelName?: string;

  @ApiPropertyOptional({ example: "Hotel Transit Makkah" })
  fromHotelName?: string;

  @ApiPropertyOptional({ example: "JED Airport" })
  fromLocation?: string;

  @ApiPropertyOptional({ example: "Makkah Hotel" })
  toLocation?: string;

  @ApiPropertyOptional({ example: "Madinah" })
  cityTourCity?: string;

  @ApiProperty({ example: true })
  requiresBus!: boolean;

  @ApiPropertyOptional({ example: "Driver standby di gate 4." })
  notes?: string;

  @ApiProperty({ example: false })
  transferByTrain!: boolean;

  @ApiPropertyOptional({ example: "10:20" })
  trainDepartureTime?: string;

  @ApiPropertyOptional({ example: "12:05" })
  destinationPickupTime?: string;

  @ApiPropertyOptional({ example: "18:30" })
  hotelPickupRequestTime?: string;
}

export class GroupNoteResponseDto {
  @ApiProperty({ example: 0 })
  sortOrder!: number;

  @ApiProperty({ example: "Bus status: Visa+." })
  text!: string;

  @ApiProperty({ example: true })
  pinned!: boolean;
}

export class GroupVisaHotelAgreementResponseDto {
  @ApiProperty({ example: "clhotelagreementid123" })
  id!: string;

  @ApiPropertyOptional({ example: "cldraftagreementid123" })
  sourceDraftId?: string | null;

  @ApiProperty({ enum: AgreementCity, example: AgreementCity.MAKKAH })
  city!: AgreementCity;

  @ApiProperty({ example: "Swissotel Al Maqam" })
  hotelName!: string;

  @ApiProperty({ example: "20269017001001" })
  agreementNumber!: string;

  @ApiProperty({ example: 45 })
  pax!: number;

  @ApiProperty({
    enum: AgreementApprovalStatus,
    example: AgreementApprovalStatus.APPROVED,
  })
  status!: AgreementApprovalStatus;

  @ApiProperty({ example: "2026-04-12" })
  stayStart!: string;

  @ApiProperty({ example: "2026-04-15" })
  stayEnd!: string;
}

export class GroupRaudhahAppointmentResponseDto {
  @ApiProperty({ example: "clraudhahid123" })
  id!: string;

  @ApiProperty({ example: "2026-04-16" })
  date!: string;

  @ApiProperty({
    enum: GroupRaudhahStatus,
    example: GroupRaudhahStatus.AFTER,
  })
  status!: GroupRaudhahStatus;

  @ApiProperty({ example: false })
  tasrehPrinted!: boolean;
}

export class GroupVisaSetupResponseDto {
  @ApiProperty({ enum: VisaStatus, example: VisaStatus.PENDING })
  visaStatus!: VisaStatus;

  @ApiPropertyOptional({ example: "2026-04-10" })
  issuedDate?: string;

  @ApiProperty({ example: "Nusuk Premium" })
  syarikah!: string;

  @ApiProperty({
    enum: VisaPaymentStatus,
    example: VisaPaymentStatus.PARTIAL,
  })
  paymentStatus!: VisaPaymentStatus;

  @ApiProperty({ example: 1500 })
  outstandingAmount!: number;

  @ApiProperty({ type: () => GroupVisaHotelAgreementResponseDto, isArray: true })
  hotelAgreements!: GroupVisaHotelAgreementResponseDto[];

  @ApiProperty({ type: () => GroupRaudhahAppointmentResponseDto, isArray: true })
  raudhahAppointments!: GroupRaudhahAppointmentResponseDto[];
}

export class GroupChecklistDriverResponseDto {
  @ApiProperty({ example: 1 })
  slotNumber!: number;

  @ApiProperty({ example: "Driver Yusuf" })
  name!: string;

  @ApiProperty({ example: "+966 50 111 2222" })
  phone!: string;

  @ApiProperty({ example: "B 1234 ABC" })
  plateNumber!: string;

  @ApiProperty({ example: true })
  isVerified!: boolean;
}

export class GroupChecklistAssignmentResponseDto {
  @ApiProperty({ example: "clchecklistassignmentid123" })
  id!: string;

  @ApiPropertyOptional({ example: "clitineraryitemid123", nullable: true })
  itineraryItemId?: string | null;

  @ApiProperty({ example: "2026-04-12" })
  tripDate!: string;

  @ApiProperty({ example: "Arrival" })
  activity!: string;

  @ApiProperty({ example: "Arrival and transfer to hotel" })
  tripLabel!: string;

  @ApiProperty({ example: 2 })
  requiredBusCount!: number;

  @ApiProperty({ example: "09:30" })
  scheduledTime!: string;

  @ApiProperty({ example: false })
  transferByTrain!: boolean;

  @ApiPropertyOptional({ example: "10:20" })
  trainDepartureTime?: string;

  @ApiPropertyOptional({ example: "12:05" })
  stationPickupTime?: string;

  @ApiProperty({
    enum: ChecklistAssignmentStatus,
    example: ChecklistAssignmentStatus.ASSIGNED,
  })
  status!: ChecklistAssignmentStatus;

  @ApiProperty({ type: () => GroupChecklistDriverResponseDto, isArray: true })
  drivers!: GroupChecklistDriverResponseDto[];
}

export class GroupSummaryResponseDto {
  @ApiProperty({ example: "clgroupid123" })
  id!: string;

  @ApiProperty({ example: "9017001001" })
  code!: string;

  @ApiProperty({ example: "Sample Umrah Group" })
  name!: string;

  @ApiProperty({ example: "Active" })
  status!: string;

  @ApiProperty({ enum: GroupLifecycleStatus, example: GroupLifecycleStatus.ACTIVE })
  lifecycleStatus!: GroupLifecycleStatus;

  @ApiProperty({ enum: GroupTone, example: GroupTone.ACTIVE })
  tone!: GroupTone;

  @ApiProperty({ example: "2026-04-12" })
  arrivalDate!: string;

  @ApiProperty({ example: "2026-04-20" })
  returnDate!: string;

  @ApiProperty({ example: 45 })
  pax!: number;

  @ApiPropertyOptional({ example: 2, nullable: true })
  totalBuses?: number | null;

  @ApiProperty({ example: "Umrah Plus" })
  packageName!: string;

  @ApiProperty({ example: 9 })
  durationDays!: number;

  @ApiPropertyOptional({ type: () => GroupNextActivityResponseDto, nullable: true })
  nextActivity?: GroupNextActivityResponseDto | null;

  @ApiProperty({ type: () => GroupItineraryItemResponseDto, isArray: true })
  itinerary!: GroupItineraryItemResponseDto[];

  @ApiProperty({ type: () => GroupNoteResponseDto, isArray: true })
  notes!: GroupNoteResponseDto[];

  @ApiPropertyOptional({ example: "2026-04-12T13:30:00.000Z" })
  createdAt?: string;

  @ApiPropertyOptional({ example: "2026-04-12T13:40:00.000Z" })
  updatedAt?: string;
}

export class GroupDetailResponseDto extends GroupSummaryResponseDto {
  @ApiPropertyOptional({ type: () => GroupMusyrifResponseDto, nullable: true })
  musyrif?: GroupMusyrifResponseDto | null;

  @ApiProperty({ type: () => GroupTimelineItemResponseDto, isArray: true })
  timeline!: GroupTimelineItemResponseDto[];

  @ApiPropertyOptional({ type: () => GroupVisaSetupResponseDto, nullable: true })
  visaSetup?: GroupVisaSetupResponseDto | null;

  @ApiProperty({ type: () => GroupChecklistAssignmentResponseDto, isArray: true })
  checklistAssignments!: GroupChecklistAssignmentResponseDto[];
}

export class PaginatedGroupSummaryResponseDto {
  @ApiProperty({ type: () => GroupSummaryResponseDto, isArray: true })
  items!: GroupSummaryResponseDto[];

  @ApiProperty({ example: 24 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

export class PaginatedGroupDetailResponseDto {
  @ApiProperty({ type: () => GroupDetailResponseDto, isArray: true })
  items!: GroupDetailResponseDto[];

  @ApiProperty({ example: 24 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;
}

export class ChecklistAssignmentSyncResponseDto {
  @ApiProperty({ example: "clchecklistassignmentid123" })
  id!: string;

  @ApiProperty({ example: "9017001001" })
  groupCode!: string;

  @ApiProperty({ example: "2026-04-12" })
  tripDate!: string;

  @ApiProperty({ example: "Arrival" })
  activity!: string;

  @ApiProperty({ example: "Arrival and transfer to hotel" })
  tripLabel!: string;

  @ApiProperty({ example: 2 })
  requiredBusCount!: number;

  @ApiProperty({ example: "09:30" })
  scheduledTime!: string;

  @ApiProperty({ example: false })
  transferByTrain!: boolean;

  @ApiPropertyOptional({ example: "10:20" })
  trainDepartureTime?: string;

  @ApiPropertyOptional({ example: "12:05" })
  stationPickupTime?: string;

  @ApiProperty({
    enum: ChecklistAssignmentStatus,
    example: ChecklistAssignmentStatus.ASSIGNED,
  })
  status!: ChecklistAssignmentStatus;

  @ApiProperty({ type: () => GroupChecklistDriverResponseDto, isArray: true })
  drivers!: GroupChecklistDriverResponseDto[];
}

export class GroupAuditLogResponseDto {
  @ApiProperty({ example: "clauditlogid123" })
  id!: string;

  @ApiProperty({ example: "group.updated" })
  action!: string;

  @ApiProperty({ example: "group" })
  entity!: string;

  @ApiPropertyOptional({ example: "9017001001" })
  groupCode?: string;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    example: {
      after: {
        status: "Active",
      },
    },
  })
  payload!: Record<string, unknown>;

  @ApiProperty({ example: "2026-04-12T13:30:00.000Z" })
  createdAt!: string;
}
