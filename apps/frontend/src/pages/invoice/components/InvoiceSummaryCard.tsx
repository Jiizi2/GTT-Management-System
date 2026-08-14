import { memo, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { SereneSelect } from "../../../components/serene-select";
import {
  deriveInvoiceState,
  formatNumberInput,
  getStatusClasses,
  resolveInvoiceOutstandingBalanceLabel,
} from "../helpers/invoice-page-shared";

export const InvoiceSummaryCard = memo(function InvoiceSummaryCard({
  usdToIdr,
  sarToIdr,
  keepValasCurrency,
  handleKeepValasCurrencyChange,
  isDarkMode,
  invoiceCurrency,
}: {
  usdToIdr: number;
  sarToIdr: number;
  keepValasCurrency: "IDR" | "USD" | "SAR";
  handleKeepValasCurrencyChange: (val: "IDR" | "USD" | "SAR") => void;
  isDarkMode: boolean;
  invoiceCurrency: string;
}) {
  const { control } = useFormContext();
  const items = useWatch({ control, name: "items" }) || [];
  const payments = useWatch({ control, name: "payments" }) || [];
  const dueDateIso = useWatch({ control, name: "dueDateIso" });
  const discountIdr = useWatch({ control, name: "discountIdr" }) || 0;

  const derived = useMemo(() => {
    return deriveInvoiceState({
      items,
      payments,
      usdToIdr,
      sarToIdr,
      dueDateIso,
      keepValasCurrency,
      discountIdr,
    });
  }, [items, payments, usdToIdr, sarToIdr, dueDateIso, keepValasCurrency, discountIdr]);

  const subtotal = derived.paymentSummary.subtotal;
  const discountAmount = derived.paymentSummary.discount;
  const totalPayable = derived.paymentSummary.totalPayable;
  const normalizedDownPayment = derived.paymentSummary.totalPaid;
  const remainingBalance = derived.paymentSummary.remainingBalance;
  const previewStatus = derived.previewStatus;

  const uniqueValasCurrencies = useMemo(() => {
    const list = (items as any[])
      .map((item: any) => item.currency)
      .filter((currency: any): currency is "USD" | "SAR" => currency === "USD" || currency === "SAR");
    return Array.from(new Set(list));
  }, [items]);

  return (
    <aside className="col-span-12 space-y-4 lg:col-span-3">
      <article className="serene-form-section p-5">
        <h3 className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/65">
          <span>Summary</span>
          <span className="material-symbols-outlined text-base text-on-surface-variant/35" aria-hidden="true">
            payments
          </span>
        </h3>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Subtotal</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[10px] font-bold text-on-surface-variant/70">{invoiceCurrency}</span>
              <strong className="text-xs text-on-surface">{formatNumberInput(subtotal, invoiceCurrency)}</strong>
            </div>
          </div>
          {discountAmount > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-on-surface-variant">Diskon</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-rose-500/70">{invoiceCurrency}</span>
                <strong className="text-xs text-rose-600">-{formatNumberInput(discountAmount, invoiceCurrency)}</strong>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant">Preview Status</span>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${getStatusClasses(previewStatus as any, isDarkMode)}`}>
              {previewStatus}
            </span>
          </div>

          {uniqueValasCurrencies.length > 0 ? (
            <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 space-y-2">
              <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                Mata Uang Tagihan Akhir
              </span>
              <SereneSelect
                className="serene-select h-8 w-full rounded-lg bg-white/70 text-xs font-bold text-on-surface shadow-none border border-primary/15 py-1 px-2"
                value={keepValasCurrency}
                onChange={(event) => handleKeepValasCurrencyChange(event.target.value as any)}
              >
                <option value="IDR">Rupiah (IDR)</option>
                {uniqueValasCurrencies.includes("USD") && (
                  <option value="USD">Dollar (USD)</option>
                )}
                {uniqueValasCurrencies.includes("SAR") && (
                  <option value="SAR">Riyal (SAR)</option>
                )}
              </SereneSelect>
              <p className="text-[10px] leading-snug text-on-surface-variant/75">
                Menentukan mata uang sisa tagihan & DP yang dicetak pada PDF invoice.
              </p>
            </div>
          ) : null}

          <div className="h-px bg-outline-variant/25" />
          <div className="pt-1">
            <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/65">
              Yang harus dibayarkan
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xs font-bold text-primary">{invoiceCurrency}</span>
              <span className="font-display text-xl font-extrabold tracking-tight text-primary">
                {formatNumberInput(totalPayable, invoiceCurrency)}
              </span>
            </div>
          </div>

          <div
            className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
              remainingBalance <= 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-primary/10 bg-primary/5"
            }`}
          >
            <span className="text-xs font-medium text-on-surface-variant">
              {resolveInvoiceOutstandingBalanceLabel(normalizedDownPayment, remainingBalance)}
            </span>
            <strong
              className={`text-xs font-bold ${remainingBalance <= 0 ? "text-emerald-700" : "text-primary"}`}
            >
              <span className="mr-1 text-[10px] font-bold text-on-surface-variant/70">{invoiceCurrency}</span>
              {formatNumberInput(remainingBalance, invoiceCurrency)}
            </strong>
          </div>
        </div>
      </article>

      <article className="serene-form-section p-5 text-center">
        <div className="mb-3 border-b border-outline-variant/20 pb-6">
          <span className="material-symbols-outlined mx-auto text-4xl text-primary/20" aria-hidden="true">
            approval_delegation
          </span>
        </div>
        <p className="text-xs font-extrabold text-on-surface">Husein Ghanim</p>
        <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/65">
          Director Operations
        </p>
      </article>

      <article className="serene-form-section border-primary/15 bg-primary/5">
        <p className="text-[10px] italic leading-relaxed text-primary/75">
          Note: Ensure all pilgrim PAX counts match the visa manifestations before generating the final document.
        </p>
      </article>
    </aside>
  );
});
