import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import {
  type MasterDataOption,
} from "../hooks/use-master-data-backend";
import { useMasterDataOptionsQuery } from "../hooks/use-master-data-query";
import {
  useCreateManagedUserMutation,
  useDeleteManagedUserMutation,
  useManagedUsersQuery,
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

const roleIdSet = new Set<RoleId>([
  "super-admin",
  "admin",
  "finance-manager",
  "customer-support",
]);

const roleIdSchema = z.enum([
  "super-admin",
  "admin",
  "finance-manager",
  "customer-support",
]);

const managedUserFormSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi."),
  email: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Format email tidak valid. Contoh: user@ghaniyatravel.com."),
  roleId: roleIdSchema,
});

type ManagedUserFormValues = z.infer<typeof managedUserFormSchema>;

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
    .map(({ sortOrder, ...role }) => role);

  return mapped;
}

function mapBackendUserToLocal(user: BackendManagedUser): UserAccount {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
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
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<UserAccount | null>(null);

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

  const totalSuperAdmin = useMemo(
    () => users.filter((user) => user.roleId === "super-admin").length,
    [users],
  );
  const hasActiveRoleOptions = userRoleOptions.length > 0;
  const defaultRoleId = userRoleOptions[0]?.id ?? "admin";

  const createForm = useForm<ManagedUserFormValues>({
    resolver: zodResolver(managedUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      roleId: defaultRoleId,
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
      roleId: userRoleOptions.some((role) => role.id === editingUser.roleId)
        ? editingUser.roleId
        : defaultRoleId,
    });
  }, [defaultRoleId, editForm, editingUser, userRoleOptions]);

  const closeEditModal = () => {
    setEditingUser(null);
  };

  const closeDeleteModal = () => {
    setDeleteTargetUser(null);
  };

  const openEditModal = (user: UserAccount) => {
    setDeleteTargetUser(null);
    setEditingUser(user);
  };

  const openDeleteModal = (user: UserAccount) => {
    setEditingUser(null);
    setDeleteTargetUser(user);
  };

  useEffect(() => {
    if (!editingUser && !deleteTargetUser) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeEditModal();
        closeDeleteModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [deleteTargetUser, editingUser]);

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

  const handleCreateUser = async (values: ManagedUserFormValues) => {
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
      });
      createForm.reset({
        name: "",
        email: "",
        roleId: defaultRoleId,
      });
      setNotice({
        tone: "success",
        message: `User ${normalizedName} berhasil ditambahkan.`,
      });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: extractErrorMessage(
          error,
          "User baru gagal dibuat di backend.",
        ),
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
        message: extractErrorMessage(
          error,
          "Perubahan user gagal disimpan ke backend.",
        ),
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
        message: extractErrorMessage(
          error,
          "Penghapusan user gagal di backend.",
        ),
      });
    }
  };

  return (
    <>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="space-y-2">
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
                User Management
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
                Kelola akun pengguna, tambah user baru, dan atur role untuk kebutuhan operasional.
              </p>
            </div>

            <ThemeToggleButton className="inline-flex h-10 w-10 shrink-0 self-end items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary sm:ml-auto sm:mr-5 sm:self-auto" />
          </header>

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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                  Create User
                </h2>
                <span className="text-xs font-semibold text-on-surface-variant">
                  Total user: {managedUsersQuery.isLoading ? "..." : users.length}
                </span>
              </div>

              <form
                className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1.1fr_0.8fr_auto]"
                onSubmit={createForm.handleSubmit((values) => void handleCreateUser(values))}
              >
                <div className="grid gap-1">
                  <input
                    className="serene-input"
                    {...createForm.register("name")}
                    placeholder="Nama lengkap"
                    aria-label="Nama lengkap user baru"
                  />
                  {createForm.formState.errors.name ? (
                    <p className="text-xs font-semibold text-error">
                      {createForm.formState.errors.name.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <input
                    className="serene-input"
                    {...createForm.register("email")}
                    placeholder="email@ghaniyatravel.com"
                    type="email"
                    aria-label="Email user baru"
                  />
                  {createForm.formState.errors.email ? (
                    <p className="text-xs font-semibold text-error">
                      {createForm.formState.errors.email.message}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-1">
                  <Controller
                    name="roleId"
                    control={createForm.control}
                    render={({ field }) => (
                      <SereneSelect
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
                <button
                  type="submit"
                  className="serene-btn-primary min-h-[44px] whitespace-nowrap px-4"
                  disabled={createManagedUserMutation.isPending || !hasActiveRoleOptions}
                >
                  {createManagedUserMutation.isPending ? "Menyimpan..." : "Tambah User"}
                </button>
              </form>
              {!hasActiveRoleOptions ? (
                <p className="mt-3 text-xs font-semibold text-error">
                  Belum ada role aktif. Aktifkan kategori <strong>User Role</strong> di Master Data sebelum menambah user.
                </p>
              ) : null}
            </div>

            <div className="mx-5 h-px bg-surface-container-high sm:mx-7 lg:mx-9" />

            <div className="p-5 sm:p-7 lg:p-9">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                  User Directory
                </h2>
                <span className="text-xs font-semibold text-on-surface-variant">
                  Super Admin aktif: {totalSuperAdmin}
                </span>
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
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                Role Catalog
              </h2>
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {roleCatalogItems.length === 0 ? (
                  <div className="rounded-2xl border border-outline-variant/35 bg-surface-container-low p-5 text-sm font-medium text-on-surface-variant">
                    Belum ada Role Catalog yang aktif. Aktifkan option pada kategori <strong>Role Catalog</strong> di Master Data.
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

                      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                        {role.description}
                      </p>

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

      {editingUser ? (
        <UserManagementModalPortal>
          <div
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4"
            onClick={closeEditModal}
            aria-hidden="true"
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

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">
                Edit User
              </h3>
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
                    <p className="text-xs font-semibold text-error">
                      {editForm.formState.errors.name.message}
                    </p>
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
                    <p className="text-xs font-semibold text-error">
                      {editForm.formState.errors.email.message}
                    </p>
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

      {deleteTargetUser ? (
        <UserManagementModalPortal>
          <div
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-4"
            onClick={closeDeleteModal}
            aria-hidden="true"
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

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">
                Hapus User?
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                User <strong>{deleteTargetUser.name}</strong> akan dihapus dari daftar. Tindakan ini tidak bisa dibatalkan.
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

