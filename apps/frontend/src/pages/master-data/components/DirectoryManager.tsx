import { useMemo, useState } from "react";
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
  updateMuassasah,
  updateVehicle,
  useDriversQuery,
  useMuassasahQuery,
  useVehiclesQuery,
  type DriverOption,
  type MuassasahOption,
  type VehicleOption,
} from "../../../hooks/use-directory-backend";
import { MasterDataDeleteConfirmModal, MasterDataFormDrawer } from "./MasterDataComponents";

type DirectorySection = "muassasah" | "drivers" | "vehicles";
type DirectoryMode = "list" | "create";
type DriverDraft = { name: string; phone: string; note: string; muassasahId: string };
type VehicleDraft = { plateNumber: string; note: string; muassasahId: string };

const EMPTY_DRIVER: DriverDraft = { name: "", phone: "", note: "", muassasahId: "" };
const EMPTY_VEHICLE: VehicleDraft = { plateNumber: "", note: "", muassasahId: "" };
const INPUT = "serene-input serene-input-md w-full";

function normalizeUniqueValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function MuassasahSelect({ value, onChange, list }: { value: string; onChange: (value: string) => void; list: MuassasahOption[] }) {
  return (
    <SereneSelect className="serene-select min-h-11 w-full" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Tanpa muassasah</option>
      {list.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
    </SereneSelect>
  );
}

function FieldError({ children }: { children?: string }) {
  return children ? <p className="mt-1 text-xs font-semibold text-error" role="alert">{children}</p> : null;
}

function FormActions({ busy, disabled, onCancel }: { busy: boolean; disabled: boolean; onCancel: () => void }) {
  return (
    <div className="serene-form-actions flex flex-row gap-3 border-t border-outline-variant/30 pt-4">
      <button type="button" className="serene-btn-secondary min-h-11 flex-1" onClick={onCancel} disabled={busy}>Batal</button>
      <button type="submit" className="serene-btn-primary min-h-11 flex-1" disabled={busy || disabled}>
        <span className="material-symbols-outlined text-lg">save</span>{busy ? "Menyimpan..." : "Simpan data"}
      </button>
    </div>
  );
}

export function DirectoryManager({ section, mode, onModeChange }: { section: DirectorySection; mode: DirectoryMode; onModeChange: (mode: DirectoryMode) => void }) {
  const queryClient = useQueryClient();
  const muassasahQuery = useMuassasahQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const muassasah = useMemo(() => muassasahQuery.data ?? [], [muassasahQuery.data]);
  const drivers = useMemo(() => driversQuery.data ?? [], [driversQuery.data]);
  const vehicles = useMemo(() => vehiclesQuery.data ?? [], [vehiclesQuery.data]);
  const [muassasahName, setMuassasahName] = useState("");
  const [driverDraft, setDriverDraft] = useState<DriverDraft>(EMPTY_DRIVER);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>(EMPTY_VEHICLE);
  const [editing, setEditing] = useState<MuassasahOption | DriverOption | VehicleOption | null>(null);
  const [editMuassasahName, setEditMuassasahName] = useState("");
  const [editDriverDraft, setEditDriverDraft] = useState<DriverDraft>(EMPTY_DRIVER);
  const [editVehicleDraft, setEditVehicleDraft] = useState<VehicleDraft>(EMPTY_VEHICLE);
  const [deleting, setDeleting] = useState<MuassasahOption | DriverOption | VehicleOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["directory"] });
  const run = async (action: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
      after?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Perubahan tidak dapat disimpan.");
    } finally {
      setBusy(false);
    }
  };

  const isDriverDuplicate = (name: string, exceptId?: string) => {
    const normalized = normalizeUniqueValue(name);
    return Boolean(normalized) && drivers.some((item) => item.id !== exceptId && normalizeUniqueValue(item.name) === normalized);
  };
  const isVehicleDuplicate = (plateNumber: string, exceptId?: string) => {
    const normalized = normalizeUniqueValue(plateNumber);
    return Boolean(normalized) && vehicles.some((item) => item.id !== exceptId && normalizeUniqueValue(item.plateNumber) === normalized);
  };
  const isMuassasahDuplicate = (name: string, exceptId?: string) => {
    const normalized = normalizeUniqueValue(name);
    return Boolean(normalized) && muassasah.some((item) => item.id !== exceptId && normalizeUniqueValue(item.name) === normalized);
  };

  const sectionTitle = section === "muassasah" ? "Muassasah" : section === "drivers" ? "Supir" : "Kendaraan";
  const items = section === "muassasah" ? muassasah : section === "drivers" ? drivers : vehicles;
  const loading = section === "muassasah" ? muassasahQuery.isLoading : section === "drivers" ? driversQuery.isLoading : vehiclesQuery.isLoading;
  const closeCreate = () => { setError(null); onModeChange("list"); };

  const renderCreateForm = () => {
    if (section === "muassasah") {
      const duplicate = isMuassasahDuplicate(muassasahName);
      return (
        <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); if (!duplicate) void run(() => createMuassasah(muassasahName), () => { setMuassasahName(""); closeCreate(); }); }}>
          <label className="grid gap-2 text-sm font-bold text-on-surface">Nama muassasah
            <input className={INPUT} value={muassasahName} onChange={(event) => setMuassasahName(event.target.value)} placeholder="contoh: Daleel Maalem" autoFocus />
            <FieldError>{duplicate ? "Nama muassasah sudah terdaftar." : undefined}</FieldError>
          </label>
          <FormActions busy={busy} disabled={!muassasahName.trim() || duplicate} onCancel={closeCreate} />
        </form>
      );
    }
    if (section === "drivers") {
      const duplicate = isDriverDuplicate(driverDraft.name);
      return (
        <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); if (!duplicate) void run(() => createDriver({ ...driverDraft, muassasahId: driverDraft.muassasahId || undefined }), () => { setDriverDraft(EMPTY_DRIVER); closeCreate(); }); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-on-surface">Nama supir
              <input className={INPUT} value={driverDraft.name} onChange={(event) => setDriverDraft((value) => ({ ...value, name: event.target.value }))} placeholder="contoh: Ahmad Yusuf" autoFocus />
              <FieldError>{duplicate ? "Nama supir sudah terdaftar. Gunakan data yang sudah ada." : undefined}</FieldError>
            </label>
            <label className="grid gap-2 text-sm font-bold text-on-surface">Nomor telepon
              <input className={INPUT} value={driverDraft.phone} onChange={(event) => setDriverDraft((value) => ({ ...value, phone: event.target.value }))} placeholder="opsional" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-on-surface">Muassasah
              <MuassasahSelect value={driverDraft.muassasahId} onChange={(muassasahId) => setDriverDraft((value) => ({ ...value, muassasahId }))} list={muassasah} />
            </label>
            <label className="grid gap-2 text-sm font-bold text-on-surface">Catatan
              <input className={INPUT} value={driverDraft.note} onChange={(event) => setDriverDraft((value) => ({ ...value, note: event.target.value }))} placeholder="opsional" />
            </label>
          </div>
          <FormActions busy={busy} disabled={!driverDraft.name.trim() || duplicate} onCancel={closeCreate} />
        </form>
      );
    }
    const duplicate = isVehicleDuplicate(vehicleDraft.plateNumber);
    return (
      <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); if (!duplicate) void run(() => createVehicle({ ...vehicleDraft, muassasahId: vehicleDraft.muassasahId || undefined }), () => { setVehicleDraft(EMPTY_VEHICLE); closeCreate(); }); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-on-surface">Nomor kendaraan / plat
            <input className={INPUT} value={vehicleDraft.plateNumber} onChange={(event) => setVehicleDraft((value) => ({ ...value, plateNumber: event.target.value }))} placeholder="contoh: B 1234 ABC" autoFocus />
            <FieldError>{duplicate ? "Kendaraan dengan nomor tersebut sudah terdaftar." : undefined}</FieldError>
          </label>
          <label className="grid gap-2 text-sm font-bold text-on-surface">Muassasah
            <MuassasahSelect value={vehicleDraft.muassasahId} onChange={(muassasahId) => setVehicleDraft((value) => ({ ...value, muassasahId }))} list={muassasah} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-on-surface sm:col-span-2">Catatan
            <input className={INPUT} value={vehicleDraft.note} onChange={(event) => setVehicleDraft((value) => ({ ...value, note: event.target.value }))} placeholder="opsional" />
          </label>
        </div>
        <FormActions busy={busy} disabled={!vehicleDraft.plateNumber.trim() || duplicate} onCancel={closeCreate} />
      </form>
    );
  };

  const beginEdit = (item: MuassasahOption | DriverOption | VehicleOption) => {
    setEditing(item);
    setError(null);
    if ("plateNumber" in item) setEditVehicleDraft({ plateNumber: item.plateNumber, note: item.note ?? "", muassasahId: item.muassasahId ?? "" });
    else if ("phone" in item) setEditDriverDraft({ name: item.name, phone: item.phone ?? "", note: item.note ?? "", muassasahId: item.muassasahId ?? "" });
    else setEditMuassasahName(item.name);
  };

  const submitEdit = () => {
    if (!editing) return;
    if (section === "muassasah" && "name" in editing && !("phone" in editing)) {
      if (isMuassasahDuplicate(editMuassasahName, editing.id)) return;
      void run(() => updateMuassasah(editing.id, { name: editMuassasahName }), () => setEditing(null));
    } else if (section === "drivers" && "phone" in editing) {
      if (isDriverDuplicate(editDriverDraft.name, editing.id)) return;
      void run(() => updateDriver(editing.id, { ...editDriverDraft, muassasahId: editDriverDraft.muassasahId || null }), () => setEditing(null));
    } else if (section === "vehicles" && "plateNumber" in editing) {
      if (isVehicleDuplicate(editVehicleDraft.plateNumber, editing.id)) return;
      void run(() => updateVehicle(editing.id, { ...editVehicleDraft, muassasahId: editVehicleDraft.muassasahId || null }), () => setEditing(null));
    }
  };

  const editDuplicate = editing && section === "muassasah"
    ? isMuassasahDuplicate(editMuassasahName, editing.id)
    : editing && section === "drivers"
      ? isDriverDuplicate(editDriverDraft.name, editing.id)
      : editing ? isVehicleDuplicate(editVehicleDraft.plateNumber, editing.id) : false;

  return (
    <div className="min-w-0">
      {error ? <div className="mx-4 mt-4 rounded-xl border border-error/25 bg-error-container/60 px-4 py-3 text-sm font-semibold text-on-error-container sm:mx-6" role="alert">{error}</div> : null}
      {mode === "create" ? (
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.18fr)_minmax(20rem,0.82fr)]">
          <section className="px-4 py-5 sm:px-6 lg:border-r lg:border-outline-variant/30">
            <h2 className="text-xl font-bold text-on-surface">Tambah {sectionTitle.toLocaleLowerCase("id-ID")}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Isi informasi utama. Sistem akan memeriksa duplikasi sebelum data disimpan.</p>
            <div className="mt-6">{renderCreateForm()}</div>
          </section>
          <aside className="bg-surface-container-low px-4 py-5 sm:px-6">
            <h3 className="text-base font-bold text-on-surface">Pemeriksaan data</h3>
            <ul className="mt-4 space-y-3 text-sm text-on-surface-variant">
              <li className="flex gap-2"><span className="material-symbols-outlined text-lg text-primary">check_circle</span>Nama diperiksa tanpa membedakan huruf besar dan kecil.</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-lg text-primary">check_circle</span>Spasi berulang dianggap sebagai nama yang sama.</li>
              <li className="flex gap-2"><span className="material-symbols-outlined text-lg text-primary">check_circle</span>Relasi muassasah dapat diperbarui kemudian.</li>
            </ul>
          </aside>
        </div>
      ) : (
        <section className="px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold text-on-surface">Daftar {sectionTitle.toLocaleLowerCase("id-ID")}</h2><p className="mt-1 text-sm text-on-surface-variant">Menampilkan {items.length} data.</p></div>
            <button type="button" className="serene-btn-primary serene-focus-ring inline-flex min-h-11 items-center gap-2 px-4 text-xs" onClick={() => onModeChange("create")}><span className="material-symbols-outlined text-lg">add</span>Tambah data</button>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant/35">
            {loading ? <p className="p-8 text-center text-sm text-on-surface-variant">Memuat data...</p> : items.length === 0 ? <p className="p-8 text-center text-sm text-on-surface-variant">Belum ada data {sectionTitle.toLocaleLowerCase("id-ID")}.</p> : (
              <ul className="divide-y divide-outline-variant/25">
                {items.map((item) => {
                  const title = "plateNumber" in item ? item.plateNumber : item.name;
                  const detail = "driverCount" in item ? `${item.driverCount} supir · ${item.vehicleCount} kendaraan` : [item.muassasahName ?? "Tanpa muassasah", "phone" in item ? item.phone : null, item.note].filter(Boolean).join(" · ");
                  return <li key={item.id} className="flex items-center gap-3 px-3 py-3 sm:px-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary"><span className="material-symbols-outlined">{section === "muassasah" ? "apartment" : section === "drivers" ? "person_pin" : "directions_bus"}</span></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-on-surface">{title}</p><p className="mt-0.5 truncate text-xs text-on-surface-variant">{detail || "Belum ada detail."}</p></div><button type="button" className="serene-focus-ring inline-flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" onClick={() => beginEdit(item)} aria-label={`Edit ${title}`}><span className="material-symbols-outlined">edit</span></button><button type="button" className="serene-focus-ring inline-flex h-11 w-11 items-center justify-center rounded-lg text-error hover:bg-error-container/40" onClick={() => setDeleting(item)} aria-label={`Hapus ${title}`}><span className="material-symbols-outlined">delete</span></button></li>;
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <MasterDataFormDrawer isOpen={Boolean(editing)} title={`Edit ${sectionTitle.toLocaleLowerCase("id-ID")}`} description="Perbarui data tanpa meninggalkan daftar." onClose={() => setEditing(null)}>
        {editing ? <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); submitEdit(); }}>
          {section === "muassasah" ? <label className="grid gap-2 text-sm font-bold">Nama muassasah<input className={INPUT} value={editMuassasahName} onChange={(event) => setEditMuassasahName(event.target.value)} /><FieldError>{editDuplicate ? "Nama muassasah sudah terdaftar." : undefined}</FieldError></label> : null}
          {section === "drivers" ? <><label className="grid gap-2 text-sm font-bold">Nama supir<input className={INPUT} value={editDriverDraft.name} onChange={(event) => setEditDriverDraft((value) => ({ ...value, name: event.target.value }))} /><FieldError>{editDuplicate ? "Nama supir sudah terdaftar." : undefined}</FieldError></label><label className="grid gap-2 text-sm font-bold">Nomor telepon<input className={INPUT} value={editDriverDraft.phone} onChange={(event) => setEditDriverDraft((value) => ({ ...value, phone: event.target.value }))} /></label><label className="grid gap-2 text-sm font-bold">Muassasah<MuassasahSelect value={editDriverDraft.muassasahId} onChange={(muassasahId) => setEditDriverDraft((value) => ({ ...value, muassasahId }))} list={muassasah} /></label><label className="grid gap-2 text-sm font-bold">Catatan<input className={INPUT} value={editDriverDraft.note} onChange={(event) => setEditDriverDraft((value) => ({ ...value, note: event.target.value }))} /></label></> : null}
          {section === "vehicles" ? <><label className="grid gap-2 text-sm font-bold">Nomor kendaraan / plat<input className={INPUT} value={editVehicleDraft.plateNumber} onChange={(event) => setEditVehicleDraft((value) => ({ ...value, plateNumber: event.target.value }))} /><FieldError>{editDuplicate ? "Kendaraan tersebut sudah terdaftar." : undefined}</FieldError></label><label className="grid gap-2 text-sm font-bold">Muassasah<MuassasahSelect value={editVehicleDraft.muassasahId} onChange={(muassasahId) => setEditVehicleDraft((value) => ({ ...value, muassasahId }))} list={muassasah} /></label><label className="grid gap-2 text-sm font-bold">Catatan<input className={INPUT} value={editVehicleDraft.note} onChange={(event) => setEditVehicleDraft((value) => ({ ...value, note: event.target.value }))} /></label></> : null}
          <FormActions busy={busy} disabled={Boolean(editDuplicate)} onCancel={() => setEditing(null)} />
        </form> : null}
      </MasterDataFormDrawer>

      <MasterDataDeleteConfirmModal isOpen={Boolean(deleting)} itemLabel={deleting ? ("plateNumber" in deleting ? deleting.plateNumber : deleting.name) : "data"} itemType={sectionTitle.toLocaleLowerCase("id-ID")} isDeleting={busy} onClose={() => setDeleting(null)} onConfirm={() => { if (!deleting) return; const action = section === "muassasah" ? () => deleteMuassasah(deleting.id) : section === "drivers" ? () => deleteDriver(deleting.id) : () => deleteVehicle(deleting.id); void run(action, () => setDeleting(null)); }} />
    </div>
  );
}
