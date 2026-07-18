import {
  VisaApplicationAgreementStatus,
  VisaApplicationDocumentStatus,
  VisaApplicationNusukStatus,
  VisaApplicationPaymentStatus,
  VisaApplicationVisaStatus,
} from "@prisma/client";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

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
  @IsOptional() @IsString() @MaxLength(191) nusukGroupNumber?: string;
  @IsOptional() @IsString() @MaxLength(191) nusukReferenceNumber?: string;
  @IsOptional() @IsString() @MaxLength(2000) adminNote?: string;
}
