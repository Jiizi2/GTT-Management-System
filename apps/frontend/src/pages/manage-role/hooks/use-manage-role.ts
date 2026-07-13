import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod/v4";
import type { MasterDataOption } from "../../../hooks/use-master-data-backend";
import { useMasterDataOptionsQuery } from "../../../hooks/use-master-data-query";
import {
  useCreateManagedUserMutation,
  useDeleteManagedUserMutation,
  useManagedUsersQuery,
  useSetManagedUserPasswordMutation,
  useUpdateManagedUserMutation,
} from "../../../hooks/use-user-management-query";
import type { BackendManagedUser } from "../../../hooks/use-user-management-backend";
import type {
  RoleId,
  RoleCatalogItem,
  UserRoleOption,
  UserAccount,
} from "../manage-role-types";

type NoticeState = {
  tone: "success" | "error";
  message: string;
};

const defaultRoleCatalog: RoleCatalogItem[] = [
  {
    id: "super-admin",
    label: "Super Admin",
    description: "Akses penuh lintas modul, termasuk pengaturan role dan permission.",
    permissions: ["MANAGE_USERS", "EDIT_ROLES", "VIEW_ALL_REPORTS", "SYSTEM_SETTINGS"],
  },
  {
    id: "admin",
    label: "Admin",
    description: "Mengelola operasional harian, itinerary, checklist, dan monitoring visa.",
    permissions: ["EDIT_ITINERARIES", "APPROVE_CHECKLISTS", "TRACK_VISA"],
  },
  {
    id: "finance-manager",
    label: "Finance Manager",
    description: "Fokus pada invoice, status pembayaran, dan rekap billing group.",
    permissions: ["MANAGE_INVOICES", "VIEW_PAYMENT_STATUS"],
  },
  {
    id: "customer-support",
    label: "Customer Support",
    description: "Menangani komunikasi jamaah dan kebutuhan update informasi group.",
    permissions: ["VIEW_GROUP_PROFILE", "UPDATE_CONTACT_NOTES"],
  },
];

const roleIdSet = new Set<RoleId>(["super-admin", "admin", "finance-manager", "customer-support"]);

const roleIdSchema = z.enum(["super-admin", "admin", "finance-manager", "customer-support"]);

const managedUserFormSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi."),
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid. Contoh: user@ghaniyatravel.com."),
  roleId: roleIdSchema,
});

const optionalManagedUserPasswordSchema = z.string().trim().max(1024, "Password terlalu panjang.");

const requiredManagedUserPasswordSchema = z
  .string()
  .trim()
  .min(8, "Password minimal 8 karakter.")
  .max(1024, "Password terlalu panjang.");

const createManagedUserFormSchema = managedUserFormSchema
  .extend({
    password: optionalManagedUserPasswordSchema,
    confirmPassword: optionalManagedUserPasswordSchema,
  })
  .superRefine((values, context) => {
    const password = values.password.trim();
    const confirmPassword = values.confirmPassword.trim();

    if (!password && !confirmPassword) {
      return;
    }

    if (!password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Isi password dulu atau kosongkan kedua field password.",
      });
      return;
    }

    if (password.length < 8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Password minimal 8 karakter.",
      });
    }

    if (!confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Konfirmasi password wajib diisi jika password diatur.",
      });
      return;
    }

    if (password !== confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Konfirmasi password tidak sama.",
      });
    }
  });

const resetManagedUserPasswordFormSchema = z
  .object({
    password: requiredManagedUserPasswordSchema,
    confirmPassword: optionalManagedUserPasswordSchema,
  })
  .superRefine((values, context) => {
    const password = values.password.trim();
    const confirmPassword = values.confirmPassword.trim();

    if (!confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Konfirmasi password wajib diisi.",
      });
      return;
    }

    if (password !== confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Konfirmasi password tidak sama.",
      });
    }
  });

export type CreateManagedUserFormValues = z.infer<typeof createManagedUserFormSchema>;
export type ManagedUserFormValues = z.infer<typeof managedUserFormSchema>;
export type ResetManagedUserPasswordFormValues = z.infer<typeof resetManagedUserPasswordFormSchema>;

const defaultUserRoleOptions: UserRoleOption[] = defaultRoleCatalog
  .filter((role): role is RoleCatalogItem & { id: RoleId } => roleIdSet.has(role.id as RoleId))
  .map((role, index) => ({
    id: role.id,
    label: role.label,
    description: role.description,
    sortOrder: index + 1,
  }));

