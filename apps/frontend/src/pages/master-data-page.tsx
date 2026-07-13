import { useEffect, useMemo, useState } from "react";
import { PageHeroSection } from "../components/page-hero-section";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import {
  useCreateMasterDataOptionMutation,
  useMasterDataCategoriesQuery,
  useMasterDataOptionsQuery,
  useUpdateMasterDataOptionMutation,
} from "../hooks/use-master-data-query";
import type { MasterDataCategoryKey, MasterDataOption } from "../hooks/use-master-data-backend";
import { useThemeMode } from "../theme/theme-provider";
import {
  EMPTY_FORM,
  parseMetadataJson,
  MasterDataOptionForm,
  MasterDataCategoryTabs,
  MasterDataOptionTable,
  type MasterDataOptionFormValues,
  type CategoryFormConfig,
} from "./master-data/components/MasterDataComponents";

type NoticeState = {
  tone: "success" | "error";
  message: string;
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
  const [activeCategoryKey, setActiveCategoryKey] = useState<MasterDataCategoryKey | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [createFormResetToken, setCreateFormResetToken] = useState(0);
  const createMutation = useCreateMasterDataOptionMutation();
  const updateMutation = useUpdateMasterDataOptionMutation();

  const sortedCategories = useMemo(
    () => [...(categoriesQuery.data ?? [])].sort((left, right) => left.label.localeCompare(right.label)),
    [categoriesQuery.data],
  );

  useEffect(() => {
    setActiveCategoryKey((current) => {
      if (current && sortedCategories.some((category) => category.key === current)) {
        return current;
      }

      return sortedCategories[0]?.key ?? null;
    });
  }, [sortedCategories]);

  const activeCategory =
    activeCategoryKey !== null
      ? (sortedCategories.find((category) => category.key === activeCategoryKey) ?? null)
      : null;
  const activeCategoryFormConfig = activeCategoryKey !== null ? CATEGORY_FORM_CONFIG[activeCategoryKey] : null;

  const optionsQuery = useMasterDataOptionsQuery({
    categoryKey: activeCategoryKey ?? "invoice-issuing-office",
    includeInactive,
    enabled: activeCategoryKey !== null,
  });
  const options = useMemo(() => optionsQuery.data ?? [], [optionsQuery.data]);
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

  const handleSelectCategory = (categoryKey: MasterDataCategoryKey) => {
    setActiveCategoryKey(categoryKey);
    setIsCreateOpen(false);
    setEditingOptionId(null);
    setCreateFormResetToken((current) => current + 1);
  };

  const handleCreateSubmit = async (values: MasterDataOptionFormValues) => {
    if (!activeCategoryKey) {
      return;
    }

    try {
      await createMutation.mutateAsync({
        categoryKey: activeCategoryKey,
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
      <PageHeroSection
        eyebrow="Master Data Control"
        title="Master Data"
        description="Kelola opsi dropdown untuk invoice, user management, dan kota Saudi tanpa ubah kode."
        actions={<ThemeToggleButton />}
      />

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

      <section className="grid gap-4 lg:grid-cols-[0.92fr_2.08fr]">
        <MasterDataCategoryTabs
          categories={sortedCategories}
          activeCategoryKey={activeCategoryKey}
          onSelectCategory={handleSelectCategory}
          isLoading={categoriesQuery.isLoading}
        />

        <article className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest pb-4 shadow-ambient sm:pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/30 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Option Table</p>
              <h2 className="mt-1 text-xl font-bold text-on-surface">{activeCategory?.label ?? "Select category"}</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {activeCategory?.description ?? "Pilih kategori di panel kiri."}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
                Menampilkan {options.length} option
                {includeInactive ? " (termasuk inactive)." : "."}
              </p>
            </div>

            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
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
                className="serene-btn-primary min-h-[38px] w-full px-3 py-1.5 text-xs sm:w-auto sm:px-4"
                onClick={() => {
                  setIsCreateOpen((current) => !current);
                  setCreateFormResetToken((current) => current + 1);
                }}
                disabled={!activeCategoryKey}
              >
                {isCreateOpen ? "Close Form" : "Add Option"}
              </button>
            </div>
          </div>

          {isCreateOpen && activeCategoryFormConfig ? (
            <div className="mx-4 mt-4 sm:mx-5">
              <MasterDataOptionForm
                categoryKey={activeCategoryKey ?? ""}
                config={activeCategoryFormConfig}
                initialValues={EMPTY_FORM}
                resetToken={`${activeCategoryKey ?? "none"}-${createFormResetToken}`}
                submitLabel="Simpan Option"
                isSubmitting={createMutation.isPending}
                onSubmit={handleCreateSubmit}
              />
            </div>
          ) : null}

          <div className="mx-4 mt-4 overflow-hidden rounded-xl border border-outline-variant/35 bg-surface-container-lowest sm:mx-5">
            {optionsQuery.isLoading ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">Memuat option...</div>
            ) : options.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">
                Belum ada option untuk kategori ini.
              </div>
            ) : (
              <>
                <MasterDataOptionTable
                  options={options}
                  isDarkMode={isDarkMode}
                  updatePending={updateMutation.isPending}
                  onToggleActive={handleToggleActive}
                  onEditOption={setEditingOptionId}
                />
              </>
            )}
          </div>

          {editingOptionId && activeCategoryFormConfig ? (
            <section className="mx-4 mt-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:mx-5 sm:mb-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">Edit Option</h3>

              <div className="mt-3">
                <MasterDataOptionForm
                  categoryKey={activeCategoryKey ?? ""}
                  config={activeCategoryFormConfig}
                  initialValues={editingInitialValues}
                  resetToken={editingOptionId}
                  submitLabel="Simpan Perubahan"
                  isSubmitting={updateMutation.isPending}
                  onSubmit={handleSaveEdit}
                  onCancel={() => setEditingOptionId(null)}
                />
              </div>
            </section>
          ) : null}
        </article>
      </section>
    </div>
  );
}
