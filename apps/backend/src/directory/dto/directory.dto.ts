import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateMuassasahDto {
  @ApiProperty({ example: "Daleel Maalem" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;
}

export class UpdateMuassasahDto {
  @ApiPropertyOptional({ example: "Daleel Maalem" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateDriverDto {
  @ApiProperty({ example: "Driver Yusuf" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: "+966 50 111 2222" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @ApiPropertyOptional({ example: "Ramah, tepat waktu." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: false, description: "Tandai supir bermasalah (kurang berkesan)." })
  @IsOptional()
  @IsBoolean()
  isProblematic?: boolean;

  @ApiPropertyOptional({ example: "muassasah-id" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  muassasahId?: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional({ example: "Driver Yusuf" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: "+966 50 111 2222" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @ApiPropertyOptional({ example: "Sering terlambat." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isProblematic?: boolean;

  @ApiPropertyOptional({ example: "muassasah-id" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  muassasahId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListDriversDto {
  @ApiPropertyOptional({ example: "yusuf" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional({ example: "muassasah-id" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  muassasahId?: string;
}

export class CreateVehicleDto {
  @ApiProperty({ example: "B 1234 ABC" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  plateNumber!: string;

  @ApiPropertyOptional({ example: "AC dingin, bersih." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: false, description: "Tandai kendaraan bermasalah (mis. kotor)." })
  @IsOptional()
  @IsBoolean()
  isProblematic?: boolean;

  @ApiPropertyOptional({ example: "muassasah-id" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  muassasahId?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ example: "B 1234 ABC" })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  plateNumber?: string;

  @ApiPropertyOptional({ example: "Bis kotor, kurang perawatan." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isProblematic?: boolean;

  @ApiPropertyOptional({ example: "muassasah-id" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  muassasahId?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListVehiclesDto {
  @ApiPropertyOptional({ example: "1234" })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ example: "muassasah-id" })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  muassasahId?: string;
}
