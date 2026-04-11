import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    description: "Username atau email yang dipakai untuk login dashboard.",
    example: "dev.superadmin",
    maxLength: 320,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  identifier!: string;

  @ApiProperty({
    description: "Password akun login.",
    example: "DevSuperAdmin#2026",
    maxLength: 1024,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;

  @ApiPropertyOptional({
    description: "Jika true, session browser akan bertahan hingga 14 hari.",
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberSession?: boolean;
}
