import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Controller } from "react-hook-form";
import { SereneSelect } from "../../../components/serene-select";
import { useManageRoleContext } from "../context/ManageRoleContext";

function UserManagementModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function ManageRoleModals() {
  const {
    users,
    userRoleOptions,
    isCreateDrawerOpen,
    editingUser,
    deleteTargetUser,
    passwordTargetUser,
    totalSuperAdmin,
    totalUsersWithoutPassword,
    hasActiveRoleOptions,
    defaultRoleId,
    selectedCreateRole,
    isCreatePending,
    isUpdatePending,
    isDeletePending,
    isPasswordPending,
    createForm,
    editForm,
    passwordForm,
    closeCreateDrawer,
    closeEditModal,
    closeDeleteModal,
    closePasswordModal,
    handleCreateUser,
    handleSubmitEditUser,
    handleConfirmDeleteUser,
    handleSubmitManagedUserPassword,
  } = useManageRoleContext();

  return (
    <>
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
                      {users.length}
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

              <div className="serene-dialog-footer-bar">
                <div className="serene-dialog-actions-stacked">
                  <button
                    type="button"
                    className="serene-btn-secondary"
                    onClick={closeCreateDrawer}
                    disabled={isCreatePending}
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    form="create-managed-user-form"
                    className="serene-btn-primary inline-flex items-center justify-center gap-1.5"
                    disabled={isCreatePending || !hasActiveRoleOptions}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      person_add
                    </span>
                    {isCreatePending ? "Menyimpan..." : "Tambah User"}
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
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
            onClick={closeEditModal}
          >
            <section
              className="serene-modal-shell w-full max-w-xl p-5 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit user ${editingUser.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="serene-dialog-icon bg-primary-fixed text-on-primary-fixed">
                <span className="material-symbols-outlined" aria-hidden="true">
                  edit_square
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">Edit User</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                Perbarui nama, email, dan role untuk user ini.
              </p>

              <form
                className="serene-dialog-body"
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

                <div className="serene-dialog-footer">
                  <button
                    type="button"
                    className="serene-btn-secondary"
                    onClick={closeEditModal}
                    disabled={isUpdatePending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="serene-btn-primary"
                    disabled={isUpdatePending || !hasActiveRoleOptions}
                  >
                    {isUpdatePending ? "Menyimpan..." : "Simpan Perubahan"}
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
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
            onClick={closePasswordModal}
          >
            <section
              className="serene-modal-shell w-full max-w-lg p-5 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`${passwordTargetUser.hasPassword ? "Reset" : "Set"} password ${passwordTargetUser.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="serene-dialog-icon bg-secondary-container text-on-secondary-container">
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

              <div className="serene-dialog-section text-xs font-medium leading-relaxed text-on-surface-variant">
                <p className="font-semibold text-on-surface">{passwordTargetUser.email}</p>
                <p className="mt-1">
                  Status saat ini: {passwordTargetUser.hasPassword ? "sudah punya password" : "belum punya password"}.
                </p>
              </div>

              <form
                className="serene-dialog-body"
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

                <div className="serene-dialog-footer">
                  <button
                    type="button"
                    className="serene-btn-secondary"
                    onClick={closePasswordModal}
                    disabled={isPasswordPending}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="serene-btn-primary"
                    disabled={isPasswordPending}
                  >
                    {isPasswordPending
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
            className="serene-modal-overlay fixed inset-0 z-[160] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
            onClick={closeDeleteModal}
          >
            <section
              className="serene-modal-shell w-full max-w-md p-5 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label={`Hapus user ${deleteTargetUser.name}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="serene-dialog-icon bg-error-container text-on-error-container">
                <span className="material-symbols-outlined" aria-hidden="true">
                  delete_forever
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">Hapus User?</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                User <strong>{deleteTargetUser.name}</strong> akan dihapus dari daftar. Tindakan ini tidak bisa
                dibatalkan.
              </p>

              <div className="serene-dialog-footer">
                <button
                  type="button"
                  className="serene-btn-secondary"
                  onClick={closeDeleteModal}
                  disabled={isDeletePending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="serene-btn-danger"
                  onClick={handleConfirmDeleteUser}
                  disabled={isDeletePending}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    delete
                  </span>
                  {isDeletePending ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </section>
          </div>
        </UserManagementModalPortal>
      ) : null}
    </>
  );
}
