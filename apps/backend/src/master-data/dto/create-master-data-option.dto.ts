import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateMasterDataOptionDto {
  @ApiProperty({
    description: "Key kategori master data.",
    example: "visa-status",
    minLength: 2,
    maxLength: 80,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  categoryKey!: string;

  @ApiPropertyOptional({
    description: "Value machine-readable. Jika kosong, backend akan membangkitkan dari label.",
    example: "ISSUED",
    minLength: 1,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value?: string;

  @ApiProperty({
    description: "Label yang ditampilkan di UI.",
    example: "Issued",
    minLength: 1,
    maxLength: 160,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;

  @ApiPropertyOptional({
    description: "Deskripsi opsional untuk admin atau operator.",
    example: "Visa sudah terbit dan siap dipakai.",
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({
    description: "Metadata JSON tambahan untuk kebutuhan UI atau integrasi.",
    example: { color: "green", badge: true },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Urutan tampilan opsi di dalam kategori.",
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: "Menentukan apakah opsi aktif dipakai di UI.",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
