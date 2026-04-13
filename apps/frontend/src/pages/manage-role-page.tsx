import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod/v4";
import { PageHeroSection } from "../components/page-hero-section";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { type MasterDataOption } from "../hooks/use-master-data-backend";
import { useMasterDataOptionsQuery } from "../hooks/use-master-data-query";
import {
  useCreateManagedUserMutation,
  useDeleteManagedUserMutation,
  useManagedUsersQuery,
  useSetManagedUserPasswordMutation,
  useUpdateManagedUserMutation,
} from "../hooks/use-user-management-query";
import type { BackendManagedUser } from "../hooks/use-user-management-backend";

type RoleId = BackendManagedUser["roleId"];

type RoleCatalogItem = {
  id: string;
  label: string;
  description: string;
  permissions: string[];
};

type UserRoleOption = {
  id: RoleId;
  label: string;
  description: string;
  sortOrder: number;
};

type UserAccount = {
  id: string;
  name: string;
  email: string;
  roleId: RoleId;
  hasPassword: boolean;
};

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

type ManagedUserFormValues = z.infer<typeof managedUserFormSchema>;
type CreateManagedUserFormValues = z.infer<typeof createManagedUserFormSchema>;
type ResetManagedUserPasswordFormValues = z.infer<typeof resetManagedUserPasswordFormSchema>;

const defaultUserRoleOptions: UserRoleOption[] = defaultRoleCatalog
  .filter((role): role is RoleCatalogItem & { id: RoleId } => roleIdSet.has(role.id as RoleId))
  .map((role, index) => ({
    id: role.id,
    label: role.label,
    description: role.description,
    sortOrder: index + 1,
  }));

function UserManagementModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

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

  const rawPermissions = metadata.permissions;
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

