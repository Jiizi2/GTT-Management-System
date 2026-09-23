import { useEffect, useMemo, useState } from "react";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { SereneSelect } from "../components/serene-select";
import {
  useCreateMasterDataOptionMutation,
  useDeleteMasterDataOptionMutation,
  useMasterDataCategoriesQuery,
  useMasterDataOptionsQuery,
  useUpdateMasterDataOptionMutation,
} from "../hooks/use-master-data-query";
import type { MasterDataCategoryKey, MasterDataOption } from "../hooks/use-master-data-backend";
import { useAgentsQuery } from "../hooks/use-agents-backend";
import { useDriversQuery, useMuassasahQuery, useVehiclesQuery } from "../hooks/use-directory-backend";
import { DirectoryManager } from "./master-data/components/DirectoryManager";
import { useThemeMode } from "../theme/theme-provider";
import { AgentsScreen } from "./agents-page";
import {
  EMPTY_FORM,
  parseMetadataJson,
  MasterDataOptionForm,
  MasterDataOptionTable,
  MasterDataDeleteConfirmModal,
  type MasterDataOptionFormValues,
  type CategoryFormConfig,
  type MasterDataCategoryTabKey,
} from "./master-data/components/MasterDataComponents";

type NoticeState = {
  tone: "success" | "error";
  message: string;
};

type OptionStatusFilter = "active" | "inactive" | "all";

const CATEGORY_FORM_CONFIG: Record<MasterDataCategoryKey, CategoryFormConfig> = {
  "bank-disbursement": {
    valueLabel: "Bank Key",
    valuePlaceholder: "contoh: bsi",
    valueHint: "Gunakan key unik untuk integrasi invoice (huruf kecil disarankan).",
    labelLabel: "Bank Account Label",
    labelPlaceholder: "contoh: BCA (IDR) - 035 123 4455",
    descriptionLabel: "Catatan Rekening",
    descriptionPlaceholder: "contoh: khusus transaksi USD",
    metadataLabel: "Metadata JSON (Nama Penerima Transfer)",
    metadataPlaceholder: '{\n  "penerima": "PT Ghaniya Tour Travel"\n}',
    metadataHint: "Masukkan JSON dengan key 'penerima' untuk nama pemilik rekening / penerima transfer.",
    showMetadata: true,
  },
  "invoice-client-name": {
    valueLabel: "Client Key",
    valuePlaceholder: "contoh: UMRAH_CORPORATE",
    valueHint: "Kosongkan untuk auto-generate dari nama client.",
    labelLabel: "Nama Client",
    labelPlaceholder: "contoh: Umrah Corporate",
    descriptionLabel: "Catatan Client",
    descriptionPlaceholder: "contoh: client prioritas",
    metadataLabel: "Metadata JSON (Nama Penerima / PIC Default)",
    metadataPlaceholder: '{\n  "penerima": "Bpk. Ahmad"\n}',
    metadataHint: "Masukkan JSON dengan key 'penerima' untuk nama PIC default penerima invoice.",
    showMetadata: true,
  },
  "invoice-issuing-office": {
    valueLabel: "Office Key",
    valuePlaceholder: "contoh: BEKASI_OFFICE",
    valueHint: "Disarankan UPPER_SNAKE_CASE agar konsisten.",
    labelLabel: "Nama Office",
    labelPlaceholder: "contoh: Bekasi Office",
    descriptionLabel: "Catatan Office",
    descriptionPlaceholder: "contoh: default penerbit invoice area barat",
    metadataLabel: "Metadata",
    metadataPlaceholder: "",
    showMetadata: false,
  },
  "invoice-status": {
    valueLabel: "Status Value",
    valuePlaceholder: "Pending / Paid / Overdue / Cancelled",
    valueHint: "Status dibatasi backend: Pending, Paid, Overdue, Cancelled.",
    labelLabel: "Status Label",
    labelPlaceholder: "contoh: Pending",
    descriptionLabel: "Deskripsi Status",
    descriptionPlaceholder: "contoh: invoice belum dibayar",
    metadataLabel: "Metadata",
    metadataPlaceholder: "",
    showMetadata: false,
  },
  "role-catalog": {
    valueLabel: "Role Key",
    valuePlaceholder: "contoh: finance-manager",
    valueHint: "Role key biasanya sama dengan role user di User Management.",
    labelLabel: "Nama Role",
    labelPlaceholder: "contoh: Finance Manager",
    descriptionLabel: "Deskripsi Role",
    descriptionPlaceholder: "contoh: fokus pada invoice dan payment status",
    metadataLabel: "Metadata JSON (Permissions)",
    metadataPlaceholder: '{"permissions":["MANAGE_INVOICES","VIEW_PAYMENT_STATUS"]}',
    metadataHint: "Gunakan array string pada key `permissions`.",
    showMetadata: true,
  },
  "saudi-city": {
    valueLabel: "City Key",
    valuePlaceholder: "contoh: MAKKAH",
    valueHint: "Disarankan UPPER_SNAKE_CASE untuk konsistensi data kota.",
    labelLabel: "Nama Kota",
    labelPlaceholder: "contoh: Makkah",
    descriptionLabel: "Keterangan Kota",
    descriptionPlaceholder: "contoh: destinasi utama city tour",
    metadataLabel: "Metadata",
    metadataPlaceholder: "",
    showMetadata: false,
  },
  "user-role": {
    valueLabel: "Role Value",
    valuePlaceholder: "super-admin / admin / finance-manager / customer-support",
    valueHint: "Role dibatasi backend: super-admin, admin, finance-manager, customer-support.",
    labelLabel: "Nama Role",
    labelPlaceholder: "contoh: Customer Support",
    descriptionLabel: "Deskripsi Role",
    descriptionPlaceholder: "contoh: menangani komunikasi jamaah",
    metadataLabel: "Metadata",
    metadataPlaceholder: "",
    showMetadata: false,
  },
};

function readErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallbackMessage;
}

function createFormFromOption(option: MasterDataOption): MasterDataOptionFormValues {
  return {
    value: option.value,
    label: option.label,
    description: option.description ?? "",
    isActive: option.isActive,
    metadataJson: option.metadata ? JSON.stringify(option.metadata, null, 2) : "",
  };
}

export function MasterDataScreen() {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";
  const categoriesQuery = useMasterDataCategoriesQuery();
  const agentsQuery = useAgentsQuery();
  const muassasahQuery = useMuassasahQuery();
  const driversQuery = useDriversQuery();
  const vehiclesQuery = useVehiclesQuery();
  const [activeCategoryKey, setActiveCategoryKey] = useState<MasterDataCategoryTabKey | null>(null);
  const [statusFilter, setStatusFilter] = useState<OptionStatusFilter>("active");
  const [optionSearch, setOptionSearch] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [composerValues, setComposerValues] = useState<MasterDataOptionFormValues>(EMPTY_FORM);
  const [deletingOption, setDeletingOption] = useState<MasterDataOption | null>(null);
  const [createFormResetToken, setCreateFormResetToken] = useState(0);
  const createMutation = useCreateMasterDataOptionMutation();
  const updateMutation = useUpdateMasterDataOptionMutation();
  const deleteMutation = useDeleteMasterDataOptionMutation();

  const sortedCategories = useMemo(
    () => [...(categoriesQuery.data ?? [])].sort((left, right) => left.label.localeCompare(right.label)),
    [categoriesQuery.data],
  );
  const categoryTabs = useMemo(() => {
    const agents = agentsQuery.data ?? [];
    const muassasah = muassasahQuery.data ?? [];
    const drivers = driversQuery.data ?? [];
    const vehicles = vehiclesQuery.data ?? [];
    return [
      ...sortedCategories,
      {
        key: "agents" as const,
        label: "Agen",
        description: "Kelola agen pemilik grup dan transaksi operasional.",
        activeOptions: agents.filter((agent) => agent.status === "ACTIVE").length,
        totalOptions: agents.length,
      },
      {
        key: "muassasah" as const,
        label: "Muassasah",
        description: "Kelola perusahaan tempat supir dan kendaraan bernaung.",
        activeOptions: muassasah.filter((item) => item.isActive).length,
        totalOptions: muassasah.length,
      },
      {
        key: "drivers" as const,
        label: "Supir",
        description: "Kelola direktori supir untuk kebutuhan checklist H-1.",
        activeOptions: drivers.filter((item) => item.isActive).length,
        totalOptions: drivers.length,
      },
      {
        key: "vehicles" as const,
        label: "Kendaraan",
        description: "Kelola kendaraan atau bis yang digunakan operasional.",
        activeOptions: vehicles.filter((item) => item.isActive).length,
        totalOptions: vehicles.length,
      },
    ];
  }, [agentsQuery.data, driversQuery.data, muassasahQuery.data, sortedCategories, vehiclesQuery.data]);

  useEffect(() => {
    setActiveCategoryKey((current) => {
      if (current && categoryTabs.some((category) => category.key === current)) {
        return current;
      }

      const firstMasterDataCategory = categoryTabs.find(
        (category) => !["agents", "muassasah", "drivers", "vehicles"].includes(category.key),
      );
      if (firstMasterDataCategory) {
        return firstMasterDataCategory.key;
      }

      return categoriesQuery.isLoading ? null : (categoryTabs[0]?.key ?? null);
    });
  }, [categoriesQuery.isLoading, categoryTabs]);

  const activeCategory =
    activeCategoryKey !== null && !["agents", "muassasah", "drivers", "vehicles"].includes(activeCategoryKey)
      ? (sortedCategories.find((category) => category.key === activeCategoryKey) ?? null)
      : null;
  const activeCategoryFormConfig =
    activeCategoryKey !== null && !["agents", "muassasah", "drivers", "vehicles"].includes(activeCategoryKey) ? CATEGORY_FORM_CONFIG[activeCategoryKey as MasterDataCategoryKey] : null;

  const optionsQuery = useMasterDataOptionsQuery({
    categoryKey: activeCategoryKey && !["agents", "muassasah", "drivers", "vehicles"].includes(activeCategoryKey) ? activeCategoryKey as MasterDataCategoryKey : "invoice-issuing-office",
    includeInactive: statusFilter !== "active",
    enabled: activeCategoryKey !== null && !["agents", "muassasah", "drivers", "vehicles"].includes(activeCategoryKey),
  });
  const options = useMemo(() => optionsQuery.data ?? [], [optionsQuery.data]);
  const filteredOptions = useMemo(() => {
    const normalizedSearch = optionSearch.trim().toLocaleLowerCase("id-ID");
    return options.filter((option) => {
      if (statusFilter === "active" && !option.isActive) {
        return false;
      }
      if (statusFilter === "inactive" && option.isActive) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [option.value, option.label, option.description ?? ""].some((value) =>
        value.toLocaleLowerCase("id-ID").includes(normalizedSearch),
      );
    });
  }, [optionSearch, options, statusFilter]);
  const editingOption = useMemo(
    () => options.find((option) => option.id === editingOptionId) ?? null,
    [editingOptionId, options],
  );
  const editingInitialValues = useMemo(
    () => (editingOption ? createFormFromOption(editingOption) : EMPTY_FORM),
    [editingOption],
  );

  useEffect(() => {
    if (!editingOptionId) {
      return;
    }

    if (!editingOption) {
      setEditingOptionId(null);
    }
  }, [editingOption, editingOptionId]);

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
    if (!categoriesQuery.error) {
      return;
    }

    setNotice({
      tone: "error",
      message: readErrorMessage(categoriesQuery.error, "Gagal memuat kategori master data dari backend."),
    });
  }, [categoriesQuery.error]);

  useEffect(() => {
    if (!optionsQuery.error) {
      return;
    }

    setNotice({
      tone: "error",
      message: readErrorMessage(optionsQuery.error, "Gagal memuat option master data."),
    });
  }, [optionsQuery.error]);

  const handleSelectCategory = (categoryKey: MasterDataCategoryTabKey) => {
    setActiveCategoryKey(categoryKey);
    setIsCreateOpen(false);
    setEditingOptionId(null);
    setDeletingOption(null);
    setOptionSearch("");
    setStatusFilter("active");
    setCreateFormResetToken((current) => current + 1);
  };

  const handleCreateSubmit = async (values: MasterDataOptionFormValues) => {
    if (!activeCategoryKey || ["agents", "muassasah", "drivers", "vehicles"].includes(activeCategoryKey)) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        categoryKey: activeCategoryKey as MasterDataCategoryKey,
        value: values.value.trim() || undefined,
        label: values.label.trim(),
        description: values.description.trim() || undefined,
        isActive: values.isActive,
        metadata: parseMetadataJson(values.metadataJson),
      });
      setCreateFormResetToken((current) => current + 1);
      setIsCreateOpen(false);
      setNotice({
        tone: "success",
        message: "Option master data berhasil ditambahkan.",
      });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Gagal menambahkan option master data."),
      });
    }
  };

  const handleSaveEdit = async (values: MasterDataOptionFormValues) => {
    if (!editingOptionId) {
      return;
    }

    try {
      await updateMutation.mutateAsync({
        optionId: editingOptionId,
        payload: {
          value: values.value.trim(),
          label: values.label.trim(),
          description: values.description.trim() || undefined,
          isActive: values.isActive,
          metadata: parseMetadataJson(values.metadataJson),
        },
      });
      setEditingOptionId(null);
      setNotice({
        tone: "success",
        message: "Option master data berhasil diperbarui.",
      });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Gagal memperbarui option master data."),
      });
    }
  };

  const handleToggleActive = async (option: MasterDataOption) => {
    try {
      await updateMutation.mutateAsync({
        optionId: option.id,
        payload: {
          isActive: !option.isActive,
        },
      });
      setNotice({
        tone: "success",
        message: `Option ${option.label} ${option.isActive ? "dinonaktifkan" : "diaktifkan"}.`,
      });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Gagal mengubah status option."),
      });
    }
  };

  const handleDeleteOption = async () => {
    if (!deletingOption) return;
    try {
      await deleteMutation.mutateAsync(deletingOption.id);
      setNotice({ tone: "success", message: `Data ${deletingOption.label} berhasil dihapus.` });
      setDeletingOption(null);
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Data tidak dapat dihapus karena masih digunakan."),
      });
    }
  };

  const isOperationalCategory = Boolean(
    activeCategoryKey && ["agents", "muassasah", "drivers", "vehicles"].includes(activeCategoryKey),
  );
  const isOptionCategory = Boolean(activeCategoryKey && !isOperationalCategory);
  const isComposerActive = isOptionCategory ? isCreateOpen || Boolean(editingOptionId) : isCreateOpen;
  const selectedCategory = categoryTabs.find((category) => category.key === activeCategoryKey) ?? null;
  const composerInitialValues = editingOptionId ? editingInitialValues : EMPTY_FORM;
  const previewTitle =
    composerValues.label.trim() || activeCategoryFormConfig?.labelPlaceholder.replace(/^contoh:\s*/i, "") || "Nama data";
  const previewValue =
    composerValues.value.trim() || activeCategoryFormConfig?.valuePlaceholder.replace(/^contoh:\s*/i, "") || "nilai-data";
  const previewOrder = editingOption?.sortOrder ?? options.length + 1;
  const metadataIsValid = useMemo(() => {
    try {
      parseMetadataJson(composerValues.metadataJson);
      return true;
    } catch {
      return false;
    }
  }, [composerValues.metadataJson]);
  const composerChecks = [
    { label: `${activeCategoryFormConfig?.valueLabel ?? "Nilai"} tidak boleh kosong`, valid: Boolean(composerValues.value.trim()) },
    { label: "Nama tampilan tidak boleh kosong", valid: Boolean(composerValues.label.trim()) },
    { label: "Status data sudah dipilih", valid: typeof composerValues.isActive === "boolean" },
    ...(activeCategoryFormConfig?.showMetadata
      ? [{ label: "Format metadata sudah sesuai", valid: metadataIsValid }]
      : []),
  ];
  const activeCategoryIcon = activeCategoryKey === "bank-disbursement" ? "account_balance" : "dataset";

  return (
    <div className="master-data-workspace mx-auto max-w-[1586px] space-y-4 px-4 pb-32 pt-4 sm:px-6 lg:pb-8 lg:pl-4 lg:pr-0">
      <header className="rounded-2xl bg-surface-container-lowest px-5 py-3 shadow-ambient sm:px-7 lg:flex lg:items-center lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-on-surface sm:leading-[1.08]">
            Master Data
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
            Kelola opsi sistem, agen, muassasah, supir, dan kendaraan dalam satu tempat.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-2 lg:mt-0">
          {activeCategoryKey ? (
            <div className="grid min-w-0 flex-1 grid-cols-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-1 lg:w-[300px] lg:flex-none">
              <button
                type="button"
                className={`serene-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                  !isComposerActive
                    ? "bg-surface-container-lowest text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingOptionId(null);
                }}
                aria-pressed={!isComposerActive}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">list</span>
                Daftar data
              </button>
              <button
                type="button"
                className={`serene-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-bold transition ${
                  isComposerActive
                    ? "bg-primary text-on-primary shadow-cta-soft"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
                onClick={() => {
                  setEditingOptionId(null);
                  setIsCreateOpen(true);
                  setCreateFormResetToken((current) => current + 1);
                }}
                aria-pressed={isComposerActive}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  {editingOptionId ? "edit" : "add"}
                </span>
                {editingOptionId ? "Edit data" : "Tambah baru"}
              </button>
            </div>
          ) : null}
          <ThemeToggleButton />
        </div>
      </header>

      {notice ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
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

      <section className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-ambient">
        <div className="grid gap-3 border-b border-outline-variant/30 px-4 py-4 sm:grid-cols-[auto_minmax(0,18rem)_1fr] sm:items-center sm:px-6">
          <label className="text-sm font-bold text-on-surface" htmlFor="master-data-category-workspace">
            Kategori data
          </label>
          <SereneSelect
            id="master-data-category-workspace"
            className="serene-select min-h-11 w-full pr-10"
            value={activeCategoryKey ?? ""}
            onChange={(event) => handleSelectCategory(event.target.value as MasterDataCategoryTabKey)}
            aria-label="Pilih kategori master data"
          >
            {categoryTabs.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label} · {category.activeOptions}/{category.totalOptions} aktif
              </option>
            ))}
          </SereneSelect>
          <p className="text-xs leading-relaxed text-on-surface-variant sm:text-right">
            {selectedCategory?.description ?? (categoriesQuery.isLoading ? "Memuat kategori..." : "Pilih kategori data.")}
          </p>
        </div>

        {activeCategoryKey === "muassasah" || activeCategoryKey === "drivers" || activeCategoryKey === "vehicles" ? (
          <DirectoryManager
            section={activeCategoryKey}
            mode={isCreateOpen ? "create" : "list"}
            onModeChange={(mode) => setIsCreateOpen(mode === "create")}
          />
        ) : activeCategoryKey === "agents" ? (
          <AgentsScreen
            embedded
            mode={isCreateOpen ? "create" : "list"}
            onModeChange={(mode) => setIsCreateOpen(mode === "create")}
          />
        ) : isComposerActive && activeCategoryFormConfig ? (
          <div className="grid min-w-0 lg:grid-cols-[minmax(0,1.18fr)_minmax(22rem,0.95fr)]">
            <div className="min-w-0 px-4 py-5 sm:px-6 lg:border-r lg:border-outline-variant/30">
              <MasterDataOptionForm
                categoryKey={activeCategoryKey ?? ""}
                config={activeCategoryFormConfig}
                initialValues={composerInitialValues}
                resetToken={editingOptionId ?? `${activeCategoryKey ?? "none"}-${createFormResetToken}`}
                submitLabel={editingOptionId ? "Simpan perubahan" : "Simpan data"}
                isSubmitting={editingOptionId ? updateMutation.isPending : createMutation.isPending}
                onSubmit={editingOptionId ? handleSaveEdit : handleCreateSubmit}
                onValuesChange={setComposerValues}
                variant="composer"
                onCancel={() => {
                  setIsCreateOpen(false);
                  setEditingOptionId(null);
                }}
              />
            </div>

            <aside className="grid min-w-0 content-start gap-4 overflow-hidden bg-surface-container-low px-4 py-5 sm:px-6 lg:-mt-[77px] lg:border-l lg:border-outline-variant/30" aria-label="Ringkasan data">
              <section className="min-w-0">
                <h2 className="font-display text-lg font-extrabold text-on-surface">Pratinjau data</h2>
                <p className="mt-1 text-xs text-on-surface-variant">Seperti ini data akan tampil setelah disimpan.</p>
                <article className="mt-3 rounded-xl border border-primary/20 bg-primary-fixed/45 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary" aria-hidden="true">
                      <span className="material-symbols-outlined text-xl">{activeCategoryIcon}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-extrabold text-on-surface">{previewTitle}</p>
                      <p className="mt-0.5 break-all font-mono text-[11px] text-on-surface-variant">{previewValue}</p>
                    </div>
                    <span className={composerValues.isActive ? "master-data-status-active" : "master-data-status-inactive"}>
                      {composerValues.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <dl className="mt-4 divide-y divide-outline-variant/25 text-xs">
                    <div className="grid grid-cols-[6rem_1fr] gap-3 py-2"><dt className="text-on-surface-variant">Kategori</dt><dd className="font-semibold text-on-surface">{activeCategory?.label}</dd></div>
                    <div className="grid grid-cols-[6rem_1fr] gap-3 py-2"><dt className="text-on-surface-variant">Urutan</dt><dd className="font-semibold text-on-surface">{previewOrder}</dd></div>
                    <div className="grid grid-cols-[6rem_1fr] gap-3 py-2"><dt className="text-on-surface-variant">Catatan</dt><dd className="break-words font-semibold text-on-surface">{composerValues.description.trim() || "Belum ada catatan."}</dd></div>
                  </dl>
                </article>
              </section>

              <section className="min-w-0 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
                <h2 className="font-display text-base font-extrabold text-on-surface">Pemeriksaan data</h2>
                <p className="mt-1 text-xs text-on-surface-variant">Pastikan informasi utama sudah sesuai.</p>
                <ul className="mt-3 space-y-2.5">
                  {composerChecks.map((check) => (
                    <li key={check.label} className="flex items-center gap-2 text-xs font-semibold text-on-surface">
                      <span className={`material-symbols-outlined text-lg ${check.valid ? "text-primary" : "text-outline"}`} aria-hidden="true">
                        {check.valid ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      {check.label}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="min-w-0 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-extrabold text-on-surface">Data terbaru</h2>
                    <p className="mt-1 text-xs text-on-surface-variant">Pilih data yang sudah ada untuk diedit.</p>
                  </div>
                  <button type="button" className="serene-focus-ring text-xs font-bold text-primary" onClick={() => { setIsCreateOpen(false); setEditingOptionId(null); }}>
                    Lihat semua
                  </button>
                </div>
                <div className="mt-3 divide-y divide-outline-variant/25">
                  {options.slice(0, 5).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className="serene-focus-ring flex w-full items-center gap-3 py-2.5 text-left"
                      onClick={() => { setEditingOptionId(option.id); setIsCreateOpen(false); }}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary" aria-hidden="true">
                        <span className="material-symbols-outlined text-base">{activeCategoryIcon}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-on-surface">{option.label}</span>
                        <span className="block truncate font-mono text-[11px] text-on-surface-variant">{option.value}</span>
                      </span>
                      <span className={option.isActive ? "master-data-status-active" : "master-data-status-inactive"}>
                        {option.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                      <span className="material-symbols-outlined text-lg text-on-surface-variant" aria-hidden="true">edit</span>
                    </button>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        ) : (
          <article className="min-w-0 pb-4 sm:pb-5">
            <div className="border-b border-outline-variant/30 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    Daftar data
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-on-surface">
                    {selectedCategory?.label ?? "Pilih kategori"}
                  </h2>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {selectedCategory?.description ?? "Pilih kategori data."}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
                    Menampilkan {filteredOptions.length} dari {options.length} data.
                  </p>
                </div>
                <button
                  type="button"
                  className="serene-btn-primary serene-focus-ring inline-flex min-h-10 items-center justify-center gap-2 px-4 text-xs"
                  onClick={() => {
                    setIsCreateOpen(true);
                    setEditingOptionId(null);
                    setCreateFormResetToken((current) => current + 1);
                  }}
                  disabled={!activeCategoryKey}
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    add
                  </span>
                  Tambah data
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <label className="relative block min-w-0 flex-1 xl:max-w-md">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant"
                    aria-hidden="true"
                  >
                    search
                  </span>
                  <input
                    className="serene-input serene-input-md w-full pl-10"
                    value={optionSearch}
                    onChange={(event) => setOptionSearch(event.target.value)}
                    placeholder="Cari nilai, nama, atau deskripsi..."
                    aria-label="Cari data pada kategori aktif"
                  />
                </label>
                <div className="grid grid-cols-3 rounded-xl bg-surface-container-low p-1" aria-label="Filter status">
                  {(["active", "inactive", "all"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className={`serene-focus-ring rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        statusFilter === filter
                          ? "bg-surface-container-lowest text-primary shadow-sm"
                          : "text-on-surface-variant hover:text-on-surface"
                      }`}
                      onClick={() => setStatusFilter(filter)}
                      aria-pressed={statusFilter === filter}
                    >
                      {filter === "active" ? "Aktif" : filter === "inactive" ? "Nonaktif" : "Semua"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline-variant/35 bg-surface-container-lowest sm:mx-5">
              {optionsQuery.isLoading ? (
                <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">
                  Memuat option...
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">
                  {options.length === 0
                    ? "Belum ada data untuk kategori ini."
                    : "Tidak ada data yang sesuai pencarian atau filter."}
                </div>
              ) : (
                <MasterDataOptionTable
                  options={filteredOptions}
                  isDarkMode={isDarkMode}
                  updatePending={updateMutation.isPending}
                  deletePending={deleteMutation.isPending}
                  onToggleActive={handleToggleActive}
                  onEditOption={(optionId) => {
                    setEditingOptionId(optionId);
                    setIsCreateOpen(false);
                  }}
                  onDeleteOption={(option) => {
                    setDeletingOption(option);
                    setEditingOptionId(null);
                    setIsCreateOpen(false);
                    deleteMutation.reset();
                  }}
                />
              )}
            </div>
          </article>
        )}
      </section>

      <MasterDataDeleteConfirmModal
        isOpen={Boolean(deletingOption)}
        itemLabel={deletingOption?.label ?? "data"}
        itemType="data master"
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteMutation.error instanceof Error ? deleteMutation.error.message : undefined}
        onClose={() => {
          if (!deleteMutation.isPending) setDeletingOption(null);
        }}
        onConfirm={() => void handleDeleteOption()}
      />
    </div>
  );
}
