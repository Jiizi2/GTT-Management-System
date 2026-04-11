import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(320)
  identifier!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberSession?: boolean;
}
