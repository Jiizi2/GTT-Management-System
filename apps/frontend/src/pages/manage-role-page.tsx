import { PageHeroSection } from "../components/page-hero-section";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { ManageRoleContext } from "./manage-role/context/ManageRoleContext";
import { useManageRole } from "./manage-role/hooks/use-manage-role";
import { UserAccountsTable } from "./manage-role/components/UserAccountsTable";
import { RoleCatalogCard } from "./manage-role/components/RoleCatalogCard";
import { ManageRoleModals } from "./manage-role/components/ManageRoleModals";

export function UserManagementScreen() {
  const value = useManageRole();
  const {
    users,
    userRoleOptions,
    managedUsersLoading,
    notice,
    totalUsersWithoutPassword,
    hasActiveRoleOptions,
    openCreateDrawer,
  } = value;

  return (
    <ManageRoleContext.Provider value={value}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
        <PageHeroSection
          eyebrow="User Access Control"
          title="User Management"
          description="Kelola akun pengguna, tambah user baru, dan atur role untuk kebutuhan operasional."
          actions={<ThemeToggleButton />}
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
                    {managedUsersLoading ? "..." : users.length}
                  </p>
                </article>

                <article className="rounded-2xl border border-outline-variant/35 bg-surface-container-low px-4 py-3.5">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Tanpa Password</p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-on-surface">
                    {managedUsersLoading ? "..." : totalUsersWithoutPassword}
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

          <UserAccountsTable />

          <div className="mx-5 h-px bg-surface-container-high sm:mx-7 lg:mx-9" />

          <RoleCatalogCard />
        </section>
      </div>

      <ManageRoleModals />
    </ManageRoleContext.Provider>
  );
}
