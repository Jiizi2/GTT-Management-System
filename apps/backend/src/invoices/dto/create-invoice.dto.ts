import { InvoiceStatus } from "@prisma/client";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvoiceLineItemDto } from "./invoice-line-item.dto";

export class CreateInvoiceDto {
  @ApiProperty({ example: "agent_gtt_direct" })
  @IsString()
  @IsNotEmpty()
  agentId?: string;

  @ApiPropertyOptional({
    description: "ID client invoice yang sudah ada.",
    example: "clyourinvoiceclientid",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientId?: string;

  @ApiPropertyOptional({
    description: "Nama client baru atau fallback jika clientId tidak disediakan.",
    example: "Umrah Corporate",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  clientName?: string;

  @ApiPropertyOptional({
    description: "Kode group terkait invoice.",
    example: "9017001001",
  })
  @IsOptional()
  @IsString()
  groupCode?: string;

  @ApiProperty({
    description: "Tanggal penerbitan invoice dalam format ISO date.",
    example: "2026-04-12",
  })
  @IsDateString()
  issuedDate!: string;

  @ApiPropertyOptional({
    description: "Tanggal jatuh tempo invoice dalam format ISO date.",
    example: "2026-04-26",
  })
  @IsOptional()
  @ValidateIf((o) => o.dueDate !== "" && o.dueDate !== null && o.dueDate !== undefined)
  @IsDateString()
  dueDate?: string;

  @ApiProperty({
    description: "Nominal invoice. Akan dinormalisasi ke nilai non-negatif.",
    example: 17500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({
    description: "Nominal DP invoice dalam rupiah.",
    example: 50000000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  downPaymentIdr?: number;

  @ApiPropertyOptional({
    description: "Status awal invoice.",
    enum: InvoiceStatus,
    example: InvoiceStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: "Catatan internal invoice.",
    example: "Pelunasan termin kedua menunggu konfirmasi.",
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: "Keterangan invoice.",
    example: "Visa",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Nama Penerima invoice (PIC).",
    example: "PT Ghaniya Tour Travel",
  })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({
    description: "Daftar item invoice.",
    type: [InvoiceLineItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  items?: InvoiceLineItemDto[];
}
