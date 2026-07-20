import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod/v4";
import { SereneSelect } from "../../../components/serene-select";
import { DialogShell } from "../../../components/dialog-shell";
import { useModalFocusTrap } from "../../../components/use-modal-focus-trap";
import type { MasterDataCategoryKey, MasterDataOption } from "../../../hooks/use-master-data-backend";

// ==========================================
// FORM SCHEMAS & CONFIG TYPES
// ==========================================

export type CategoryFormConfig = {
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

export type MasterDataOptionFormValues = {
  value: string;
  label: string;
  description: string;
  isActive: boolean;
  metadataJson: string;
};

export const EMPTY_FORM: MasterDataOptionFormValues = {
  value: "",
  label: "",
  description: "",
  isActive: true,
  metadataJson: "",
};

export function MasterDataDeleteConfirmModal({
  isOpen,
  itemLabel,
  itemType,
  isDeleting,
  errorMessage,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  itemLabel: string;
  itemType: string;
  isDeleting: boolean;
  errorMessage?: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogShell isOpen={isOpen} onClose={onClose} title={`Hapus ${itemType}`} size="sm">
      <div className="p-5">
        <div className="flex items-start gap-3 rounded-2xl border border-error/25 bg-error-container/45 p-4 text-on-error-container">
          <span className="material-symbols-outlined mt-0.5 text-xl" aria-hidden="true">
            warning
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">Hapus “{itemLabel}”?</p>
            <p className="mt-1 text-xs font-medium leading-relaxed">
              Penghapusan akan ditolak jika data ini masih digunakan oleh group, invoice, user, atau data operasional
              lain.
            </p>
          </div>
        </div>
        {errorMessage ? (
          <p
            className="mt-3 rounded-xl border border-error/25 bg-error-container/45 px-3 py-2 text-xs font-semibold leading-relaxed text-on-error-container"
            role="alert"
          >
            {errorMessage}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="serene-btn-secondary" onClick={onClose} disabled={isDeleting}>
            Batal
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-error px-4 py-2 text-sm font-semibold text-on-error transition disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              delete
            </span>
            {isDeleting ? "Menghapus..." : "Ya, hapus"}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

export function parseMetadataJson(value: string): Record<string, unknown> | undefined {
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

export function getStatusButtonClassName(isActive: boolean, isDarkMode: boolean): string {
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

export function MasterDataFormDrawer({
  isOpen,
  title,
  description,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const drawerRef = useModalFocusTrap<HTMLElement>({ isActive: isOpen, onClose });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[180] bg-scrim/35 backdrop-blur-[2px]" onMouseDown={onClose}>
      <aside
        ref={drawerRef}
        className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-outline-variant/40 bg-surface-container-lowest shadow-float animate-page-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-data-drawer-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant/30 px-5 py-5 sm:px-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Master Data</p>
            <h2 id="master-data-drawer-title" className="mt-1 font-display text-2xl font-bold text-on-surface">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{description}</p>
          </div>
          <button
            type="button"
            className="serene-focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/40 text-on-surface-variant transition hover:border-primary/45 hover:text-primary"
            onClick={onClose}
            aria-label="Tutup formulir"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

// ==========================================
// 1. MASTER DATA OPTION FORM
// ==========================================

export function MasterDataOptionForm({
  categoryKey,
  config,
  initialValues,
  resetToken,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  categoryKey: string;
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
    setValue,
    formState: { errors },
  } = useForm<MasterDataOptionFormValues>({
    resolver: zodResolver(masterDataOptionFormSchema),
    defaultValues: initialValues,
  });

  const [bankName, setBankName] = useState("");
  const [bankAccountNum, setBankAccountNum] = useState("");
  const [bankBeneficiary, setBankBeneficiary] = useState("");

  useEffect(() => {
    if (categoryKey === "bank-disbursement") {
      const labelValue = initialValues.label || "";
      const chunks = labelValue
        .split(" - ")
        .map((s) => s.trim())
        .filter(Boolean);
      if (chunks.length >= 2) {
        setBankName(chunks[0]);
        setBankAccountNum(chunks.slice(1).join(" - "));
      } else {
        setBankName(labelValue);
        setBankAccountNum("");
      }

      try {
        const meta = parseMetadataJson(initialValues.metadataJson);
        setBankBeneficiary(typeof meta?.penerima === "string" ? meta.penerima : "");
      } catch {
        setBankBeneficiary("");
      }
    }
  }, [initialValues, resetToken, categoryKey]);

  useEffect(() => {
    if (categoryKey === "bank-disbursement") {
      const combinedLabel = `${bankName.trim()} - ${bankAccountNum.trim()}`;
      setValue("label", combinedLabel);

      const metaObj = {
        bankName: bankName.trim(),
        accountNumber: bankAccountNum.trim(),
        penerima: bankBeneficiary.trim(),
      };
      setValue("metadataJson", JSON.stringify(metaObj, null, 2));
    }
  }, [bankName, bankAccountNum, bankBeneficiary, setValue, categoryKey]);

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset, resetToken]);

  return (
    <form className="serene-form-section grid gap-3" onSubmit={handleSubmit((values) => void onSubmit(values))}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={`grid gap-1 ${categoryKey === "bank-disbursement" ? "sm:col-span-2" : ""}`}>
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
            {config.valueLabel}
          </span>
          <input className="serene-input" {...register("value")} placeholder={config.valuePlaceholder} />
        </label>

        {categoryKey === "bank-disbursement" ? null : (
          <label className="grid gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
              {config.labelLabel}
            </span>
            <input className="serene-input" {...register("label")} placeholder={config.labelPlaceholder} />
            {errors.label ? <p className="text-xs font-semibold text-error">{errors.label.message}</p> : null}
          </label>
        )}
      </div>

      {categoryKey === "bank-disbursement" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">Nama Bank</span>
            <input
              className="serene-input"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="contoh: BCA"
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
              Nomor Rekening
            </span>
            <input
              className="serene-input"
              value={bankAccountNum}
              onChange={(e) => setBankAccountNum(e.target.value)}
              placeholder="contoh: 035 123 4455"
              required
            />
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
              Atas Nama Pemilik Rekening
            </span>
            <input
              className="serene-input"
              value={bankBeneficiary}
              onChange={(e) => setBankBeneficiary(e.target.value)}
              placeholder="contoh: PT Ghaniya Tour Travel"
              required
            />
          </label>
        </div>
      )}

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

      {config.showMetadata && categoryKey !== "bank-disbursement" ? (
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

      <div className="serene-form-actions-split">
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-on-surface-variant">
          <input type="checkbox" className="h-4 w-4 rounded border-outline-variant/55" {...register("isActive")} />
          Aktif
        </label>

        <div className="serene-form-actions">
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

// ==========================================
// 2. MASTER DATA CATEGORY TABS
// ==========================================

export type MasterDataCategoryTabKey = MasterDataCategoryKey | "agents";

export function MasterDataCategoryTabs({
  categories,
  activeCategoryKey,
  onSelectCategory,
  isLoading,
}: {
  categories: Array<{
    key: MasterDataCategoryTabKey;
    label: string;
    description: string;
    activeOptions: number;
    totalOptions: number;
  }>;
  activeCategoryKey: MasterDataCategoryTabKey | null;
  onSelectCategory: (categoryKey: MasterDataCategoryTabKey) => void;
  isLoading: boolean;
}) {
  const [categorySearch, setCategorySearch] = useState("");
  const visibleCategories = useMemo(() => {
    const normalizedSearch = categorySearch.trim().toLocaleLowerCase("id-ID");
    if (!normalizedSearch) {
      return categories;
    }

    return categories.filter((category) => category.label.toLocaleLowerCase("id-ID").includes(normalizedSearch));
  }, [categories, categorySearch]);
  const optionCategories = visibleCategories.filter((category) => category.key !== "agents");
  const operationalCategories = visibleCategories.filter((category) => category.key === "agents");
  const activeCategory = categories.find((category) => category.key === activeCategoryKey) ?? null;

  const renderCategoryButton = (category: (typeof categories)[number]) => {
    const isSelected = category.key === activeCategoryKey;
    return (
      <button
        key={category.key}
        type="button"
        className={`serene-focus-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
          isSelected
            ? "border-primary/35 bg-primary/10 text-primary"
            : "border-transparent text-on-surface hover:border-outline-variant/35 hover:bg-surface-container-low"
        }`}
        onClick={() => onSelectCategory(category.key)}
        aria-current={isSelected ? "page" : undefined}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          {category.key === "agents" ? "person" : "dataset"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{category.label}</span>
        <span className="shrink-0 rounded-full border border-outline-variant/35 bg-surface-container-lowest px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
          {category.activeOptions}/{category.totalOptions}
        </span>
      </button>
    );
  };

  return (
    <>
      <article className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-4 shadow-ambient lg:hidden">
        <label className="grid gap-2" htmlFor="master-data-category-mobile">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
            Kategori data
          </span>
          <SereneSelect
            id="master-data-category-mobile"
            className="serene-select min-h-11 w-full pr-10"
            value={activeCategoryKey ?? ""}
            onChange={(event) => onSelectCategory(event.target.value as MasterDataCategoryTabKey)}
            aria-label="Pilih kategori master data"
          >
            {categories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label} · {category.activeOptions}/{category.totalOptions} aktif
              </option>
            ))}
          </SereneSelect>
        </label>
        {activeCategory ? (
          <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{activeCategory.description}</p>
        ) : null}
      </article>

      <article className="hidden self-start overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-ambient lg:block">
        <div className="border-b border-outline-variant/30 px-4 py-4">
          <div>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Kategori data</h2>
            <p className="mt-1 text-xs text-on-surface-variant">Pilih data yang akan dikelola.</p>
          </div>
          {isLoading ? (
            <span className="mt-2 block text-xs font-semibold text-on-surface-variant">Memuat kategori...</span>
          ) : null}
          <label className="relative mt-3 block">
            <span
              className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant"
              aria-hidden="true"
            >
              search
            </span>
            <input
              className="serene-input serene-input-sm w-full pl-9"
              value={categorySearch}
              onChange={(event) => setCategorySearch(event.target.value)}
              placeholder="Cari kategori..."
              aria-label="Cari kategori master data"
            />
          </label>
        </div>

        <nav className="space-y-1 p-2" aria-label="Kategori master data">
          {optionCategories.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Opsi sistem
              </p>
              {optionCategories.map(renderCategoryButton)}
            </>
          ) : null}
          {operationalCategories.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Entitas operasional
              </p>
              {operationalCategories.map(renderCategoryButton)}
            </>
          ) : null}
          {visibleCategories.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-on-surface-variant">Kategori tidak ditemukan.</p>
          ) : null}
        </nav>
      </article>
    </>
  );
}

// ==========================================
// 3. MASTER DATA OPTION TABLE
// ==========================================

export function MasterDataOptionTable({
  options,
  isDarkMode,
  updatePending,
  deletePending,
  onToggleActive,
  onEditOption,
  onDeleteOption,
}: {
  options: MasterDataOption[];
  isDarkMode: boolean;
  updatePending: boolean;
  deletePending: boolean;
  onToggleActive: (option: MasterDataOption) => void | Promise<void>;
  onEditOption: (optionId: string) => void;
  onDeleteOption: (option: MasterDataOption) => void;
}) {
  return (
    <>
      {/* MOBILE LIST */}
      <div className="space-y-2 p-2 md:hidden">
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
                <p className="mt-1 text-[11px] font-semibold text-on-surface-variant">Urutan {option.sortOrder}</p>
              </div>

              <button
                type="button"
                className={`${getStatusButtonClassName(option.isActive, isDarkMode)} shrink-0`}
                onClick={() => void onToggleActive(option)}
                disabled={updatePending}
              >
                {option.isActive ? "Aktif" : "Nonaktif"}
              </button>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="serene-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant transition hover:border-primary/45 hover:text-primary"
                onClick={() => onEditOption(option.id)}
                aria-label={`Edit ${option.label}`}
                title="Edit data"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  edit
                </span>
              </button>
              <button
                type="button"
                className="serene-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-error/30 bg-surface-container-lowest text-error transition hover:bg-error-container/45 disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => onDeleteOption(option)}
                disabled={deletePending}
                aria-label={`Hapus ${option.label}`}
                title="Hapus data"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  delete
                </span>
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-sm">
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
                Nilai
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Nama tampilan
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Urutan
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Status
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {options.map((option) => (
              <tr key={option.id} className="align-middle transition hover:bg-primary/5">
                <td className="break-all px-4 py-3 font-mono text-[11px] text-on-surface-variant">{option.value}</td>
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
                    onClick={() => void onToggleActive(option)}
                    disabled={updatePending}
                  >
                    {option.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="serene-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant transition hover:border-primary/45 hover:text-primary"
                      onClick={() => onEditOption(option.id)}
                      aria-label={`Edit ${option.label}`}
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        edit
                      </span>
                    </button>
                    <button
                      type="button"
                      className="serene-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-error/30 bg-surface-container-lowest text-error transition hover:bg-error-container/45 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => onDeleteOption(option)}
                      disabled={deletePending}
                      aria-label={`Hapus ${option.label}`}
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        delete
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
