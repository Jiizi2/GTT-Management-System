import { ApiProperty } from "@nestjs/swagger";
import type { AuthAccessTier, AuthManagedUserRole } from "../auth.types";

export class AuthSessionUserResponseDto {
  @ApiProperty({ example: "usr_01HZX3Q3V1J5M8R7QZZ1Q8A7P4" })
  id!: string;

  @ApiProperty({ example: "Dev Super Admin" })
  name!: string;

  @ApiProperty({ example: "dev.superadmin" })
  username!: string;

  @ApiProperty({ example: "superadmin.dev@ghaniya.local" })
  email!: string;

  @ApiProperty({ enum: ["super-admin", "admin"], example: "super-admin" })
  accessTier!: AuthAccessTier;
}

export class AuthBrowserSessionResponseDto {
  @ApiProperty({ example: "2026-04-26T14:30:00.000Z" })
  expiresAt!: string;

  @ApiProperty({ example: true })
  rememberSession!: boolean;

  @ApiProperty({ type: () => AuthSessionUserResponseDto })
  user!: AuthSessionUserResponseDto;
}

export class AuthManagedUserResponseDto {
  @ApiProperty({ example: "usr_01HZX3Q3V1J5M8R7QZZ1Q8A7P4" })
  id!: string;

  @ApiProperty({ example: "Finance Manager" })
  name!: string;

  @ApiProperty({ example: "finance.manager@example.com" })
  email!: string;

  @ApiProperty({
    enum: ["super-admin", "admin", "finance-manager", "customer-support"],
    example: "finance-manager",
  })
  roleId!: AuthManagedUserRole;

  @ApiProperty({ example: true })
  hasPassword!: boolean;

  @ApiProperty({ example: "2026-04-12T13:30:00.000Z" })
  updatedAt!: string;
}
