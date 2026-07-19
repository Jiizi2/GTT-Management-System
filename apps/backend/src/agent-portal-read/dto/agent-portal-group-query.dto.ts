import { GroupLifecycleStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class AgentPortalGroupQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(GroupLifecycleStatus)
  lifecycle?: GroupLifecycleStatus;

  @IsOptional()
  @IsDateString()
  arrivalFrom?: string;

  @IsOptional()
  @IsDateString()
  arrivalTo?: string;

  @IsOptional()
  @IsIn(["arrivalDate", "returnDate", "code"])
  sortBy: "arrivalDate" | "returnDate" | "code" = "arrivalDate";

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDirection: "asc" | "desc" = "asc";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
