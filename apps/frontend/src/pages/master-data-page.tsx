import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod/v4";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import {
  useCreateMasterDataOptionMutation,
  useMasterDataCategoriesQuery,
  useMasterDataOptionsQuery,
  useUpdateMasterDataOptionMutation,
} from "../hooks/use-master-data-query";
import type { MasterDataCategoryKey, MasterDataOption } from "../hooks/use-master-data-backend";
import { useThemeMode } from "../theme/theme-provider";

type NoticeState = {
  tone: "success" | "error";
  message: string;
};

type MasterDataOptionFormValues = {
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

const EMPTY_FORM: MasterDataOptionFormValues = {
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

const masterDataOptionFormSchema = z.object({
  value: z.string(),
  label: z.string().trim().min(1, "Label option wajib diisi."),
  description: z.string(),
  isActive: z.boolean(),
  metadataJson: z.string().superRefine((value, context) => {
    try {
      parseMetadataJson(value);
    } catch (error: unknown) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error && error.message.trim() ? error.message.trim() : "Metadata JSON tidak valid.",
      });
    }
  }),
});

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

function createFormFromOption(option: MasterDataOption): MasterDataOptionFormValues {
  return {
    value: option.value,
    label: option.label,
    description: option.description ?? "",
    isActive: option.isActive,
    metadataJson: option.metadata ? JSON.stringify(option.metadata, null, 2) : "",
  };
}

function getStatusButtonClassName(isActive: boolean, isDarkMode: boolean): string {
  return `inline-flex min-w-[88px] justify-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition ${
    isActive
      ? isDarkMode
        ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-100 hover:border-emerald-300/60 hover:bg-emerald-500/24"
        : "border-emerald-200 bg-emerald-100/90 text-emerald-800 hover:border-emerald-300 hover:bg-emerald-100"
      : isDarkMode
        ? "border-slate-500/55 bg-slate-700/32 text-slate-100 hover:border-slate-400/70 hover:bg-slate-700/44"
        : "border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200"
  }`;
}