export function UserManagementScreen() {
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
    const normalizedPassword = values.password.trim();
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

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
        <PageHeroSection
          eyebrow="User Access Control"
          title="User Management"
          description="Kelola akun pengguna, tambah user baru, dan atur role untuk kebutuhan operasional."
          actions={
            <ThemeToggleButton className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary" />
          }
        />

        {notice ? (
          <div
            className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-ambient ${
              notice.tone === "success"
                ? "border-primary/25 bg-primary-fixed text-on-primary-fixed-variant"
                : "border-error/25 bg-error-container/60 text-on-error-container"
            }`}
            role="status"
            aria-live="polite"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {notice.tone === "success" ? "check_circle" : "error"}
            </span>
            <p className="leading-relaxed">{notice.message}</p>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-outline-variant/35 bg-surface-container-lowest shadow-ambient">
          <div className="p-5 sm:p-7 lg:p-9">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Create User</h2>
                  <p className="mt-2 text-sm font-medium text-on-surface-variant">
                    Tambah akun baru lewat panel samping.
                  </p>
                </div>

                <button
                  type="button"
                  className="serene-btn-primary inline-flex min-h-[46px] w-full items-center justify-center gap-1.5 px-5 sm:w-auto"
                  onClick={openCreateDrawer}
                  disabled={!hasActiveRoleOptions}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    person_add
                  </span>
                  Tambah User
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-low px-4 py-3.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Total User</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-on-surface">
                    {managedUsersQuery.isLoading ? "..." : users.length}
                  </p>
                </article>

                <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-low px-4 py-3.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Tanpa Password</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-on-surface">
                    {managedUsersQuery.isLoading ? "..." : totalUsersWithoutPassword}
                  </p>
                </article>

                <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-low px-4 py-3.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Role Aktif</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-on-surface">{userRoleOptions.length}</p>
                </article>
              </div>
            </div>
            {!hasActiveRoleOptions ? (
              <p className="mt-3 text-xs font-semibold text-error">
                Belum ada role aktif. Aktifkan kategori <strong>User Role</strong> di Master Data sebelum menambah user.
              </p>
            ) : (
              <p className="mt-3 text-xs font-medium leading-relaxed text-on-surface-variant">
                Password awal opsional. Hak akses tetap mengikuti role.
              </p>
            )}
          </div>

          <div className="mx-5 h-px bg-surface-container-high sm:mx-7 lg:mx-9" />

          <div className="p-5 sm:p-7 lg:p-9">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">User Directory</h2>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-on-surface-variant">
                <span>Super Admin aktif: {totalSuperAdmin}</span>
                <span className="hidden h-1 w-1 rounded-full bg-outline-variant/70 sm:inline-flex" aria-hidden="true" />
                <span>Belum ada password: {totalUsersWithoutPassword}</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-outline-variant/35 bg-surface-container-low">
              {managedUsersQuery.isLoading ? (
                <div className="px-4 py-6 text-sm font-medium text-on-surface-variant">
                  Memuat data user dari backend...
                </div>
              ) : users.length === 0 ? (
                <div className="px-4 py-6 text-sm font-medium text-on-surface-variant">
                  Belum ada data user pada backend.
                </div>
              ) : (
                users.map((user) => {
                  const selectedRole = roleCatalogById.get(user.roleId);
                  return (
                    <div
                      key={user.id}
                      className="grid gap-3 border-b border-outline-variant/25 px-4 py-4 last:border-b-0 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-on-surface">{user.name}</p>
                        <p className="break-all text-xs text-on-surface-variant">{user.email}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-md border border-outline-variant/40 bg-surface-container-lowest px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-variant">
                            Status Role
                          </span>
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${resolveRoleToneClass(
                              user.roleId,
                            )}`}
                          >
                            {selectedRole?.label ?? "Role"}
                          </span>
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${resolvePasswordToneClass(
                              user.hasPassword,
                            )}`}
                          >
                            {user.hasPassword ? "Password Ready" : "No Password"}
                          </span>
                        </div>

                        {selectedRole ? (
                          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant/80">
                            {selectedRole.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                        <button
                          type="button"
                          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high"
                          onClick={() => openPasswordModal(user)}
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            password
                          </span>
                          {user.hasPassword ? "Reset Password" : "Set Password"}
                        </button>
                        <button
                          type="button"
                          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition hover:bg-surface-container-high"
                          onClick={() => openEditModal(user)}
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            edit_square
                          </span>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1 rounded-lg border border-error/35 bg-error-container/40 px-3 text-xs font-semibold text-on-error-container transition hover:brightness-95"
                          onClick={() => openDeleteModal(user)}
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            delete
                          </span>
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mx-5 h-px bg-surface-container-high sm:mx-7 lg:mx-9" />

          <div className="p-5 sm:p-7 lg:p-9">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Role Catalog</h2>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {roleCatalogItems.length === 0 ? (
                <div className="rounded-2xl border border-outline-variant/35 bg-surface-container-low p-5 text-sm font-medium text-on-surface-variant">
                  Belum ada Role Catalog yang aktif. Aktifkan option pada kategori <strong>Role Catalog</strong> di
                  Master Data.
                </div>
              ) : (
                roleCatalogItems.map((role) => (
                  <article
                    key={role.id}
                    className="rounded-2xl border border-outline-variant/35 bg-surface-container-low p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-on-surface">{role.label}</h3>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${resolveRoleToneClass(
                          role.id,
                        )}`}
                      >
                        {role.permissions.length} permissions
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">{role.description}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {role.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="inline-flex rounded-md border border-outline-variant/35 bg-surface-container-lowest px-2 py-1 text-[10px] font-black tracking-[0.08em] text-on-surface-variant"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {isCreateDrawerOpen ? (
        <UserManagementModalPortal>
          <div
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-stretch justify-end"
            onClick={closeCreateDrawer}
          >
            <section
              className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-outline-variant/35 bg-surface-container-lowest shadow-float"
              role="dialog"
              aria-modal="true"
              aria-label="Tambah user baru"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-outline-variant/25 px-5 py-5 sm:px-6">
                <div className="min-w-0">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      person_add
                    </span>
                  </div>

                  <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">
                    Tambah User Baru
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">
                    Isi identitas user, pilih role, lalu tentukan apakah akun perlu password awal atau cukup dibuat
                    dulu.
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant transition hover:border-primary hover:text-primary"
                  onClick={closeCreateDrawer}
                  aria-label="Close create user drawer"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    close
                  </span>
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-low p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Total User</p>
                    <p className="mt-2 text-xl font-black tracking-tight text-on-surface">
                      {managedUsersQuery.isLoading ? "..." : users.length}
                    </p>
                  </article>

                  <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-low p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Super Admin</p>
                    <p className="mt-2 text-xl font-black tracking-tight text-on-surface">{totalSuperAdmin}</p>
                  </article>

                  <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-low p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Belum Password</p>
                    <p className="mt-2 text-xl font-black tracking-tight text-on-surface">
                      {totalUsersWithoutPassword}
                    </p>
                  </article>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                  <form
                    id="create-managed-user-form"
                    className="grid gap-4"
                    onSubmit={createForm.handleSubmit((values) => void handleCreateUser(values))}
                  >
                    <div className="grid gap-1.5">
                      <label className="text-xs font-semibold text-on-surface-variant" htmlFor="create-user-name">
                        Nama Lengkap
                      </label>
                      <input
                        id="create-user-name"
                        className="serene-input"
                        {...createForm.register("name")}
                        placeholder="Nama lengkap"
                        aria-label="Nama lengkap user baru"
                        autoFocus
                      />
                      {createForm.formState.errors.name ? (
                        <p className="text-xs font-semibold text-error">{createForm.formState.errors.name.message}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-1.5">
                      <label className="text-xs font-semibold text-on-surface-variant" htmlFor="create-user-email">
                        Email
                      </label>
                      <input
                        id="create-user-email"
                        className="serene-input"
                        {...createForm.register("email")}
                        placeholder="email@ghaniyatravel.com"
                        type="email"
                        aria-label="Email user baru"
                      />
                      {createForm.formState.errors.email ? (
                        <p className="text-xs font-semibold text-error">{createForm.formState.errors.email.message}</p>
                      ) : null}
                    </div>

                    <div className="grid gap-1.5">
                      <label className="text-xs font-semibold text-on-surface-variant" htmlFor="create-user-role">
                        Role
                      </label>
                      <Controller
                        name="roleId"
                        control={createForm.control}
                        render={({ field }) => (
                          <SereneSelect
                            id="create-user-role"
                            className="serene-select"
                            value={field.value}
                            onChange={(event) => field.onChange(event.target.value)}
                            aria-label="Role user baru"
                            disabled={!hasActiveRoleOptions}
                          >
                            {hasActiveRoleOptions ? (
                              userRoleOptions.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.label}
                                </option>
                              ))
                            ) : (
                              <option value="admin">Belum ada role aktif</option>
                            )}
                          </SereneSelect>
                        )}
                      />
                    </div>

                    <div className="rounded-3xl border border-outline-variant/35 bg-surface-container-low p-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">
                          lock
                        </span>
                        <h4 className="text-sm font-bold text-on-surface">Provision Password</h4>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">
                        Kosongkan dua field berikut bila akun cukup dibuat dulu dan password akan diatur belakangan.
                      </p>

                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-1.5">
                          <label
                            className="text-xs font-semibold text-on-surface-variant"
                            htmlFor="create-user-password"
                          >
                            Password Awal
                          </label>
                          <input
                            id="create-user-password"
                            className="serene-input"
                            {...createForm.register("password")}
                            placeholder="Password awal (opsional)"
                            type="password"
                            aria-label="Password awal user baru"
                            autoComplete="new-password"
                          />
                          {createForm.formState.errors.password ? (
                            <p className="text-xs font-semibold text-error">
                              {createForm.formState.errors.password.message}
                            </p>
                          ) : (
                            <p className="text-[11px] font-medium leading-relaxed text-on-surface-variant/75">
                              Minimal 8 karakter bila password awal ingin langsung diaktifkan.
                            </p>
                          )}
                        </div>

                        <div className="grid gap-1.5">
                          <label
                            className="text-xs font-semibold text-on-surface-variant"
                            htmlFor="create-user-confirm-password"
                          >
                            Konfirmasi Password
                          </label>
                          <input
                            id="create-user-confirm-password"
                            className="serene-input"
                            {...createForm.register("confirmPassword")}
                            placeholder="Konfirmasi password"
                            type="password"
                            aria-label="Konfirmasi password user baru"
                            autoComplete="new-password"
                          />
                          {createForm.formState.errors.confirmPassword ? (
                            <p className="text-xs font-semibold text-error">
                              {createForm.formState.errors.confirmPassword.message}
                            </p>
                          ) : (
                            <p className="text-[11px] font-medium leading-relaxed text-on-surface-variant/75">
                              Hanya perlu diisi saat kamu menetapkan password awal.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {!hasActiveRoleOptions ? (
                      <p className="text-xs font-semibold text-error">
                        Belum ada role aktif. Aktifkan kategori <strong>User Role</strong> di Master Data sebelum
                        menambah user.
                      </p>
                    ) : null}
                  </form>

                  <aside className="rounded-3xl border border-outline-variant/35 bg-surface-container-low p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Ringkasan Akses</p>
                    <h4 className="mt-2 text-lg font-bold text-on-surface">
                      {selectedCreateRole?.label ?? "Pilih role"}
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                      {selectedCreateRole?.description ||
                        "Role menentukan area dashboard dan level akses yang akan dimiliki user baru."}
                    </p>

                    {selectedCreateRole && selectedCreateRole.permissions.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedCreateRole.permissions.map((permission) => (
                          <span
                            key={permission}
                            className="inline-flex rounded-md border border-outline-variant/35 bg-surface-container-lowest px-2 py-1 text-[10px] font-black tracking-[0.08em] text-on-surface-variant"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-2xl border border-outline-variant/35 bg-surface-container-lowest px-4 py-3 text-xs leading-relaxed text-on-surface-variant">
                      <p className="font-semibold text-on-surface">Provisioning note</p>
                      <p className="mt-1">
                        Password hanya menandakan akun sudah diprovision. Hak akses tetap mengikuti role dan pembatasan
                        backend.
                      </p>
                    </div>
                  </aside>
                </div>
              </div>

              <div className="border-t border-outline-variant/25 px-5 py-4 sm:px-6">
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="serene-btn-secondary"
                    onClick={closeCreateDrawer}
                    disabled={createManagedUserMutation.isPending}
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    form="create-managed-user-form"
                    className="serene-btn-primary inline-flex items-center justify-center gap-1.5"
                    disabled={createManagedUserMutation.isPending || !hasActiveRoleOptions}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      person_add
                    </span>
                    {createManagedUserMutation.isPending ? "Menyimpan..." : "Tambah User"}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </UserManagementModalPortal>
      ) : null}

      {editingUser ? (
        <UserManagementModalPortal>
          <div
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4"
            onClick={closeEditModal}
          >
            <section
              className="serene-modal-shell w-full max-w-xl p-5 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit user ${editingUser.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed">
                <span className="material-symbols-outlined" aria-hidden="true">
                  edit_square
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">Edit User</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                Perbarui nama, email, dan role untuk user ini.
              </p>

              <form
                className="mt-5 grid gap-3"
                onSubmit={editForm.handleSubmit((values) => void handleSubmitEditUser(values))}
              >
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant" htmlFor="edit-user-name">
                    Nama Lengkap
                  </label>
                  <input
                    id="edit-user-name"
                    className="serene-input"
                    {...editForm.register("name")}
                    placeholder="Nama lengkap"
                    autoFocus
                  />
                  {editForm.formState.errors.name ? (
                    <p className="text-xs font-semibold text-error">{editForm.formState.errors.name.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant" htmlFor="edit-user-email">
                    Email
                  </label>
                  <input
                    id="edit-user-email"
                    className="serene-input"
                    {...editForm.register("email")}
                    placeholder="email@ghaniyatravel.com"
                    type="email"
                  />
                  {editForm.formState.errors.email ? (
                    <p className="text-xs font-semibold text-error">{editForm.formState.errors.email.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant" htmlFor="edit-user-role">
                    Role
                  </label>
                  <Controller
                    name="roleId"
                    control={editForm.control}
                    render={({ field }) => (
                      <SereneSelect
                        id="edit-user-role"
                        className="serene-select"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        disabled={!hasActiveRoleOptions}
                      >
                        {hasActiveRoleOptions ? (
                          userRoleOptions.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.label}
                            </option>
                          ))
                        ) : (
                          <option value="admin">Belum ada role aktif</option>
                        )}
                      </SereneSelect>
                    )}
                  />
                </div>
                {!hasActiveRoleOptions ? (
                  <p className="text-xs font-semibold text-error">
                    Belum ada role aktif. Aktifkan kategori <strong>User Role</strong> di Master Data.
                  </p>
                ) : null}

                <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="serene-btn-secondary"
                    onClick={closeEditModal}
                    disabled={updateManagedUserMutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="serene-btn-primary"
                    disabled={updateManagedUserMutation.isPending || !hasActiveRoleOptions}
                  >
                    {updateManagedUserMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </UserManagementModalPortal>
      ) : null}

      {passwordTargetUser ? (
        <UserManagementModalPortal>
          <div
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4"
            onClick={closePasswordModal}
          >
            <section
              className="serene-modal-shell w-full max-w-lg p-5 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`${passwordTargetUser.hasPassword ? "Reset" : "Set"} password ${passwordTargetUser.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
                <span className="material-symbols-outlined" aria-hidden="true">
                  password
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">
                {passwordTargetUser.hasPassword ? "Reset Password" : "Set Password"}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                {passwordTargetUser.hasPassword
                  ? `Masukkan password baru untuk ${passwordTargetUser.name}.`
                  : `Buat password awal untuk ${passwordTargetUser.name} agar akun ini siap dipakai.`}
              </p>

              <div className="mt-4 rounded-2xl border border-outline-variant/35 bg-surface-container-low px-4 py-3 text-xs font-medium leading-relaxed text-on-surface-variant">
                <p className="font-semibold text-on-surface">{passwordTargetUser.email}</p>
                <p className="mt-1">
                  Status saat ini: {passwordTargetUser.hasPassword ? "sudah punya password" : "belum punya password"}.
                </p>
              </div>

              <form
                className="mt-5 grid gap-3"
                onSubmit={passwordForm.handleSubmit((values) => void handleSubmitManagedUserPassword(values))}
              >
                <div className="grid gap-1.5">
                  <label className="text-xs font-semibold text-on-surface-variant" htmlFor="managed-user-password">
                    Password Baru
                  </label>
                  <input
                    id="managed-user-password"
                    className="serene-input"
                    {...passwordForm.register("password")}
                    type="password"
                    placeholder="Minimal 8 karakter"
                    autoComplete="new-password"
                    autoFocus
                  />
                  {passwordForm.formState.errors.password ? (
                    <p className="text-xs font-semibold text-error">{passwordForm.formState.errors.password.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-1.5">
                  <label
                    className="text-xs font-semibold text-on-surface-variant"
                    htmlFor="managed-user-password-confirm"
                  >
                    Konfirmasi Password
                  </label>
                  <input
                    id="managed-user-password-confirm"
                    className="serene-input"
                    {...passwordForm.register("confirmPassword")}
                    type="password"
                    placeholder="Ulangi password yang sama"
                    autoComplete="new-password"
                  />
                  {passwordForm.formState.errors.confirmPassword ? (
                    <p className="text-xs font-semibold text-error">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="serene-btn-secondary"
                    onClick={closePasswordModal}
                    disabled={setManagedUserPasswordMutation.isPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="serene-btn-primary"
                    disabled={setManagedUserPasswordMutation.isPending}
                  >
                    {setManagedUserPasswordMutation.isPending
                      ? "Menyimpan..."
                      : passwordTargetUser.hasPassword
                        ? "Reset Password"
                        : "Simpan Password"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        </UserManagementModalPortal>
      ) : null}

      {deleteTargetUser ? (
        <UserManagementModalPortal>
          <div
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4"
            onClick={closeDeleteModal}
          >
            <section
              className="serene-modal-shell w-full max-w-md p-5 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`Hapus user ${deleteTargetUser.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-error-container text-on-error-container">
                <span className="material-symbols-outlined" aria-hidden="true">
                  delete_forever
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">Hapus User?</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                User <strong>{deleteTargetUser.name}</strong> akan dihapus dari daftar. Tindakan ini tidak bisa
                dibatalkan.
              </p>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="serene-btn-secondary"
                  onClick={closeDeleteModal}
                  disabled={deleteManagedUserMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-error-container px-4 py-2 text-sm font-semibold text-on-error-container transition hover:brightness-95"
                  onClick={handleConfirmDeleteUser}
                  disabled={deleteManagedUserMutation.isPending}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    delete
                  </span>
                  {deleteManagedUserMutation.isPending ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </section>
          </div>
        </UserManagementModalPortal>
      ) : null}
    </>
  );
}
