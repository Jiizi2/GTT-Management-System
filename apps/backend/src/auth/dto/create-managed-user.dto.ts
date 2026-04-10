import { IsEmail, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import type { AuthManagedUserRole } from "../auth.types";

const MANAGED_USER_ROLE_VALUES: AuthManagedUserRole[] = [
  "super-admin",
  "admin",
  "finance-manager",
  "customer-support",
];

export class CreateManagedUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsIn(MANAGED_USER_ROLE_VALUES)
  roleId!: AuthManagedUserRole;
}
