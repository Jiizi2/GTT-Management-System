import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupLifecycleStatus,
  GroupTone,
  VisaBusStatus,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateMusyrifDto {
  @ApiProperty({ example: "Ust. Ahmad Hidayat" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "+62 812-3456-7890" })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: "https://example.com/avatar.jpg" })
  @IsString()
  @IsNotEmpty()
  avatar!: string;
}

export class CreateNextActivityDto {
  @ApiProperty({ example: "Arrival and transfer to Makkah hotel" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: "12 Apr" })
  @IsString()
  @IsNotEmpty()
  dateLabel!: string;

  @ApiProperty({ example: "09:30" })
  @IsString()
  @IsNotEmpty()
  timeLabel!: string;

  @ApiProperty({ example: "flight_land" })
  @IsString()
  @IsNotEmpty()
  icon!: string;
}

export class CreateTimelineItemDto {
  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ example: "12 Apr" })
  @IsString()
  @IsNotEmpty()
  dateLabel!: string;

  @ApiProperty({ example: "Jeddah Arrival" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @ApiPropertyOptional({ example: "Arrival and transfer to hotel" })
  @IsOptional()
  @IsString()
  nextActivity?: string;
}

export class CreateItineraryItemDto {
  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ example: "12 Apr" })
  @IsString()
  @IsNotEmpty()
  dateLabel!: string;

  @ApiProperty({ example: "2026" })
  @IsString()
  @IsNotEmpty()
  yearLabel!: string;

  @ApiProperty({ example: "Arrival" })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiPropertyOptional({ example: "arrival" })
  @IsOptional()
  @IsString()
  categoryKey?: string;

  @ApiPropertyOptional({ example: "Landing at JED and heading to Makkah" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: "09:30 | SV-827 | JED Airport" })
  @IsString()
  @IsNotEmpty()
  meta!: string;

  @ApiProperty({ example: "flight_land" })
  @IsString()
  @IsNotEmpty()
  icon!: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  highlighted?: boolean;

  @ApiPropertyOptional({ example: "2026-04-12" })
  @IsOptional()
  @IsDateString()
  isoDate?: string;

  @ApiPropertyOptional({ example: "09:30" })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({ example: "SV-827" })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiPropertyOptional({ example: "Swissotel Al Maqam" })
  @IsOptional()
  @IsString()
  hotelName?: string;

  @ApiPropertyOptional({ example: "Hotel Transit Makkah" })
  @IsOptional()
  @IsString()
  fromHotelName?: string;

  @ApiPropertyOptional({ example: "JED Airport" })
  @IsOptional()
  @IsString()
  fromLocation?: string;

  @ApiPropertyOptional({ example: "Makkah Hotel" })
  @IsOptional()
  @IsString()
  toLocation?: string;

  @ApiPropertyOptional({ example: "Madinah" })
  @IsOptional()
  @IsString()
  cityTourCity?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  requiresBus?: boolean;

  @ApiPropertyOptional({ example: "Driver standby di gate 4." })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  transferByTrain?: boolean;

  @ApiPropertyOptional({ example: "10:20" })
  @IsOptional()
  @IsString()
  trainDepartureTime?: string;

  @ApiPropertyOptional({ example: "12:05" })
  @IsOptional()
  @IsString()
  destinationPickupTime?: string;

  @ApiPropertyOptional({ example: "18:30" })
  @IsOptional()
  @IsString()
  hotelPickupRequestTime?: string;
}

