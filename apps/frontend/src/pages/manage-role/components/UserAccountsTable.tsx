import { Button } from "../../../components/button";
import { useManageRoleContext } from "../context/ManageRoleContext";

export function UserAccountsTable() {
  const {
    users,
    managedUsersLoading,
    totalSuperAdmin,
    totalUsersWithoutPassword,
    roleCatalogById,
    openPasswordModal,
    openEditModal,
    openDeleteModal,
    resolveRoleToneClass,
    resolvePasswordToneClass,
  } = useManageRoleContext();

  return (
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
        {managedUsersLoading ? (
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
                        user.roleId
                      )}`}
                    >
                      {selectedRole?.label ?? "Role"}
                    </span>
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${resolvePasswordToneClass(
                        user.hasPassword
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
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-[40px] shrink-0 inline-flex items-center gap-1"
                    onClick={() => openPasswordModal(user)}
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      password
                    </span>
                    {user.hasPassword ? "Reset Password" : "Set Password"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-[40px] shrink-0 inline-flex items-center gap-1"
                    onClick={() => openEditModal(user)}
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      edit_square
                    </span>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="min-h-[40px] shrink-0 inline-flex items-center gap-1"
                    onClick={() => openDeleteModal(user)}
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      delete
                    </span>
                    Delete
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
