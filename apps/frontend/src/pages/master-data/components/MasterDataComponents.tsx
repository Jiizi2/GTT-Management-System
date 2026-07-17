import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod/v4";
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
      const chunks = labelValue.split(" - ").map((s) => s.trim()).filter(Boolean);
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
        <label className="grid gap-1">
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
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
              Nama Bank
            </span>
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

          <label className="grid gap-1">
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
  categories: Array<{ key: MasterDataCategoryTabKey; label: string; description: string; activeOptions: number; totalOptions: number }>;
  activeCategoryKey: MasterDataCategoryTabKey | null;
  onSelectCategory: (categoryKey: MasterDataCategoryTabKey) => void;
  isLoading: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-ambient">
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant/30 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">Category</h2>
          <p className="mt-1 text-xs text-on-surface-variant">Pilih kategori master data.</p>
        </div>
        {isLoading ? (
          <span className="text-xs font-semibold text-on-surface-variant">Loading...</span>
        ) : null}
      </div>

      <div className="space-y-1 p-2">
        {categories.map((category) => {
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
              onClick={() => onSelectCategory(category.key)}
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
  );
}

// ==========================================
// 3. MASTER DATA OPTION TABLE
// ==========================================

export function MasterDataOptionTable({
  options,
  isDarkMode,
  updatePending,
  onToggleActive,
  onEditOption,
}: {
  options: MasterDataOption[];
  isDarkMode: boolean;
  updatePending: boolean;
  onToggleActive: (option: MasterDataOption) => void | Promise<void>;
  onEditOption: (optionId: string) => void;
}) {
  return (
    <>
      {/* MOBILE LIST */}
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
                onClick={() => void onToggleActive(option)}
                disabled={updatePending}
              >
                {option.isActive ? "Active" : "Inactive"}
              </button>
            </div>

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="inline-flex min-h-[34px] items-center rounded-md border border-outline-variant/45 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition hover:border-primary/45 hover:text-primary"
                onClick={() => onEditOption(option.id)}
              >
                Edit
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* DESKTOP TABLE */}
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
                    onClick={() => void onToggleActive(option)}
                    disabled={updatePending}
                  >
                    {option.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <button
                    type="button"
                    className="inline-flex min-h-[34px] items-center rounded-md border border-outline-variant/45 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition hover:border-primary/45 hover:text-primary"
                    onClick={() => onEditOption(option.id)}
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
  );
}
