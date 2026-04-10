import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
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
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  avatar!: string;
}

export class CreateNextActivityDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  dateLabel!: string;

  @IsString()
  @IsNotEmpty()
  timeLabel!: string;

  @IsString()
  @IsNotEmpty()
  icon!: string;
}

export class CreateTimelineItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsString()
  @IsNotEmpty()
  dateLabel!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsString()
  nextActivity?: string;
}

export class CreateItineraryItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsString()
  @IsNotEmpty()
  dateLabel!: string;

  @IsString()
  @IsNotEmpty()
  yearLabel!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsOptional()
  @IsString()
  categoryKey?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @IsNotEmpty()
  meta!: string;

  @IsString()
  @IsNotEmpty()
  icon!: string;

  @IsOptional()
  @IsBoolean()
  highlighted?: boolean;

  @IsOptional()
  @IsDateString()
  isoDate?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  flightNumber?: string;

  @IsOptional()
  @IsString()
  hotelName?: string;

  @IsOptional()
  @IsString()
  fromHotelName?: string;

  @IsOptional()
  @IsString()
  fromLocation?: string;

  @IsOptional()
  @IsString()
  toLocation?: string;

  @IsOptional()
  @IsString()
  cityTourCity?: string;

  @IsOptional()
  @IsBoolean()
  requiresBus?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  transferByTrain?: boolean;

  @IsOptional()
  @IsString()
  trainDepartureTime?: string;

  @IsOptional()
  @IsString()
  destinationPickupTime?: string;

  @IsOptional()
  @IsString()
  hotelPickupRequestTime?: string;
}

export class CreateGroupNoteDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class CreateVisaHotelAgreementDto {
  @IsEnum(AgreementCity)
  city!: AgreementCity;

  @IsString()
  @IsNotEmpty()
  hotelName!: string;

  @IsString()
  @IsNotEmpty()
  agreementNumber!: string;

  @IsInt()
  @Min(1)
  pax!: number;

  @IsOptional()
  @IsEnum(AgreementApprovalStatus)
  status?: AgreementApprovalStatus;

  @IsDateString()
  stayStart!: string;

  @IsDateString()
  stayEnd!: string;
}

export class CreateRaudhahAppointmentDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsEnum(GroupRaudhahStatus)
  status?: GroupRaudhahStatus;

  @IsOptional()
  @IsBoolean()
  tasrehPrinted?: boolean;
}

export class CreateVisaSetupDto {
  @IsOptional()
  @IsEnum(VisaStatus)
  visaStatus?: VisaStatus;

  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @IsString()
  @IsNotEmpty()
  syarikah!: string;

  @IsOptional()
  @IsEnum(VisaPaymentStatus)
  paymentStatus?: VisaPaymentStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outstandingAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVisaHotelAgreementDto)
  hotelAgreements?: CreateVisaHotelAgreementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRaudhahAppointmentDto)
  raudhahAppointments?: CreateRaudhahAppointmentDto[];
}

export class CreateChecklistDriverDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  slotNumber?: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  plateNumber!: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

export class CreateChecklistAssignmentDto {
  @IsOptional()
  @IsString()
  itineraryItemId?: string;

  @IsDateString()
  tripDate!: string;

  @IsString()
  @IsNotEmpty()
  activity!: string;

  @IsString()
  @IsNotEmpty()
  tripLabel!: string;

  @IsInt()
  @Min(1)
  requiredBusCount!: number;

  @IsString()
  @IsNotEmpty()
  scheduledTime!: string;

  @IsOptional()
  @IsBoolean()
  transferByTrain?: boolean;

  @IsOptional()
  @IsString()
  trainDepartureTime?: string;

  @IsOptional()
  @IsString()
  stationPickupTime?: string;

  @IsOptional()
  @IsEnum(ChecklistAssignmentStatus)
  status?: ChecklistAssignmentStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistDriverDto)
  drivers?: CreateChecklistDriverDto[];
}

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsDateString()
  arrivalDate!: string;

  @IsDateString()
  returnDate!: string;

  @IsOptional()
  @IsEnum(GroupTone)
  tone?: GroupTone;

  @IsInt()
  @Min(1)
  pax!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalBuses?: number;

  @IsString()
  @IsNotEmpty()
  packageName!: string;

  @IsInt()
  @Min(1)
  @Max(90)
  durationDays!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMusyrifDto)
  musyrif?: CreateMusyrifDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateNextActivityDto)
  nextActivity?: CreateNextActivityDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTimelineItemDto)
  timeline?: CreateTimelineItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateItineraryItemDto)
  itinerary?: CreateItineraryItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGroupNoteDto)
  notes?: CreateGroupNoteDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateVisaSetupDto)
  visaSetup?: CreateVisaSetupDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistAssignmentDto)
  checklistAssignments?: CreateChecklistAssignmentDto[];
}
