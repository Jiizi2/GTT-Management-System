import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ResetChecklistDriverDto {
  @ApiProperty({ example: "2026-04-12" })
  @IsDateString()
  tripDate!: string;

  @ApiProperty({ example: "09:30" })
  @IsString()
  @IsNotEmpty()
  scheduledTime!: string;

  @ApiPropertyOptional({ example: "Arrival" })
  @IsOptional()
  @IsString()
  activity?: string;
}
