import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

export class ConfirmChecklistDriverProfileDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  plateNumber!: string;
}

export class ConfirmChecklistDriverDto {
  @IsDateString()
  tripDate!: string;

  @IsString()
  @IsNotEmpty()
  activity!: string;

  @IsString()
  @IsNotEmpty()
  tripLabel!: string;

  @IsInt()
  @Min(1)
  requiredBusCount!: number;

  @IsString()
  @IsNotEmpty()
  scheduledTime!: string;

  @IsOptional()
  @IsBoolean()
  transferByTrain?: boolean;

  @IsOptional()
  @IsString()
  trainDepartureTime?: string;

  @IsOptional()
  @IsString()
  stationPickupTime?: string;

  @ValidateNested()
  @Type(() => ConfirmChecklistDriverProfileDto)
  driver!: ConfirmChecklistDriverProfileDto;
}
