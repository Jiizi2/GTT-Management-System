import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class ResetChecklistDriverDto {
  @IsDateString()
  tripDate!: string;

  @IsString()
  @IsNotEmpty()
  scheduledTime!: string;

  @IsOptional()
  @IsString()
  activity?: string;
}
