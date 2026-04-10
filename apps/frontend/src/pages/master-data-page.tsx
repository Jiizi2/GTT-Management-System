import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import {
  createMasterDataOptionInBackend,
  fetchMasterDataCategoriesFromBackend,
  fetchMasterDataOptionsFromBackend,
  type MasterDataCategory,
  type MasterDataCategoryKey,
  type MasterDataOption,
  updateMasterDataOptionInBackend,
} from "../hooks/use-master-data-backend";

type NoticeState = {
  tone: "success" | "error";
  message: string;
};

type MasterDataFormState = {
  value: string;
  label: string;
  description: string;
  isActive: boolean;
  metadataJson: string;
};

type CategoryFormConfig = {
  valueLabel: string;
  valuePlaceholder: string;
  valueHint?: string;
  labelLabel: string;
  labelPlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  metadataLabel: string;
  metadataPlaceholder: string;
  metadataHint?: string;
  showMetadata: boolean;
};

const EMPTY_FORM: MasterDataFormState = {
  value: "",
  label: "",
  description: "",
  isActive: true,
  metadataJson: "",
};

const CATEGORY_FORM_CONFIG: Record<MasterDataCategoryKey, CategoryFormConfig> = {
  "bank-disbursement": {
    valueLabel: "Bank Key",
    valuePlaceholder: "contoh: bsi",
    valueHint: "Gunakan key unik untuk integrasi invoice (huruf kecil disarankan).",
    labelLabel: "Bank Account Label",
    labelPlaceholder: "contoh: BCA (IDR) - 035 123 4455",
    descriptionLabel: "Catatan Rekening",
    descriptionPlaceholder: "contoh: khusus transaksi USD",
    metadataLabel: "Metadata",
    metadataPlaceholder: "",
    showMetadata: false,
  },
  "invoice-client-name": {
    valueLabel: "Client Key",
    valuePlaceholder: "contoh: UMRAH_CORPORATE",
    valueHint: "Kosongkan untuk auto-generate dari nama client.",
    labelLabel: "Nama Client",
    labelPlaceholder: "contoh: Umrah Corporate",
    descriptionLabel: "Catatan Client",
    descriptionPlaceholder: "contoh: client prioritas",
    metadataLabel: "Metadata",
    metadataPlaceholder: "",
    showMetadata: false,
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
    valueHint:
      "Role dibatasi backend: super-admin, admin, finance-manager, customer-support.",
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

function parseMetadataJson(value: string): Record<string, unknown> | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata harus berupa JSON object.");
  }

  return parsed as Record<string, unknown>;
}

function createFormFromOption(option: MasterDataOption): MasterDataFormState {
  return {
    value: option.value,
    label: option.label,
    description: option.description ?? "",
    isActive: option.isActive,
    metadataJson: option.metadata ? JSON.stringify(option.metadata, null, 2) : "",
  };
}

