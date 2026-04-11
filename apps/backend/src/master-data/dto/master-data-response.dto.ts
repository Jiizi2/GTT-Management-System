import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class MasterDataCategorySummaryResponseDto {
  @ApiProperty({ example: "invoice-status" })
  key!: string;

  @ApiProperty({ example: "Status Invoice" })
  label!: string;

  @ApiProperty({ example: "Pilihan status invoice yang dipakai di dashboard finance." })
  description!: string;

  @ApiProperty({ example: 5 })
  totalOptions!: number;

  @ApiProperty({ example: 4 })
  activeOptions!: number;
}

export class MasterDataOptionItemResponseDto {
  @ApiProperty({ example: "clmasterdataoptionid123" })
  id!: string;

  @ApiProperty({ example: "invoice-status" })
  categoryKey!: string;

  @ApiProperty({ example: "PAID" })
  value!: string;

  @ApiProperty({ example: "Paid" })
  label!: string;

  @ApiPropertyOptional({ example: "Menandakan invoice sudah lunas." })
  description?: string;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    example: {
      color: "emerald",
    },
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({ example: 1 })
  sortOrder!: number;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: "2026-04-12T13:30:00.000Z" })
  createdAt!: string;

  @ApiProperty({ example: "2026-04-12T13:30:00.000Z" })
  updatedAt!: string;
}