export class CreateGroupNoteDto {
  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ example: "Bus status: Visa+." })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class CreateVisaHotelAgreementDto {
  @ApiProperty({ enum: AgreementCity, example: AgreementCity.MAKKAH })
  @IsEnum(AgreementCity)
  city!: AgreementCity;

  @ApiPropertyOptional({ example: "cldraftagreementid123" })
  @IsOptional()
  @IsString()
  sourceDraftId?: string;

  @ApiProperty({ example: "Swissotel Al Maqam" })
  @IsString()
  @IsNotEmpty()
  hotelName!: string;

  @ApiProperty({ example: "20269017001001" })
  @IsString()
  @IsNotEmpty()
  agreementNumber!: string;

  @ApiProperty({ example: 45, minimum: 1 })
  @IsInt()
  @Min(1)
  pax!: number;

  @ApiPropertyOptional({
    enum: AgreementApprovalStatus,
    example: AgreementApprovalStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(AgreementApprovalStatus)
  status?: AgreementApprovalStatus;

  @ApiProperty({ example: "2026-04-12" })
  @IsDateString()
  stayStart!: string;

  @ApiProperty({ example: "2026-04-15" })
  @IsDateString()
  stayEnd!: string;
}

export class CreateRaudhahAppointmentDto {
  @ApiProperty({ example: "2026-04-16" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    enum: GroupRaudhahStatus,
    example: GroupRaudhahStatus.AFTER,
  })
  @IsOptional()
  @IsEnum(GroupRaudhahStatus)
  status?: GroupRaudhahStatus;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  tasrehPrinted?: boolean;
}

export class CreateVisaSetupDto {
  @ApiPropertyOptional({ enum: VisaStatus, example: VisaStatus.PENDING })
  @IsOptional()
  @IsEnum(VisaStatus)
  visaStatus?: VisaStatus;

  @ApiPropertyOptional({ example: "2026-04-10" })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @ApiProperty({ example: "Nusuk Premium" })
  @IsString()
  @IsNotEmpty()
  syarikah!: string;

  @ApiPropertyOptional({ enum: VisaBusStatus, example: VisaBusStatus.VISA_ONLY })
  @IsOptional()
  @IsEnum(VisaBusStatus)
  busStatus?: VisaBusStatus;

  @ApiPropertyOptional({
    enum: VisaPaymentStatus,
    example: VisaPaymentStatus.PARTIAL,
  })
  @IsOptional()
  @IsEnum(VisaPaymentStatus)
  paymentStatus?: VisaPaymentStatus;

  @ApiPropertyOptional({
    type: () => CreateVisaHotelAgreementDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVisaHotelAgreementDto)
  hotelAgreements?: CreateVisaHotelAgreementDto[];

  @ApiPropertyOptional({
    type: () => CreateRaudhahAppointmentDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRaudhahAppointmentDto)
  raudhahAppointments?: CreateRaudhahAppointmentDto[];
}

export class CreateChecklistDriverDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  slotNumber?: number;

  @ApiProperty({ example: "Driver Yusuf" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "+966 50 111 2222" })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: "B 1234 ABC" })
  @IsString()
  @IsNotEmpty()
  plateNumber!: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

export class CreateChecklistAssignmentDto {
  @ApiPropertyOptional({ example: "clitineraryitemid" })
  @IsOptional()
  @IsString()
  itineraryItemId?: string;

  @ApiProperty({ example: "2026-04-12" })
  @IsDateString()
  tripDate!: string;

  @ApiProperty({ example: "Arrival" })
  @IsString()
  @IsNotEmpty()
  activity!: string;

  @ApiProperty({ example: "Arrival and transfer to hotel" })
  @IsString()
  @IsNotEmpty()
  tripLabel!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  requiredBusCount!: number;

  @ApiProperty({ example: "09:30" })
  @IsString()
  @IsNotEmpty()
  scheduledTime!: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  transferByTrain?: boolean;

  @ApiPropertyOptional({ example: "10:20" })
  @IsOptional()
  @IsString()
  trainDepartureTime?: string;

  @ApiPropertyOptional({ example: "12:05" })
  @IsOptional()
  @IsString()
  stationPickupTime?: string;

  @ApiPropertyOptional({
    enum: ChecklistAssignmentStatus,
    example: ChecklistAssignmentStatus.NOT_COMPLETE,
  })
  @IsOptional()
  @IsEnum(ChecklistAssignmentStatus)
  status?: ChecklistAssignmentStatus;

  @ApiPropertyOptional({
    type: () => CreateChecklistDriverDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistDriverDto)
  drivers?: CreateChecklistDriverDto[];
}

export class CreateGroupDto {
  @ApiProperty({ example: "agent_gtt_direct" })
  @IsString()
  @IsNotEmpty()
  agentId?: string;

  @ApiProperty({ example: "9017001001" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: "Sample Umrah Group" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "Active" })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiPropertyOptional({ enum: GroupLifecycleStatus, example: GroupLifecycleStatus.ACTIVE })
  @IsOptional()
  @IsEnum(GroupLifecycleStatus)
  lifecycleStatus?: GroupLifecycleStatus;

  @ApiProperty({ example: "2026-04-12" })
  @IsDateString()
  arrivalDate!: string;

  @ApiProperty({ example: "2026-04-20" })
  @IsDateString()
  returnDate!: string;

  @ApiPropertyOptional({ enum: GroupTone, example: GroupTone.ACTIVE })
  @IsOptional()
  @IsEnum(GroupTone)
  tone?: GroupTone;

  @ApiProperty({ example: 45, minimum: 1 })
  @IsInt()
  @Min(1)
  pax!: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalBuses?: number;

  @ApiProperty({ example: "Umrah Plus" })
  @IsString()
  @IsNotEmpty()
  packageName!: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 90 })
  @IsInt()
  @Min(1)
  @Max(90)
  durationDays!: number;

  @ApiPropertyOptional({ example: "cldraftparentid123" })
  @IsOptional()
  @IsString()
  parentGroupId?: string | null;

  @ApiPropertyOptional({ type: () => CreateMusyrifDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMusyrifDto)
  musyrif?: CreateMusyrifDto;

  @ApiPropertyOptional({ type: () => CreateNextActivityDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNextActivityDto)
  nextActivity?: CreateNextActivityDto;

  @ApiPropertyOptional({
    type: () => CreateTimelineItemDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTimelineItemDto)
  timeline?: CreateTimelineItemDto[];

  @ApiPropertyOptional({
    type: () => CreateItineraryItemDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItineraryItemDto)
  itinerary?: CreateItineraryItemDto[];

  @ApiPropertyOptional({
    type: () => CreateGroupNoteDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGroupNoteDto)
  notes?: CreateGroupNoteDto[];

  @ApiPropertyOptional({ type: () => CreateVisaSetupDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateVisaSetupDto)
  visaSetup?: CreateVisaSetupDto;

  @ApiPropertyOptional({
    type: () => CreateChecklistAssignmentDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistAssignmentDto)
  checklistAssignments?: CreateChecklistAssignmentDto[];
}
