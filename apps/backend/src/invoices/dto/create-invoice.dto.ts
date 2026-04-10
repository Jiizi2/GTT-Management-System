import { InvoiceStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateIf } from "class-validator";

export class CreateInvoiceDto {
  @ValidateIf((payload: CreateInvoiceDto) => !payload.clientName)
  @IsString()
  @IsNotEmpty()
  clientId?: string;

  @ValidateIf((payload: CreateInvoiceDto) => !payload.clientId)
  @IsString()
  @IsNotEmpty()
  clientName?: string;

  @IsOptional()
  @IsString()
  groupCode?: string;

  @IsDateString()
  issuedDate!: string;

  @IsDateString()
  dueDate!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