function resolveRoleToneClass(roleId: string): string {
  if (roleId === "super-admin") {
    return "bg-primary text-on-primary";
  }

  if (roleId === "admin") {
    return "bg-primary-fixed text-on-primary-fixed";
  }

  if (roleId === "finance-manager") {
    return "bg-secondary-container text-on-secondary-container";
  }

  return "bg-surface-container-high text-on-surface";
}

function resolvePasswordToneClass(hasPassword: boolean): string {
  if (hasPassword) {
    return "border-primary/20 bg-primary-fixed text-on-primary-fixed";
  }

  return "border-outline-variant/35 bg-surface-container-lowest text-on-surface-variant";
}

function isRoleId(value: string): value is RoleId {
  return roleIdSet.has(value as RoleId);
}

function readMetadataPermissions(metadata: MasterDataOption["metadata"]): string[] {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }

  const rawPermissions = (metadata as any).permissions;
  if (!Array.isArray(rawPermissions)) {
    return [];
  }

  return rawPermissions
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function mapUserRoleOptionsFromMasterData(options: MasterDataOption[]): UserRoleOption[] {
  if (options.length === 0) {
    return defaultUserRoleOptions;
  }

  const mapped = options
    .filter((option) => option.isActive && isRoleId(option.value))
    .map((option) => ({
      id: option.value as RoleId,
      label: option.label.trim() || option.value,
      description: option.description?.trim() || "",
      sortOrder: option.sortOrder,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return mapped;
}

function mapRoleCatalogFromMasterData(options: MasterDataOption[]): RoleCatalogItem[] {
  if (options.length === 0) {
    return defaultRoleCatalog;
  }

  const mapped = options
    .filter((option) => option.isActive)
    .map((option) => ({
      id: option.value.trim() || option.id,
      label: option.label.trim() || option.value,
      description: option.description?.trim() || "-",
      permissions: readMetadataPermissions(option.metadata),
      sortOrder: option.sortOrder,
    }))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ sortOrder: _sortOrder, ...role }) => role);

  return mapped;
}

function mapBackendUserToLocal(user: BackendManagedUser): UserAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    hasPassword: user.hasPassword,
  };
}

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}

