import { SetMetadata } from "@nestjs/common";
import type { AuthAccessTier } from "./auth.types";

export const AUTH_ROLES_KEY = "auth:roles";

export const Roles = (...roles: AuthAccessTier[]) => SetMetadata(AUTH_ROLES_KEY, roles);
