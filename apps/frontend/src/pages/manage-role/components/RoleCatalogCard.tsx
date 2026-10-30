import { useManageRoleContext } from "../context/ManageRoleContext";
import { DataBoundary } from "../../../components/data-boundary";
import { ListSkeleton } from "../../../components/skeleton";

export function RoleCatalogCard() {
  const { roleCatalogItems, resolveRoleToneClass, roleCatalogQuery } = useManageRoleContext();

  return (
    <div className="p-5 sm:p-7 lg:p-9">
      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Role Catalog</h2>
      <DataBoundary query={roleCatalogQuery} skeleton={<ListSkeleton columns={2} rows={3} label="Memuat role…" />}>
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
                    role.id
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
      </DataBoundary>
    </div>
  );
}
