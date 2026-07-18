import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class AgentLoginDto {
  @ApiProperty({ example: "operator@partner.example", maxLength: 160 })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  identifier!: string;

  @ApiProperty({ writeOnly: true, maxLength: 1024 })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  password!: string;
}
