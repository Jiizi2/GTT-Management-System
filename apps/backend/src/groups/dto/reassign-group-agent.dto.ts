import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ReassignGroupAgentDto {
  @ApiProperty({ example: "agent_partner_id" })
  @IsString() @IsNotEmpty() agentId!: string;

  @ApiProperty({ example: "Correction requested by operations manager" })
  @IsString() @MinLength(5) reason!: string;
}
