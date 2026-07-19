import { AgentStatus, AgentType } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches } from "class-validator";

export class CreateAgentDto {
  @ApiProperty({ example: "AL-FALAH" })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9-]*$/)
  code!: string;

  @ApiProperty({ example: "PT Al Falah Travel" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ enum: AgentType, default: AgentType.PARTNER })
  @IsOptional()
  @IsEnum(AgentType)
  type?: AgentType;

  @ApiPropertyOptional({ example: "Ahmad" })
  @IsOptional()
  @IsString()
  picName?: string;

  @ApiPropertyOptional({ example: "+628123456789" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "ops@alfalah.example" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateAgentDto extends PartialType(CreateAgentDto) {}

export class UpdateAgentStatusDto {
  @ApiProperty({ enum: AgentStatus })
  @IsEnum(AgentStatus)
  status!: AgentStatus;
}
