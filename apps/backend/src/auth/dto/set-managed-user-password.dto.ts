import { IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { IsStrongPassword } from "../is-strong-password";

export class SetManagedUserPasswordDto {
  @ApiProperty({
    description: "Password baru untuk managed user.",
    example: "UpdatedPassword#2026",
    minLength: 12,
    maxLength: 1024,
  })
  @IsString()
  @IsStrongPassword()
  @MaxLength(1024)
  password!: string;
}
