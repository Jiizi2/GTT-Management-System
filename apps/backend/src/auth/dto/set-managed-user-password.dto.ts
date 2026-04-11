import { IsString, MaxLength, MinLength } from "class-validator";

export class SetManagedUserPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(1024)
  password!: string;
}
