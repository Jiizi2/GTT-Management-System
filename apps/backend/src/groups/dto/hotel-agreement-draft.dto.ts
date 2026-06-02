import { AgreementApprovalStatus, AgreementCity } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpsertHotelAgreementDraftDto {
  @ApiProperty({ enum: AgreementCity, example: AgreementCity.MAKKAH })
  @IsEnum(AgreementCity)
  city!: AgreementCity;

  @ApiPropertyOptional({ example: "PT Al Falah Agent" })
  @IsOptional()
  @IsString()
  agentName?: string;

  @ApiProperty({ example: "Swissotel Al Maqam" })
  @IsString()
  @IsNotEmpty()
  hotelName!: string;

  @ApiProperty({ example: "20269017001001" })
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
    example: AgreementApprovalStatus.WAITING,
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

  @ApiPropertyOptional({
    example: "Agreement received before group number is issued.",
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignHotelAgreementDraftDto {
  @ApiProperty({ example: "9017001001" })
  @IsString()
  @IsNotEmpty()
  groupCode!: string;
}

export class HotelAgreementDraftResponseDto {
  @ApiProperty({ example: "cldraftagreementid123" })
  id!: string;

  @ApiProperty({ enum: AgreementCity, example: AgreementCity.MAKKAH })
  city!: AgreementCity;

  @ApiPropertyOptional({ example: "PT Al Falah Agent" })
  agentName?: string;

  @ApiProperty({ example: "Swissotel Al Maqam" })
  hotelName!: string;

  @ApiProperty({ example: "20269017001001" })
  agreementNumber!: string;

  @ApiProperty({ example: 45 })
  pax!: number;

  @ApiProperty({
    enum: AgreementApprovalStatus,
    example: AgreementApprovalStatus.WAITING,
  })
  status!: AgreementApprovalStatus;

  @ApiProperty({ example: "2026-04-12" })
  stayStart!: string;

  @ApiProperty({ example: "2026-04-15" })
  stayEnd!: string;

  @ApiPropertyOptional({
    example: "Agreement received before group number is issued.",
  })
  notes?: string;

  @ApiPropertyOptional({ example: "9017001001" })
  groupCode?: string;

  @ApiProperty({ enum: ["UNASSIGNED", "ASSIGNED"], example: "UNASSIGNED" })
  assignmentStatus!: "UNASSIGNED" | "ASSIGNED";

  @ApiPropertyOptional({ example: "2026-04-12T13:30:00.000Z" })
  assignedAt?: string;

  @ApiProperty({ example: "2026-04-12T13:30:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-04-12T13:40:00.000Z" })
  updatedAt!: string;
}
