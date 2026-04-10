import { GroupTone } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @IsOptional()
  @IsEnum(GroupTone)
  tone?: GroupTone;

  @IsOptional()
  @IsInt()
  @Min(1)
  pax?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalBuses?: number;

  @IsOptional()
  @IsString()
  packageName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  durationDays?: number;
}
