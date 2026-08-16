import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SereneSelect } from "../../../components/serene-select";
import {
  createDriver,
  createMuassasah,
  createVehicle,
  deleteDriver,
  deleteMuassasah,
  deleteVehicle,
  updateDriver,
  updateVehicle,
  useDriversQuery,
  useMuassasahQuery,
  useVehiclesQuery,
  type MuassasahOption,
} from "../../../hooks/use-directory-backend";

const CARD = "min-w-0 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-ambient";
const INPUT = "h-9 w-full rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-3 text-sm text-on-surface outline-none focus:border-brand-primary";
const BTN = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold leading-none text-on-primary transition hover:brightness-95 disabled:opacity-50";
const ICON_BTN = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high";
const PROBLEM_BADGE = "inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700";

function MuassasahSelect({
  value,
  onChange,
  list,
  ariaLabel,
  includeAll,
}: {
  value: string;
  onChange: (value: string) => void;
  list: MuassasahOption[];
  ariaLabel: string;
  includeAll?: boolean;
}) {
  return (
    <SereneSelect className="serene-select h-9" value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
      <option value={includeAll ? "all" : ""}>{includeAll ? "Semua muassasah" : "Tanpa muassasah"}</option>
      {list.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}
        </option>
      ))}
    </SereneSelect>
  );
}

