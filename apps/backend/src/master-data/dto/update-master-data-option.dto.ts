import { IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateMasterDataOptionDto {
  @ApiPropertyOptional({
    description: "Value machine-readable terbaru.",
    example: "WAITING",
    minLength: 1,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  value?: string;

  @ApiPropertyOptional({
    description: "Label terbaru untuk UI.",
    example: "Waiting Approval",
    minLength: 1,
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label?: string;

  @ApiPropertyOptional({
    description: "Deskripsi terbaru opsi.",
    example: "Masih menunggu approval hotel.",
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional({
    description: "Metadata JSON terbaru untuk opsi.",
    example: { color: "amber" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Urutan tampilan opsi.",
    example: 20,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: "Flag aktif/nonaktif opsi.",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
