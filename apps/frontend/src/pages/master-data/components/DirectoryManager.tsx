import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SereneSelect } from "../../../components/serene-select";
import {
  createDriver,
  createMuassasah,
  deleteDriver,
  deleteMuassasah,
  useDriversQuery,
  useMuassasahQuery,
} from "../../../hooks/use-directory-backend";

const CARD = "min-w-0 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-ambient";
const INPUT = "h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-brand-primary";
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold leading-none text-on-primary transition hover:brightness-95 disabled:opacity-50";

export function DirectoryManager() {
  const queryClient = useQueryClient();
  const muassasahQuery = useMuassasahQuery();
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const driversQuery = useDriversQuery(driverFilter === "all" ? undefined : driverFilter);

  const [newMuassasah, setNewMuassasah] = useState("");
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", plateNumber: "", muassasahId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const muassasahList = useMemo(() => muassasahQuery.data ?? [], [muassasahQuery.data]);
  const drivers = driversQuery.data ?? [];

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["directory", "muassasah"] }),
      queryClient.invalidateQueries({ queryKey: ["directory", "drivers"] }),
    ]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await invalidate();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  };

  const handleAddMuassasah = () => {
    const name = newMuassasah.trim();
    if (!name) return;
    void run(async () => {
      await createMuassasah(name);
      setNewMuassasah("");
    });
  };

  const handleAddDriver = () => {
    const name = driverForm.name.trim();
    if (!name) return;
    void run(async () => {
      await createDriver({
        name,
        phone: driverForm.phone,
        plateNumber: driverForm.plateNumber,
        muassasahId: driverForm.muassasahId || undefined,
      });
      setDriverForm({ name: "", phone: "", plateNumber: "", muassasahId: driverForm.muassasahId });
    });
  };

  return (
    <div className="grid min-w-0 gap-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {/* Muassasah */}
      <article className={CARD}>
        <div className="border-b border-outline-variant/30 px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">Muassasah</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">Daftar muassasah tempat supir bernaung.</p>
        </div>
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row">
          <input
            className={INPUT}
            placeholder="Nama muassasah (mis. Daleel Maalem)"
            value={newMuassasah}
            onChange={(event) => setNewMuassasah(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAddMuassasah()}
          />
          <button type="button" className={`${BTN} sm:w-auto`} onClick={handleAddMuassasah} disabled={busy || !newMuassasah.trim()}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
            Tambah
          </button>
        </div>
        <div className="px-4 pb-3">
          {muassasahList.length === 0 ? (
            <p className="py-2 text-xs text-on-surface-variant">Belum ada muassasah.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/30">
              {muassasahList.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-on-surface">{item.name}</span>
                    <span className="text-[11px] text-on-surface-variant">{item.driverCount} supir</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-rose-50 hover:text-rose-600"
                    title="Hapus muassasah"
                    onClick={() => void run(() => deleteMuassasah(item.id))}
                    disabled={busy}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      {/* Drivers */}
      <article className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-on-surface">Supir</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">Direktori supir, terikat ke muassasah.</p>
          </div>
          <SereneSelect
            className="serene-select h-9 text-xs"
            value={driverFilter}
            onChange={(event) => setDriverFilter(event.target.value)}
            aria-label="Filter supir per muassasah"
          >
            <option value="all">Semua muassasah</option>
            {muassasahList.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </SereneSelect>
        </div>

        <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className={INPUT} placeholder="Nama supir" value={driverForm.name} onChange={(e) => setDriverForm((s) => ({ ...s, name: e.target.value }))} />
          <input className={INPUT} placeholder="No. HP (opsional)" value={driverForm.phone} onChange={(e) => setDriverForm((s) => ({ ...s, phone: e.target.value }))} />
          <input className={INPUT} placeholder="Plat (opsional)" value={driverForm.plateNumber} onChange={(e) => setDriverForm((s) => ({ ...s, plateNumber: e.target.value }))} />
          <SereneSelect
            className="serene-select h-9"
            value={driverForm.muassasahId}
            onChange={(e) => setDriverForm((s) => ({ ...s, muassasahId: e.target.value }))}
            aria-label="Muassasah supir"
          >
            <option value="">Tanpa muassasah</option>
            {muassasahList.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </SereneSelect>
        </div>
        <div className="px-4 pb-3">
          <button type="button" className={BTN} onClick={handleAddDriver} disabled={busy || !driverForm.name.trim()}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
            Tambah supir
          </button>
        </div>

        <div className="px-4 pb-4">
          {drivers.length === 0 ? (
            <p className="py-2 text-xs text-on-surface-variant">Belum ada supir.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/30">
              {drivers.map((driver) => (
                <li key={driver.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-on-surface">{driver.name}</span>
                    <span className="block truncate text-[11px] text-on-surface-variant">
                      {[driver.muassasahName ?? "Tanpa muassasah", driver.phone, driver.plateNumber].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-rose-50 hover:text-rose-600"
                    title="Hapus supir"
                    onClick={() => void run(() => deleteDriver(driver.id))}
                    disabled={busy}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </div>
  );
}
