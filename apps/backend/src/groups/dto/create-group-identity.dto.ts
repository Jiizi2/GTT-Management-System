import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BusStatus } from "@prisma/client";
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateMusyrifDto } from "./create-group.dto";

export class CreateGroupIdentityDto {
  @ApiProperty({ example: "9017001001" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiPropertyOptional({ example: "Nusuk Entry 9017001001" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "Umrah Plus" })
  @IsOptional()
  @IsString()
  packageName?: string;

  @ApiPropertyOptional({ example: 45, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  pax?: number;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalBuses?: number;

  @ApiPropertyOptional({ example: "2026-04-12" })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiPropertyOptional({ example: "2026-04-20" })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({ example: 9, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  durationDays?: number;

  @ApiPropertyOptional({ type: () => CreateMusyrifDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateMusyrifDto)
  musyrif?: CreateMusyrifDto;

  @ApiPropertyOptional({ enum: BusStatus, example: BusStatus.VISA_ONLY })
  @IsOptional()
  @IsEnum(BusStatus)
  busStatus?: BusStatus;
}
