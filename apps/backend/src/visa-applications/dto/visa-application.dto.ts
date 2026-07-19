import {
  VisaApplicationAgreementStatus,
  VisaApplicationDocumentStatus,
  VisaApplicationNusukStatus,
  VisaApplicationPaymentStatus,
  VisaApplicationVisaStatus,
} from "@prisma/client";
import {
  IsBooleanString,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateVisaApplicationDto {
  @IsDateString() departureDate!: string;
  @IsDateString() returnDate!: string;
  @IsString() @MinLength(2) @MaxLength(120) departureCity!: string;
  @IsString() @MinLength(2) @MaxLength(160) packageName!: string;
  @IsOptional() @IsString() @MaxLength(160) providerName?: string;
  @IsInt() @Min(1) @Max(5000) passengerCount!: number;
}

export class UpdateVisaApplicationProgressDto {
  @IsOptional()
  @IsEnum(VisaApplicationDocumentStatus)
  documentStatus?: VisaApplicationDocumentStatus;
  @IsOptional()
  @IsEnum(VisaApplicationAgreementStatus)
  agreementStatus?: VisaApplicationAgreementStatus;
  @IsOptional()
  @IsEnum(VisaApplicationNusukStatus)
  nusukStatus?: VisaApplicationNusukStatus;
  @IsOptional()
  @IsEnum(VisaApplicationPaymentStatus)
  paymentStatus?: VisaApplicationPaymentStatus;
  @IsOptional()
  @IsEnum(VisaApplicationVisaStatus)
  visaStatus?: VisaApplicationVisaStatus;
  @IsOptional() @IsString() @MaxLength(191) nusukGroupNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(191) nusukReferenceNumber?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) adminNote?: string | null;
}

export const VISA_APPLICATION_LIST_VIEWS = [
  "all",
  "incomplete",
  "revision",
  "in-progress",
  "issued",
  "completed",
] as const;

export type VisaApplicationListView = (typeof VISA_APPLICATION_LIST_VIEWS)[number];

export class ListVisaApplicationsDto {
  @IsOptional() @IsString() @MaxLength(160) q?: string;
  @IsOptional() @IsString() @MaxLength(191) agentId?: string;
  @IsOptional() @IsIn(VISA_APPLICATION_LIST_VIEWS) view?: VisaApplicationListView;
  @IsOptional() @IsBooleanString() linked?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class LinkVisaApplicationGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  groupId?: string | null;
}