function MasterDataOptionForm({
  config,
  initialValues,
  resetToken,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  config: CategoryFormConfig;
  initialValues: MasterDataOptionFormValues;
  resetToken: number | string;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: MasterDataOptionFormValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MasterDataOptionFormValues>({
    resolver: zodResolver(masterDataOptionFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset, resetToken]);

  return (
    <form
      className="grid gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4"
      onSubmit={handleSubmit((values) => void onSubmit(values))}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            {config.valueLabel}
          </span>
          <input className="serene-input" {...register("value")} placeholder={config.valuePlaceholder} />
        </label>

        <label className="grid gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            {config.labelLabel}
          </span>
          <input className="serene-input" {...register("label")} placeholder={config.labelPlaceholder} />
          {errors.label ? <p className="text-xs font-semibold text-error">{errors.label.message}</p> : null}
        </label>
      </div>

      {config.valueHint ? (
        <p className="rounded-md border border-outline-variant/30 bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant">
          {config.valueHint}
        </p>
      ) : null}

      <label className="grid gap-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
          {config.descriptionLabel}
        </span>
        <input className="serene-input" {...register("description")} placeholder={config.descriptionPlaceholder} />
      </label>

      <p className="text-xs text-on-surface-variant">Urutan tampil ditentukan otomatis oleh sistem.</p>

      {config.showMetadata ? (
        <label className="grid gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            {config.metadataLabel}
          </span>
          <textarea
            className="serene-textarea"
            rows={3}
            {...register("metadataJson")}
            placeholder={config.metadataPlaceholder}
          />
          {errors.metadataJson ? (
            <p className="text-xs font-semibold text-error">{errors.metadataJson.message}</p>
          ) : null}
          {config.metadataHint ? <p className="text-xs text-on-surface-variant">{config.metadataHint}</p> : null}
        </label>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          <input type="checkbox" className="h-4 w-4 rounded border-outline-variant/55" {...register("isActive")} />
          Aktif
        </label>

        <div className="flex items-center gap-2">
          {onCancel ? (
            <button type="button" className="serene-btn-secondary min-h-[38px] px-4 py-2 text-xs" onClick={onCancel}>
              Batal
            </button>
          ) : null}
          <button type="submit" className="serene-btn-primary min-h-[38px] px-4 py-2 text-xs" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
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
    <div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface sm:text-[2.2rem]">
            Master Data
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-on-surface-variant">
            Kelola opsi dropdown untuk invoice, user management, dan kota Saudi tanpa ubah kode.
          </p>
        </div>

        <ThemeToggleButton className="inline-flex h-10 w-10 shrink-0 self-end items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary sm:ml-auto sm:self-auto" />
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

      <section className="grid gap-4 lg:grid-cols-[0.92fr_2.08fr]">
        <article className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-ambient">
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Category</h2>
              <p className="mt-1 text-xs text-on-surface-variant">Pilih kategori master data.</p>
            </div>
            {categoriesQuery.isLoading ? (
              <span className="text-xs font-semibold text-on-surface-variant">Loading...</span>
            ) : null}
          </div>

          <div className="space-y-1 p-2">
            {sortedCategories.map((category) => {
              const isSelected = category.key === activeCategoryKey;
              return (
                <button
                  key={category.key}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                    isSelected
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:border-outline-variant/35 hover:bg-surface-container-low"
                  }`}
                  onClick={() => handleSelectCategory(category.key)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface">{category.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{category.description}</p>
                    </div>
                    <span className="shrink-0 rounded-md border border-outline-variant/35 bg-surface-container-lowest px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                      {category.activeOptions}/{category.totalOptions}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

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
                <div className="space-y-2 p-2 sm:hidden">
                  {options.map((option) => (
                    <article
                      key={`${option.id}-mobile`}
                      className="rounded-lg border border-outline-variant/35 bg-surface-container-low p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="break-all font-mono text-[11px] text-on-surface-variant">{option.value}</p>
                          <p className="mt-1 text-sm font-semibold text-on-surface">{option.label}</p>
                          {option.description ? (
                            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{option.description}</p>
                          ) : null}
                          <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">
                            Sort {option.sortOrder}
                          </p>
                        </div>

                        <button
                          type="button"
                          className={`${getStatusButtonClassName(option.isActive, isDarkMode)} shrink-0`}
                          onClick={() => void handleToggleActive(option)}
                          disabled={updateMutation.isPending}
                        >
                          {option.isActive ? "Active" : "Inactive"}
                        </button>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="inline-flex min-h-[34px] items-center rounded-md border border-outline-variant/45 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition hover:border-primary/45 hover:text-primary"
                          onClick={() => setEditingOptionId(option.id)}
                        >
                          Edit
                        </button>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                    <colgroup>
                      <col className="w-[21%]" />
                      <col className="w-[35%]" />
                      <col className="w-[10%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead className="border-b border-outline-variant/30 bg-surface-container-low">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                          Value
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                          Label
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                          Sort
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                          Status
                        </th>
                        <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {options.map((option) => (
                        <tr key={option.id} className="align-middle transition hover:bg-primary/5">
                          <td className="break-all px-4 py-3 font-mono text-[11px] text-on-surface-variant">
                            {option.value}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-on-surface">{option.label}</p>
                            {option.description ? (
                              <p className="mt-0.5 text-xs text-on-surface-variant">{option.description}</p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-on-surface-variant">
                            {option.sortOrder}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              className={getStatusButtonClassName(option.isActive, isDarkMode)}
                              onClick={() => void handleToggleActive(option)}
                              disabled={updateMutation.isPending}
                            >
                              {option.isActive ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <button
                              type="button"
                              className="inline-flex min-h-[34px] items-center rounded-md border border-outline-variant/45 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition hover:border-primary/45 hover:text-primary"
                              onClick={() => setEditingOptionId(option.id)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {editingOptionId && activeCategoryFormConfig ? (
            <section className="mx-4 mt-4 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4 sm:mx-5 sm:mb-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-on-surface-variant">Edit Option</h3>

              <div className="mt-3">
                <MasterDataOptionForm
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
