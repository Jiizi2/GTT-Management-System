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

export class UpdateInvoiceDto {
  @ApiPropertyOptional({
    description: "ID client invoice yang baru.",
    example: "clyourinvoiceclientid",
  })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({
    description: "Nama client baru jika ingin membuat / memilih client berdasarkan nama.",
    example: "JSA",
  })
  @IsOptional()
  @IsString()
  clientName?: string;

  @ApiPropertyOptional({
    description: "Kode group terkait invoice. Gunakan string kosong untuk melepas relasi group.",
    example: "9017001002",
  })
  @IsOptional()
  @IsString()
  groupCode?: string;

  @ApiPropertyOptional({
    description: "Tanggal penerbitan invoice dalam format ISO date.",
    example: "2026-04-15",
  })
  @IsOptional()
  @IsDateString()
  issuedDate?: string;

  @ApiPropertyOptional({
    description: "Tanggal jatuh tempo invoice dalam format ISO date.",
    example: "2026-04-30",
  })
  @IsOptional()
  @ValidateIf((o) => o.dueDate !== "" && o.dueDate !== null && o.dueDate !== undefined)
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    description: "Nominal invoice terbaru.",
    example: 9800000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: "Nominal DP invoice terbaru dalam rupiah.",
    example: 25000000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  downPaymentIdr?: number;

  @ApiPropertyOptional({
    description: "Status invoice terbaru.",
    enum: InvoiceStatus,
    example: InvoiceStatus.PAID,
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({
    description: "Catatan internal invoice.",
    example: "Sudah lunas pada pembayaran akhir April.",
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

  @ApiProperty({
    description: "Versi concurrency locking invoice saat ini.",
    example: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  version!: number;
}