export function MasterDataScreen() {
  const [categories, setCategories] = useState<MasterDataCategory[]>([]);
  const [activeCategoryKey, setActiveCategoryKey] = useState<MasterDataCategoryKey | null>(null);
  const [options, setOptions] = useState<MasterDataOption[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creatingForm, setCreatingForm] = useState<MasterDataFormState>(EMPTY_FORM);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<MasterDataFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((left, right) => left.label.localeCompare(right.label)),
    [categories],
  );

  const activeCategory =
    activeCategoryKey !== null
      ? sortedCategories.find((category) => category.key === activeCategoryKey) ?? null
      : null;
  const activeCategoryFormConfig =
    activeCategoryKey !== null ? CATEGORY_FORM_CONFIG[activeCategoryKey] : null;

  const refreshCategories = async (signal?: AbortSignal) => {
    const fetched = await fetchMasterDataCategoriesFromBackend({ signal });
    setCategories(fetched);
    setActiveCategoryKey((current) => {
      if (current && fetched.some((category) => category.key === current)) {
        return current;
      }

      return fetched[0]?.key ?? null;
    });
  };

  const refreshOptions = async ({
    categoryKey,
    includeInactiveOptions,
    signal,
  }: {
    categoryKey: MasterDataCategoryKey;
    includeInactiveOptions: boolean;
    signal?: AbortSignal;
  }) => {
    setIsLoadingOptions(true);
    try {
      const fetched = await fetchMasterDataOptionsFromBackend({
        categoryKey,
        includeInactive: includeInactiveOptions,
        signal,
      });
      setOptions(fetched);
    } finally {
      if (!signal?.aborted) {
        setIsLoadingOptions(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    setIsLoadingCategories(true);
    void refreshCategories(controller.signal)
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setCategories([]);
        setActiveCategoryKey(null);
        setNotice({
          tone: "error",
          message: readErrorMessage(error, "Gagal memuat kategori master data dari backend."),
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingCategories(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const categoryKey = activeCategoryKey;
    if (!categoryKey) {
      setOptions([]);
      return;
    }

    const controller = new AbortController();
    void refreshOptions({
      categoryKey,
      includeInactiveOptions: includeInactive,
      signal: controller.signal,
    }).catch((error: unknown) => {
      if (controller.signal.aborted) {
        return;
      }

      setOptions([]);
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Gagal memuat option master data."),
      });
    });

    return () => {
      controller.abort();
    };
  }, [activeCategoryKey, includeInactive]);

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

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const categoryKey = activeCategoryKey;
    if (!categoryKey || isCreating) {
      return;
    }

    const label = creatingForm.label.trim();
    if (!label) {
      setNotice({ tone: "error", message: "Label option wajib diisi." });
      return;
    }

    setIsCreating(true);
    try {
      const metadata = parseMetadataJson(creatingForm.metadataJson);
      await createMasterDataOptionInBackend({
        categoryKey,
        value: creatingForm.value.trim() || undefined,
        label,
        description: creatingForm.description.trim() || undefined,
        isActive: creatingForm.isActive,
        metadata,
      });

      await refreshOptions({ categoryKey, includeInactiveOptions: includeInactive });
      await refreshCategories();
      setCreatingForm(EMPTY_FORM);
      setIsCreateOpen(false);
      setNotice({ tone: "success", message: "Option master data berhasil ditambahkan." });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Gagal menambahkan option master data."),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    const optionId = editingOptionId;
    const categoryKey = activeCategoryKey;
    if (!optionId || !categoryKey || isUpdating) {
      return;
    }

    const label = editingForm.label.trim();
    if (!label) {
      setNotice({ tone: "error", message: "Label option wajib diisi." });
      return;
    }

    setIsUpdating(true);
    try {
      const metadata = parseMetadataJson(editingForm.metadataJson);
      await updateMasterDataOptionInBackend(optionId, {
        value: editingForm.value.trim(),
        label,
        description: editingForm.description,
        isActive: editingForm.isActive,
        metadata,
      });

      await refreshOptions({ categoryKey, includeInactiveOptions: includeInactive });
      await refreshCategories();
      setEditingOptionId(null);
      setEditingForm(EMPTY_FORM);
      setNotice({ tone: "success", message: "Option master data berhasil diperbarui." });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Gagal memperbarui option master data."),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (option: MasterDataOption) => {
    if (!activeCategoryKey || isUpdating) {
      return;
    }

    setIsUpdating(true);
    try {
      await updateMasterDataOptionInBackend(option.id, {
        isActive: !option.isActive,
      });
      await refreshOptions({
        categoryKey: activeCategoryKey,
        includeInactiveOptions: includeInactive,
      });
      await refreshCategories();
      setNotice({
        tone: "success",
        message: `Option ${option.label} ${option.isActive ? "dinonaktifkan" : "diaktifkan"}.`,
      });
    } catch (error: unknown) {
      setNotice({
        tone: "error",
        message: readErrorMessage(error, "Gagal mengubah status option."),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-8 pt-4 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl">
            Master Data
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
            Kelola opsi dropdown untuk invoice, user management, dan kota Saudi tanpa ubah kode.
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

      <section className="grid gap-4 lg:grid-cols-[0.95fr_2fr]">
        <article className="rounded-3xl border border-outline-variant/35 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Category</h2>
            {isLoadingCategories ? (
              <span className="text-xs font-semibold text-on-surface-variant">Loading...</span>
            ) : null}
          </div>

          <div className="space-y-2">
            {sortedCategories.map((category) => {
              const isSelected = category.key === activeCategoryKey;
              return (
                <button
                  key={category.key}
                  type="button"
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${
                    isSelected
                      ? "border-primary/35 bg-primary-fixed text-on-primary-fixed-variant"
                      : "border-outline-variant/35 bg-surface-container-low hover:border-primary/35"
                  }`}
                  onClick={() => {
                    setActiveCategoryKey(category.key);
                    setCreatingForm(EMPTY_FORM);
                    setEditingOptionId(null);
                    setEditingForm(EMPTY_FORM);
                  }}
                >
                  <p className="text-sm font-bold text-on-surface">{category.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{category.description}</p>
                  <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
                    Active {category.activeOptions} / Total {category.totalOptions}
                  </p>
                </button>
              );
            })}
          </div>
        </article>

        <article className="rounded-3xl border border-outline-variant/35 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-on-surface">
                {activeCategory?.label ?? "Select category"}
              </h2>
              <p className="text-xs text-on-surface-variant">
                {activeCategory?.description ?? "Pilih kategori di panel kiri."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-outline-variant/55"
                  checked={includeInactive}
                  onChange={(event) => setIncludeInactive(event.target.checked)}
                />
                Show inactive
              </label>
              <button
                type="button"
                className="serene-btn-primary min-h-[38px] px-3 py-1.5 text-xs"
                onClick={() => {
                  setIsCreateOpen((current) => !current);
                  setCreatingForm(EMPTY_FORM);
                }}
                disabled={!activeCategoryKey}
              >
                {isCreateOpen ? "Close Form" : "Add Option"}
              </button>
            </div>
          </div>

          {isCreateOpen && activeCategoryKey && activeCategoryFormConfig ? (
            <form className="mt-4 grid gap-2 rounded-2xl border border-outline-variant/35 bg-surface-container-low p-3" onSubmit={handleCreateSubmit}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    {activeCategoryFormConfig.valueLabel}
                  </span>
                  <input
                    className="serene-input"
                    value={creatingForm.value}
                    onChange={(event) =>
                      setCreatingForm((current) => ({ ...current, value: event.target.value }))
                    }
                    placeholder={activeCategoryFormConfig.valuePlaceholder}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    {activeCategoryFormConfig.labelLabel}
                  </span>
                  <input
                    className="serene-input"
                    value={creatingForm.label}
                    onChange={(event) =>
                      setCreatingForm((current) => ({ ...current, label: event.target.value }))
                    }
                    placeholder={activeCategoryFormConfig.labelPlaceholder}
                  />
                </label>
              </div>
              {activeCategoryFormConfig.valueHint ? (
                <p className="text-xs text-on-surface-variant">{activeCategoryFormConfig.valueHint}</p>
              ) : null}
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold text-on-surface-variant">
                  {activeCategoryFormConfig.descriptionLabel}
                </span>
                <input
                  className="serene-input"
                  value={creatingForm.description}
                  onChange={(event) =>
                    setCreatingForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder={activeCategoryFormConfig.descriptionPlaceholder}
                />
              </label>
              <p className="text-xs text-on-surface-variant">Urutan tampil ditentukan otomatis oleh sistem.</p>
              {activeCategoryFormConfig.showMetadata ? (
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    {activeCategoryFormConfig.metadataLabel}
                  </span>
                  <textarea
                    className="serene-textarea"
                    rows={3}
                    value={creatingForm.metadataJson}
                    onChange={(event) =>
                      setCreatingForm((current) => ({ ...current, metadataJson: event.target.value }))
                    }
                    placeholder={activeCategoryFormConfig.metadataPlaceholder}
                  />
                  {activeCategoryFormConfig.metadataHint ? (
                    <p className="text-xs text-on-surface-variant">
                      {activeCategoryFormConfig.metadataHint}
                    </p>
                  ) : null}
                </label>
              ) : null}
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-outline-variant/55"
                  checked={creatingForm.isActive}
                  onChange={(event) =>
                    setCreatingForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                Aktif
              </label>
              <div className="flex justify-end">
                <button type="submit" className="serene-btn-primary" disabled={isCreating}>
                  {isCreating ? "Menyimpan..." : "Simpan Option"}
                </button>
              </div>
            </form>
          ) : null}

          <div className="mt-4 overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
            {isLoadingOptions ? (
              <div className="px-4 py-5 text-sm font-medium text-on-surface-variant">Memuat option...</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-5 text-sm font-medium text-on-surface-variant">
                Belum ada option untuk kategori ini.
              </div>
            ) : (
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="border-b border-outline-variant/30 bg-surface-container-lowest">
                  <tr>
                    <th className="px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant">Value</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant">Label</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant">Sort</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant">Status</th>
                    <th className="px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-on-surface-variant">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {options.map((option) => {
                    return (
                      <tr key={option.id} className="align-top">
                        <td className="px-3 py-2 font-mono text-xs text-on-surface">{option.value}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-on-surface">{option.label}</p>
                          {option.description ? (
                            <p className="mt-0.5 text-xs text-on-surface-variant">{option.description}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-on-surface-variant">{option.sortOrder}</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                              option.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-700"
                            }`}
                            onClick={() => void handleToggleActive(option)}
                            disabled={isUpdating}
                          >
                            {option.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="inline-flex rounded-lg border border-outline-variant/45 px-2.5 py-1 text-xs font-semibold text-on-surface transition hover:border-primary/40"
                            onClick={() => {
                              setEditingOptionId(option.id);
                              setEditingForm(createFormFromOption(option));
                            }}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {editingOptionId && activeCategoryFormConfig ? (
            <section className="mt-4 rounded-2xl border border-outline-variant/35 bg-surface-container-low p-3">
              <h3 className="text-sm font-bold text-on-surface">Edit Option</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    {activeCategoryFormConfig.valueLabel}
                  </span>
                  <input
                    className="serene-input"
                    value={editingForm.value}
                    onChange={(event) =>
                      setEditingForm((current) => ({ ...current, value: event.target.value }))
                    }
                    placeholder={activeCategoryFormConfig.valuePlaceholder}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    {activeCategoryFormConfig.labelLabel}
                  </span>
                  <input
                    className="serene-input"
                    value={editingForm.label}
                    onChange={(event) =>
                      setEditingForm((current) => ({ ...current, label: event.target.value }))
                    }
                    placeholder={activeCategoryFormConfig.labelPlaceholder}
                  />
                </label>
              </div>
              <label className="mt-2 grid gap-1">
                <span className="text-[11px] font-semibold text-on-surface-variant">
                  {activeCategoryFormConfig.descriptionLabel}
                </span>
                <input
                  className="serene-input"
                  value={editingForm.description}
                  onChange={(event) =>
                    setEditingForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder={activeCategoryFormConfig.descriptionPlaceholder}
                />
              </label>
              <p className="mt-2 text-xs text-on-surface-variant">
                Urutan tampil ditentukan otomatis oleh sistem.
              </p>
              {activeCategoryFormConfig.showMetadata ? (
                <label className="mt-2 grid gap-1">
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    {activeCategoryFormConfig.metadataLabel}
                  </span>
                  <textarea
                    className="serene-textarea"
                    rows={3}
                    value={editingForm.metadataJson}
                    onChange={(event) =>
                      setEditingForm((current) => ({ ...current, metadataJson: event.target.value }))
                    }
                    placeholder={activeCategoryFormConfig.metadataPlaceholder}
                  />
                  {activeCategoryFormConfig.metadataHint ? (
                    <p className="text-xs text-on-surface-variant">
                      {activeCategoryFormConfig.metadataHint}
                    </p>
                  ) : null}
                </label>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-outline-variant/55"
                    checked={editingForm.isActive}
                    onChange={(event) =>
                      setEditingForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                  />
                  Aktif
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="serene-btn-secondary"
                    onClick={() => {
                      setEditingOptionId(null);
                      setEditingForm(EMPTY_FORM);
                    }}
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    className="serene-btn-primary"
                    onClick={() => void handleSaveEdit()}
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}
        </article>
      </section>
    </div>
  );
}
