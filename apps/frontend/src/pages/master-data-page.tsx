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
import { useAgentsQuery } from "../hooks/use-agents-backend";
import { useThemeMode } from "../theme/theme-provider";
import { AgentsScreen } from "./agents-page";
import {
  EMPTY_FORM,
  parseMetadataJson,
  MasterDataOptionForm,
  MasterDataFormDrawer,
  MasterDataCategoryTabs,
  MasterDataOptionTable,
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
  const [activeCategoryKey, setActiveCategoryKey] = useState<MasterDataCategoryTabKey | null>(null);
  const [statusFilter, setStatusFilter] = useState<OptionStatusFilter>("active");
  const [optionSearch, setOptionSearch] = useState("");
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
  const categoryTabs = useMemo(() => {
    const agents = agentsQuery.data ?? [];
    return [
      ...sortedCategories,
      {
        key: "agents" as const,
        label: "Agen",
        description: "Kelola agen pemilik grup dan transaksi operasional.",
        activeOptions: agents.filter((agent) => agent.status === "ACTIVE").length,
        totalOptions: agents.length,
      },
    ];
  }, [agentsQuery.data, sortedCategories]);

  useEffect(() => {
    setActiveCategoryKey((current) => {
      if (current && categoryTabs.some((category) => category.key === current)) {
        return current;
      }

      const firstMasterDataCategory = categoryTabs.find((category) => category.key !== "agents");
      if (firstMasterDataCategory) {
        return firstMasterDataCategory.key;
      }

      return categoriesQuery.isLoading ? null : (categoryTabs[0]?.key ?? null);
    });
  }, [categoriesQuery.isLoading, categoryTabs]);

  const activeCategory =
    activeCategoryKey !== null && activeCategoryKey !== "agents"
      ? (sortedCategories.find((category) => category.key === activeCategoryKey) ?? null)
      : null;
  const activeCategoryFormConfig =
    activeCategoryKey !== null && activeCategoryKey !== "agents" ? CATEGORY_FORM_CONFIG[activeCategoryKey] : null;

  const optionsQuery = useMasterDataOptionsQuery({
    categoryKey: activeCategoryKey && activeCategoryKey !== "agents" ? activeCategoryKey : "invoice-issuing-office",
    includeInactive: statusFilter !== "active",
    enabled: activeCategoryKey !== null && activeCategoryKey !== "agents",
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

      return [option.value, option.label, option.description ?? ""]
        .some((value) => value.toLocaleLowerCase("id-ID").includes(normalizedSearch));
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
    setOptionSearch("");
    setStatusFilter("active");
    setCreateFormResetToken((current) => current + 1);
  };

  const handleCreateSubmit = async (values: MasterDataOptionFormValues) => {
    if (!activeCategoryKey || activeCategoryKey === "agents") {
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

      <section className="grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <MasterDataCategoryTabs
          categories={categoryTabs}
          activeCategoryKey={activeCategoryKey}
          onSelectCategory={handleSelectCategory}
          isLoading={categoriesQuery.isLoading}
        />

        {activeCategoryKey === "agents" ? (
          <AgentsScreen embedded />
        ) : (
        <article className="min-w-0 overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest pb-4 shadow-ambient sm:pb-5">
          <div className="border-b border-outline-variant/30 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Daftar data</p>
              <h2 className="mt-1 text-xl font-bold text-on-surface">{activeCategory?.label ?? "Select category"}</h2>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {activeCategory?.description ?? "Pilih kategori di panel kiri."}
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
                <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
                Tambah data
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <label className="relative block min-w-0 flex-1 xl:max-w-md">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" aria-hidden="true">search</span>
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
              <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">Memuat option...</div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm font-medium text-on-surface-variant">
                {options.length === 0 ? "Belum ada data untuk kategori ini." : "Tidak ada data yang sesuai pencarian atau filter."}
              </div>
            ) : (
                <MasterDataOptionTable
                  options={filteredOptions}
                  isDarkMode={isDarkMode}
                  updatePending={updateMutation.isPending}
                  onToggleActive={handleToggleActive}
                  onEditOption={(optionId) => {
                    setEditingOptionId(optionId);
                    setIsCreateOpen(false);
                  }}
                />
            )}
          </div>
        </article>
        )}
      </section>

      {activeCategoryFormConfig ? (
        <MasterDataFormDrawer
          isOpen={isCreateOpen || Boolean(editingOptionId)}
          title={editingOptionId ? `Edit ${editingOption?.label ?? "data"}` : `Tambah ${activeCategory?.label ?? "data"}`}
          description={editingOptionId ? "Perbarui informasi data tanpa meninggalkan daftar." : "Tambahkan data baru pada kategori yang sedang aktif."}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingOptionId(null);
          }}
        >
          <MasterDataOptionForm
            categoryKey={activeCategoryKey ?? ""}
            config={activeCategoryFormConfig}
            initialValues={editingOptionId ? editingInitialValues : EMPTY_FORM}
            resetToken={editingOptionId ?? `${activeCategoryKey ?? "none"}-${createFormResetToken}`}
            submitLabel={editingOptionId ? "Simpan perubahan" : "Simpan data"}
            isSubmitting={editingOptionId ? updateMutation.isPending : createMutation.isPending}
            onSubmit={editingOptionId ? handleSaveEdit : handleCreateSubmit}
            onCancel={() => {
              setIsCreateOpen(false);
              setEditingOptionId(null);
            }}
          />
        </MasterDataFormDrawer>
      ) : null}
    </div>
  );
}
