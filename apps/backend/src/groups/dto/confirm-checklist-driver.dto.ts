import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ConfirmChecklistDriverProfileDto {
  @ApiProperty({ example: "Driver Yusuf" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "+966 50 111 2222" })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiProperty({ example: "B 1234 ABC" })
  @IsString()
  @IsNotEmpty()
  plateNumber!: string;
}

export class ConfirmChecklistDriverDto {
  @ApiProperty({ example: "2026-04-12" })
  @IsDateString()
  tripDate!: string;

  @ApiProperty({ example: "Arrival" })
  @IsString()
  @IsNotEmpty()
  activity!: string;

  @ApiProperty({ example: "Arrival and transfer to hotel" })
  @IsString()
  @IsNotEmpty()
  tripLabel!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  requiredBusCount!: number;

  @ApiProperty({ example: "09:30" })
  @IsString()
  @IsNotEmpty()
  scheduledTime!: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  transferByTrain?: boolean;

  @ApiPropertyOptional({ example: "10:20" })
  @IsOptional()
  @IsString()
  trainDepartureTime?: string;

  @ApiPropertyOptional({ example: "12:05" })
  @IsOptional()
  @IsString()
  stationPickupTime?: string;

  @ApiProperty({ type: () => ConfirmChecklistDriverProfileDto })
  @ValidateNested()
  @Type(() => ConfirmChecklistDriverProfileDto)
  driver!: ConfirmChecklistDriverProfileDto;
}
