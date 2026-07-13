import type { BackendManagedUser } from "../../hooks/use-user-management-backend";

export type RoleId = BackendManagedUser["roleId"];

export type RoleCatalogItem = {
  id: string;
  label: string;
  description: string;
  permissions: string[];
};

export type UserRoleOption = {
  id: RoleId;
  label: string;
  description: string;
  sortOrder: number;
};

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  roleId: RoleId;
  hasPassword: boolean;
};
