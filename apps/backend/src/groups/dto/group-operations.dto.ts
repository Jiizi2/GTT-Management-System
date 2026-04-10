import { AgreementApprovalStatus, AgreementCity, GroupRaudhahStatus } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class UpsertGroupItineraryItemDto {
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

export class UpsertGroupVisaHotelDto {
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
  @Max(500)
  pax!: number;

  @IsOptional()
  @IsEnum(AgreementApprovalStatus)
  status?: AgreementApprovalStatus;

  @IsDateString()
  stayStart!: string;

  @IsDateString()
  stayEnd!: string;
}

export class UpsertGroupRaudhahDto {
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsEnum(GroupRaudhahStatus)
  status?: GroupRaudhahStatus;

  @IsOptional()
  @IsBoolean()
  tasrehPrinted?: boolean;
}
