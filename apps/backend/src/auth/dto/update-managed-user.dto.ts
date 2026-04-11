import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import type { AuthManagedUserRole } from "../auth.types";

const MANAGED_USER_ROLE_VALUES: AuthManagedUserRole[] = [
  "super-admin",
  "admin",
  "finance-manager",
  "customer-support",
];

export class UpdateManagedUserDto {
  @ApiProperty({
    description: "Nama display terbaru pengguna.",
    example: "Customer Support Lead",
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: "Email terbaru pengguna.",
    example: "support.lead@example.com",
    maxLength: 160,
  })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({
    description: "Role dashboard terbaru pengguna.",
    enum: MANAGED_USER_ROLE_VALUES,
    example: "customer-support",
  })
  @IsIn(MANAGED_USER_ROLE_VALUES)
  roleId!: AuthManagedUserRole;
}
