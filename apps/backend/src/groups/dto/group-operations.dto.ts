import { AgreementApprovalStatus, AgreementCity, GroupRaudhahStatus } from "@prisma/client";
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpsertGroupItineraryItemDto {
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

  @ApiPropertyOptional({ example: "Transit Hotel" })
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

export class UpsertGroupVisaHotelDto {
  @ApiProperty({ enum: AgreementCity, example: AgreementCity.MADINAH })
  @IsEnum(AgreementCity)
  city!: AgreementCity;

  @ApiProperty({ example: "Pullman Zamzam Madinah" })
  @IsString()
  @IsNotEmpty()
  hotelName!: string;

  @ApiProperty({ example: "20269017001002" })
  @IsString()
  @IsNotEmpty()
  agreementNumber!: string;

  @ApiProperty({ example: 45, minimum: 1, maximum: 500 })
  @IsInt()
  @Min(1)
  @Max(500)
  pax!: number;

  @ApiPropertyOptional({
    enum: AgreementApprovalStatus,
    example: AgreementApprovalStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(AgreementApprovalStatus)
  status?: AgreementApprovalStatus;

  @ApiProperty({ example: "2026-04-15" })
  @IsDateString()
  stayStart!: string;

  @ApiProperty({ example: "2026-04-18" })
  @IsDateString()
  stayEnd!: string;
}

export class UpsertGroupRaudhahDto {
  @ApiProperty({ example: "2026-04-16" })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({
    enum: GroupRaudhahStatus,
    example: GroupRaudhahStatus.BEFORE,
  })
  @IsOptional()
  @IsEnum(GroupRaudhahStatus)
  status?: GroupRaudhahStatus;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  tasrehPrinted?: boolean;
}
