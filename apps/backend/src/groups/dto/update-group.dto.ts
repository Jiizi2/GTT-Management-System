import { GroupTone } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: "9017001001" })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: "Updated Umrah Group" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "Completed" })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: "2026-04-12" })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiPropertyOptional({ example: "2026-04-20" })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({ enum: GroupTone, example: GroupTone.INACTIVE })
  @IsOptional()
  @IsEnum(GroupTone)
  tone?: GroupTone;

  @ApiPropertyOptional({ example: 40, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pax?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalBuses?: number;

  @ApiPropertyOptional({ example: "Premium Plus" })
  @IsOptional()
  @IsString()
  packageName?: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  durationDays?: number;

  @ApiPropertyOptional({ example: "cldraftparentid123" })
  @IsOptional()
  @IsString()
  parentGroupId?: string | null;
}
