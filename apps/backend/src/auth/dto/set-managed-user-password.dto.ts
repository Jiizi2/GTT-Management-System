import { IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SetManagedUserPasswordDto {
  @ApiProperty({
    description: "Password baru untuk managed user.",
    example: "UpdatedPassword#2026",
    minLength: 8,
    maxLength: 1024,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(1024)
  password!: string;
}
