import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AuthManagedUserRole } from "../auth.types";

const MANAGED_USER_ROLE_VALUES: AuthManagedUserRole[] = [
  "super-admin",
  "admin",
  "finance-manager",
  "customer-support",
];

export class CreateManagedUserDto {
  @ApiProperty({
    description: "Nama display pengguna yang akan dikelola.",
    example: "Finance Manager",
    minLength: 2,
    maxLength: 120,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: "Email unik pengguna.",
    example: "finance.manager@example.com",
    maxLength: 160,
  })
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @ApiProperty({
    description: "Role dashboard untuk pengguna.",
    enum: MANAGED_USER_ROLE_VALUES,
    example: "finance-manager",
  })
  @IsIn(MANAGED_USER_ROLE_VALUES)
  roleId!: AuthManagedUserRole;

  @ApiPropertyOptional({
    description: "Password awal opsional untuk langsung mengaktifkan akun.",
    example: "FinanceManager#2026",
    minLength: 8,
    maxLength: 1024,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(1024)
  password?: string;
}