export function useManageRole() {
  const managedUsersQuery = useManagedUsersQuery();
  const userRoleOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "user-role",
  });
  const roleCatalogQuery = useMasterDataOptionsQuery({
    categoryKey: "role-catalog",
  });
  const createManagedUserMutation = useCreateManagedUserMutation();
  const updateManagedUserMutation = useUpdateManagedUserMutation();
  const deleteManagedUserMutation = useDeleteManagedUserMutation();
  const setManagedUserPasswordMutation = useSetManagedUserPasswordMutation();
  
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserAccount | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserAccount | null>(null);

  const users = useMemo(
    () => (managedUsersQuery.data ?? []).map((user) => mapBackendUserToLocal(user)),
    [managedUsersQuery.data],
  );
  const userRoleOptions = useMemo(
    () => mapUserRoleOptionsFromMasterData(userRoleOptionsQuery.data ?? []),
    [userRoleOptionsQuery.data],
  );
  const roleCatalogItems = useMemo(
    () => mapRoleCatalogFromMasterData(roleCatalogQuery.data ?? []),
    [roleCatalogQuery.data],
  );

  const roleCatalogById = useMemo(
    () => new Map(roleCatalogItems.map((role) => [role.id, role] as const)),
    [roleCatalogItems],
  );

  const totalSuperAdmin = useMemo(() => users.filter((user) => user.roleId === "super-admin").length, [users]);
  const totalUsersWithoutPassword = useMemo(() => users.filter((user) => !user.hasPassword).length, [users]);
  const hasActiveRoleOptions = userRoleOptions.length > 0;
  const defaultRoleId = userRoleOptions[0]?.id ?? "admin";

  const createForm = useForm<CreateManagedUserFormValues>({
    resolver: zodResolver(createManagedUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      roleId: defaultRoleId,
      password: "",
      confirmPassword: "",
    },
  });
  const editForm = useForm<ManagedUserFormValues>({
    resolver: zodResolver(managedUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      roleId: defaultRoleId,
    },
  });
  const passwordForm = useForm<ResetManagedUserPasswordFormValues>({
    resolver: zodResolver(resetManagedUserPasswordFormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const createRoleId = createForm.watch("roleId");
  const selectedCreateRole = useMemo(() => {
    const selectedRoleOption = userRoleOptions.find((role) => role.id === createRoleId);
    const selectedRoleCatalog = roleCatalogById.get(createRoleId);

    if (!selectedRoleOption && !selectedRoleCatalog) {
      return null;
    }

    return {
      label: selectedRoleOption?.label ?? selectedRoleCatalog?.label ?? "Role",
      description: selectedRoleOption?.description || selectedRoleCatalog?.description || "",
      permissions: selectedRoleCatalog?.permissions ?? [],
    };
  }, [createRoleId, roleCatalogById, userRoleOptions]);

  const isAnyOverlayOpen =
    isCreateDrawerOpen || Boolean(editingUser) || Boolean(deleteTargetUser) || Boolean(passwordTargetUser);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice((current) => (current ? null : current));
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  useEffect(() => {
    const currentRoleId = createForm.getValues("roleId");
    if (userRoleOptions.some((role) => role.id === currentRoleId)) {
      return;
    }

    createForm.setValue("roleId", defaultRoleId);
  }, [createForm, defaultRoleId, userRoleOptions]);

  useEffect(() => {
    if (!editingUser) {
      editForm.reset({
        name: "",
        email: "",
        roleId: defaultRoleId,
      });
      return;
    }

    editForm.reset({
      name: editingUser.name,
      email: editingUser.email,
      roleId: userRoleOptions.some((role) => role.id === editingUser.roleId) ? editingUser.roleId : defaultRoleId,
    });
  }, [defaultRoleId, editForm, editingUser, userRoleOptions]);

  useEffect(() => {
    if (!passwordTargetUser) {
      passwordForm.reset({
        password: "",
        confirmPassword: "",
      });
      return;
    }

    passwordForm.reset({
      password: "",
      confirmPassword: "",
    });
  }, [passwordForm, passwordTargetUser]);

  const closeCreateDrawer = () => {
    setIsCreateDrawerOpen(false);
  };

  const closeEditModal = () => {
    setEditingUser(null);
  };

  const closeDeleteModal = () => {
    setDeleteTargetUser(null);
  };

  const closePasswordModal = () => {
    setPasswordTargetUser(null);
  };

  const openCreateDrawer = () => {
    setEditingUser(null);
    setDeleteTargetUser(null);
    setPasswordTargetUser(null);
    setIsCreateDrawerOpen(true);
  };

  const openEditModal = (user: UserAccount) => {
    setIsCreateDrawerOpen(false);
    setDeleteTargetUser(null);
    setPasswordTargetUser(null);
    setEditingUser(user);
  };

  const openDeleteModal = (user: UserAccount) => {
    setIsCreateDrawerOpen(false);
    setEditingUser(null);
    setPasswordTargetUser(null);
    setDeleteTargetUser(user);
  };

  const openPasswordModal = (user: UserAccount) => {
    setIsCreateDrawerOpen(false);
    setEditingUser(null);
    setDeleteTargetUser(null);
    setPasswordTargetUser(user);
  };

  useEffect(() => {
    if (!isCreateDrawerOpen && !editingUser && !deleteTargetUser && !passwordTargetUser) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCreateDrawer();
        closeEditModal();
        closeDeleteModal();
        closePasswordModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteTargetUser, editingUser, isCreateDrawerOpen, passwordTargetUser]);

  useEffect(() => {
    if (!isAnyOverlayOpen || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAnyOverlayOpen]);

  useEffect(() => {
    if (!managedUsersQuery.error) {
      return;
    }

    setNotice({
      tone: "error",
      message: extractErrorMessage(managedUsersQuery.error, "Gagal memuat daftar user dari backend."),
    });
  }, [managedUsersQuery.error]);

  useEffect(() => {
    if (!userRoleOptionsQuery.error && !roleCatalogQuery.error) {
      return;
    }

    setNotice({
      tone: "error",
      message:
        "Sebagian master data role gagal dimuat. Halaman memakai fallback default sampai backend kembali tersedia.",
    });
  }, [roleCatalogQuery.error, userRoleOptionsQuery.error]);

  const handleCreateUser = async (values: CreateManagedUserFormValues) => {
    if (createManagedUserMutation.isPending) {
      return;
    }

    if (!hasActiveRoleOptions) {
      setNotice({
        tone: "error",
        message: "Belum ada role aktif. Aktifkan User Role terlebih dahulu di Master Data.",
      });
      return;
    }

    const normalizedName = values.name.trim();
    const normalizedEmail = values.email.trim().toLowerCase();
    const normalizedPassword = values.password?.trim() ?? "";
    const isDuplicateEmail = users.some((user) => user.email.trim().toLowerCase() === normalizedEmail);

    if (isDuplicateEmail) {
      setNotice({
        tone: "error",
        message: "Email sudah terdaftar. Gunakan email lain.",
      });
      return;
    }

    try {
      await createManagedUserMutation.mutateAsync({
        name: normalizedName,
        email: normalizedEmail,
        roleId: values.roleId,
        password: normalizedPassword || undefined,
      });
      createForm.reset({
        name: "",
        email: "",
        roleId: defaultRoleId,
        password: "",
        confirmPassword: "",
      });
      closeCreateDrawer();
      setNotice({
        tone: "success",
        message: normalizedPassword
          ? `User ${normalizedName} berhasil ditambahkan dengan password awal.`
          : `User ${normalizedName} berhasil ditambahkan tanpa password awal.`,
      });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: extractErrorMessage(error, "User baru gagal dibuat di backend."),
      });
    }
  };

  const handleSubmitEditUser = async (values: ManagedUserFormValues) => {
    if (!editingUser || updateManagedUserMutation.isPending) {
      return;
    }

    if (!hasActiveRoleOptions) {
      setNotice({
        tone: "error",
        message: "Belum ada role aktif. Aktifkan User Role terlebih dahulu di Master Data.",
      });
      return;
    }

    const normalizedName = values.name.trim();
    const normalizedEmail = values.email.trim().toLowerCase();
    const isDuplicateEmail = users.some(
      (user) => user.id !== editingUser.id && user.email.trim().toLowerCase() === normalizedEmail,
    );

    if (isDuplicateEmail) {
      setNotice({
        tone: "error",
        message: "Email sudah dipakai user lain. Gunakan email yang berbeda.",
      });
      return;
    }

    try {
      const updatedFromBackend = await updateManagedUserMutation.mutateAsync({
        userId: editingUser.id,
        payload: {
          name: normalizedName,
          email: normalizedEmail,
          roleId: values.roleId,
        },
      });

      const selectedRoleLabel = roleCatalogById.get(updatedFromBackend.roleId)?.label ?? "Role";
      setNotice({
        tone: "success",
        message: `Data user ${normalizedName} berhasil diperbarui (${selectedRoleLabel}) dan tersimpan ke backend.`,
      });
      closeEditModal();
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: extractErrorMessage(error, "Perubahan user gagal disimpan ke backend."),
      });
    }
  };

  const handleConfirmDeleteUser = async () => {
    const targetUser = deleteTargetUser;
    if (!targetUser || deleteManagedUserMutation.isPending) {
      return;
    }

    try {
      await deleteManagedUserMutation.mutateAsync(targetUser.id);
      setNotice({
        tone: "success",
        message: `User ${targetUser.name} berhasil dihapus.`,
      });
      closeDeleteModal();
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: extractErrorMessage(error, "Penghapusan user gagal di backend."),
      });
    }
  };

  const handleSubmitManagedUserPassword = async (values: ResetManagedUserPasswordFormValues) => {
    const targetUser = passwordTargetUser;
    if (!targetUser || setManagedUserPasswordMutation.isPending) {
      return;
    }

    const normalizedPassword = values.password.trim();

    try {
      const updatedUser = await setManagedUserPasswordMutation.mutateAsync({
        userId: targetUser.id,
        password: normalizedPassword,
      });
      setNotice({
        tone: "success",
        message: updatedUser.hasPassword
          ? `Password untuk ${targetUser.name} berhasil ${targetUser.hasPassword ? "direset" : "diset"}.`
          : `Password untuk ${targetUser.name} belum tersimpan.`,
      });
      closePasswordModal();
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: extractErrorMessage(error, "Password user gagal diperbarui di backend."),
      });
    }
  };

  return {
    users,
    userRoleOptions,
    roleCatalogItems,
    roleCatalogById,
    managedUsersLoading: managedUsersQuery.isLoading,
    
    notice,
    setNotice,
    isCreateDrawerOpen,
    editingUser,
    deleteTargetUser,
    passwordTargetUser,
    totalSuperAdmin,
    totalUsersWithoutPassword,
    hasActiveRoleOptions,
    defaultRoleId,
    selectedCreateRole,
    isAnyOverlayOpen,
    isCreatePending: createManagedUserMutation.isPending,
    isUpdatePending: updateManagedUserMutation.isPending,
    isDeletePending: deleteManagedUserMutation.isPending,
    isPasswordPending: setManagedUserPasswordMutation.isPending,

    createForm,
    editForm,
    passwordForm,

    openCreateDrawer,
    closeCreateDrawer,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
    openPasswordModal,
    closePasswordModal,
    handleCreateUser,
    handleSubmitEditUser,
    handleConfirmDeleteUser,
    handleSubmitManagedUserPassword,
    resolveRoleToneClass,
    resolvePasswordToneClass,
  };
}