export function DirectoryManager() {
  const queryClient = useQueryClient();
  const muassasahQuery = useMuassasahQuery();
  const muassasahList = muassasahQuery.data ?? [];

  const [driverFilter, setDriverFilter] = useState("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const driversQuery = useDriversQuery(driverFilter === "all" ? undefined : driverFilter);
  const vehiclesQuery = useVehiclesQuery(vehicleFilter === "all" ? undefined : vehicleFilter);

  const [newMuassasah, setNewMuassasah] = useState("");
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", note: "", muassasahId: "" });
  const [vehicleForm, setVehicleForm] = useState({ plateNumber: "", note: "", muassasahId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["directory"] });

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

  const drivers = driversQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];

  return (
    <div className="grid min-w-0 gap-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>
      ) : null}

      {/* Muassasah */}
      <article className={CARD}>
        <div className="border-b border-outline-variant/30 px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">Muassasah</h2>
          <p className="mt-0.5 text-xs text-on-surface-variant">Perusahaan tempat supir & bis bernaung.</p>
        </div>
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row">
          <input
            className={INPUT}
            placeholder="Nama muassasah (mis. Daleel Maalem)"
            value={newMuassasah}
            onChange={(event) => setNewMuassasah(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && newMuassasah.trim() && void run(async () => {
              await createMuassasah(newMuassasah);
              setNewMuassasah("");
            })}
          />
          <button
            type="button"
            className={`${BTN} sm:w-auto`}
            disabled={busy || !newMuassasah.trim()}
            onClick={() => void run(async () => {
              await createMuassasah(newMuassasah);
              setNewMuassasah("");
            })}
          >
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
                    <span className="text-[11px] text-on-surface-variant">{item.driverCount} supir · {item.vehicleCount} bis</span>
                  </div>
                  <button type="button" className={`${ICON_BTN} hover:text-rose-600`} title="Hapus muassasah" disabled={busy} onClick={() => void run(() => deleteMuassasah(item.id))}>
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
          <MuassasahSelect value={driverFilter} onChange={setDriverFilter} list={muassasahList} ariaLabel="Filter supir per muassasah" includeAll />
        </div>
        <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className={INPUT} placeholder="Nama supir" value={driverForm.name} onChange={(e) => setDriverForm((s) => ({ ...s, name: e.target.value }))} />
          <input className={INPUT} placeholder="No. HP (opsional)" value={driverForm.phone} onChange={(e) => setDriverForm((s) => ({ ...s, phone: e.target.value }))} />
          <input className={INPUT} placeholder="Catatan (opsional)" value={driverForm.note} onChange={(e) => setDriverForm((s) => ({ ...s, note: e.target.value }))} />
          <MuassasahSelect value={driverForm.muassasahId} onChange={(v) => setDriverForm((s) => ({ ...s, muassasahId: v }))} list={muassasahList} ariaLabel="Muassasah supir" />
        </div>
        <div className="px-4 pb-3">
          <button
            type="button"
            className={BTN}
            disabled={busy || !driverForm.name.trim()}
            onClick={() => void run(async () => {
              await createDriver({ name: driverForm.name, phone: driverForm.phone, note: driverForm.note, muassasahId: driverForm.muassasahId || undefined });
              setDriverForm({ name: "", phone: "", note: "", muassasahId: driverForm.muassasahId });
            })}
          >
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
                    <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                      <span className="truncate">{driver.name}</span>
                      {driver.isProblematic ? (
                        <span className={PROBLEM_BADGE}>
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">warning</span>Bermasalah
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-on-surface-variant">
                      {[driver.muassasahName ?? "Tanpa muassasah", driver.phone, driver.note].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={`${ICON_BTN} ${driver.isProblematic ? "text-rose-600" : "hover:text-rose-600"}`}
                      title={driver.isProblematic ? "Hapus penanda bermasalah" : "Tandai bermasalah"}
                      disabled={busy}
                      onClick={() => void run(() => updateDriver(driver.id, { isProblematic: !driver.isProblematic }))}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">{driver.isProblematic ? "flag" : "outlined_flag"}</span>
                    </button>
                    <button type="button" className={`${ICON_BTN} hover:text-rose-600`} title="Hapus supir" disabled={busy} onClick={() => void run(() => deleteDriver(driver.id))}>
                      <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      {/* Vehicles */}
      <article className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-on-surface">Kendaraan / Bis</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">Direktori plat kendaraan, terikat ke muassasah.</p>
          </div>
          <MuassasahSelect value={vehicleFilter} onChange={setVehicleFilter} list={muassasahList} ariaLabel="Filter kendaraan per muassasah" includeAll />
        </div>
        <div className="grid gap-2 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          <input className={INPUT} placeholder="Plat nomor (mis. B 1234 ABC)" value={vehicleForm.plateNumber} onChange={(e) => setVehicleForm((s) => ({ ...s, plateNumber: e.target.value }))} />
          <input className={INPUT} placeholder="Catatan (opsional)" value={vehicleForm.note} onChange={(e) => setVehicleForm((s) => ({ ...s, note: e.target.value }))} />
          <MuassasahSelect value={vehicleForm.muassasahId} onChange={(v) => setVehicleForm((s) => ({ ...s, muassasahId: v }))} list={muassasahList} ariaLabel="Muassasah kendaraan" />
        </div>
        <div className="px-4 pb-3">
          <button
            type="button"
            className={BTN}
            disabled={busy || !vehicleForm.plateNumber.trim()}
            onClick={() => void run(async () => {
              await createVehicle({ plateNumber: vehicleForm.plateNumber, note: vehicleForm.note, muassasahId: vehicleForm.muassasahId || undefined });
              setVehicleForm({ plateNumber: "", note: "", muassasahId: vehicleForm.muassasahId });
            })}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
            Tambah kendaraan
          </button>
        </div>
        <div className="px-4 pb-4">
          {vehicles.length === 0 ? (
            <p className="py-2 text-xs text-on-surface-variant">Belum ada kendaraan.</p>
          ) : (
            <ul className="divide-y divide-outline-variant/30">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                      <span className="truncate">{vehicle.plateNumber}</span>
                      {vehicle.isProblematic ? (
                        <span className={PROBLEM_BADGE}>
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">warning</span>Bermasalah
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-on-surface-variant">
                      {[vehicle.muassasahName ?? "Tanpa muassasah", vehicle.note].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className={`${ICON_BTN} ${vehicle.isProblematic ? "text-rose-600" : "hover:text-rose-600"}`}
                      title={vehicle.isProblematic ? "Hapus penanda bermasalah" : "Tandai bermasalah (mis. kotor)"}
                      disabled={busy}
                      onClick={() => void run(() => updateVehicle(vehicle.id, { isProblematic: !vehicle.isProblematic }))}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">{vehicle.isProblematic ? "flag" : "outlined_flag"}</span>
                    </button>
                    <button type="button" className={`${ICON_BTN} hover:text-rose-600`} title="Hapus kendaraan" disabled={busy} onClick={() => void run(() => deleteVehicle(vehicle.id))}>
                      <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>
    </div>
  );
}
