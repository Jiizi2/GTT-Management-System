import { AgentPortalUserStatus } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from "class-validator";
import { IsStrongPassword } from "../../auth/is-strong-password";

export class CreateAgentPortalAccountDto {
  @ApiProperty({ example: "clagent123" })
  @IsString()
  @MinLength(1)
  @MaxLength(191)
  agentId!: string;

  @ApiProperty({ example: "Ahmad Partner", minLength: 2, maxLength: 120 })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ example: "ahmad@partner.example", maxLength: 160 })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({ minLength: 12, maxLength: 1024, writeOnly: true })
  @IsString()
  @IsStrongPassword()
  @MaxLength(1024)
  password!: string;
}

export class UpdateAgentPortalAccountStatusDto {
  @ApiProperty({ enum: AgentPortalUserStatus })
  @IsEnum(AgentPortalUserStatus)
  status!: AgentPortalUserStatus;
}

export class ResetAgentPortalAccountPasswordDto {
  @ApiProperty({ minLength: 12, maxLength: 1024, writeOnly: true })
  @IsString()
  @IsStrongPassword()
  @MaxLength(1024)
  password!: string;
}
