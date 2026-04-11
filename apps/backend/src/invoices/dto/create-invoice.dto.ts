import { InvoiceStatus } from "@prisma/client";
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateInvoiceDto {
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

  @ApiProperty({
    description: "Tanggal jatuh tempo invoice dalam format ISO date.",
    example: "2026-04-26",
  })
  @IsDateString()
  dueDate!: string;

  @ApiProperty({
    description: "Nominal invoice. Akan dinormalisasi ke nilai non-negatif.",
    example: 17500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount!: number;

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
}
