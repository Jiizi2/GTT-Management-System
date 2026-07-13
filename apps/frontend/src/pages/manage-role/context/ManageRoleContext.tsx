import { createContext, useContext } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { UserAccount, UserRoleOption, RoleCatalogItem } from "../manage-role-types";
import type { CreateManagedUserFormValues, ManagedUserFormValues, ResetManagedUserPasswordFormValues } from "../hooks/use-manage-role";

export interface ManageRoleContextType {
  // Queries & Mutations States
  users: UserAccount[];
  userRoleOptions: UserRoleOption[];
  roleCatalogItems: RoleCatalogItem[];
  roleCatalogById: Map<string, RoleCatalogItem>;
  managedUsersLoading: boolean;
  
  // UI States
  notice: { tone: "success" | "error"; message: string } | null;
  setNotice: (notice: { tone: "success" | "error"; message: string } | null) => void;
  isCreateDrawerOpen: boolean;
  editingUser: UserAccount | null;
  deleteTargetUser: UserAccount | null;
  passwordTargetUser: UserAccount | null;
  totalSuperAdmin: number;
  totalUsersWithoutPassword: number;
  hasActiveRoleOptions: boolean;
  defaultRoleId: string;
  selectedCreateRole: {
    label: string;
    description: string;
    permissions: string[];
  } | null;
  isAnyOverlayOpen: boolean;
  isCreatePending: boolean;
  isUpdatePending: boolean;
  isDeletePending: boolean;
  isPasswordPending: boolean;

  // React Hook Forms
  createForm: UseFormReturn<CreateManagedUserFormValues>;
  editForm: UseFormReturn<ManagedUserFormValues>;
  passwordForm: UseFormReturn<ResetManagedUserPasswordFormValues>;

  // Actions
  openCreateDrawer: () => void;
  closeCreateDrawer: () => void;
  openEditModal: (user: UserAccount) => void;
  closeEditModal: () => void;
  openDeleteModal: (user: UserAccount) => void;
  closeDeleteModal: () => void;
  openPasswordModal: (user: UserAccount) => void;
  closePasswordModal: () => void;
  handleCreateUser: (values: CreateManagedUserFormValues) => Promise<void>;
  handleSubmitEditUser: (values: ManagedUserFormValues) => Promise<void>;
  handleConfirmDeleteUser: () => Promise<void>;
  handleSubmitManagedUserPassword: (values: ResetManagedUserPasswordFormValues) => Promise<void>;
  resolveRoleToneClass: (roleId: string) => string;
  resolvePasswordToneClass: (hasPassword: boolean) => string;
}

export const ManageRoleContext = createContext<ManageRoleContextType | null>(null);

export function useManageRoleContext() {
  const context = useContext(ManageRoleContext);
  if (!context) {
    throw new Error("useManageRoleContext must be used within ManageRoleContext.Provider");
  }
  return context;
}
