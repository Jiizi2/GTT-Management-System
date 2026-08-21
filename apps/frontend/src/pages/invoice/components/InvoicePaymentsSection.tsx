import { memo, useMemo } from "react";
import { useFormContext, useWatch, useFieldArray, Controller } from "react-hook-form";
import * as Domain from "../../../shared/app-domain";
import { DatePickerInput } from "../../../components/date-time-pickers";
import {
  calculateSubtotalInCurrency,
  formatNumberInput,
  resolveDiscountInCurrency,
} from "../helpers/invoice-page-shared";
import { clampMoney, sumMoney } from "../../../shared/money";
import { MoneyInput } from "./MoneyInput";

export const InvoicePaymentsSection = memo(function InvoicePaymentsSection({
  usdToIdr,
  sarToIdr,
  keepValasCurrency,
  invoiceCurrency,
}: {
  usdToIdr: number;
  sarToIdr: number;
  keepValasCurrency: "IDR" | "USD" | "SAR";
  invoiceCurrency: string;
}) {
  const { control, setValue, watch } = useFormContext();
  const payments = useWatch({ control, name: "payments" }) || [];
  const items = useWatch({ control, name: "items" }) || [];
  const discountIdr = useWatch({ control, name: "discountIdr" }) || 0;

  const {
    fields: paymentFields,
    append: appendPayment,
    remove: removePayment,
  } = useFieldArray({
    control,
    name: "payments",
  });

  const subtotal = useMemo(() => {
    return calculateSubtotalInCurrency(items, keepValasCurrency, usdToIdr, sarToIdr);
  }, [items, keepValasCurrency, usdToIdr, sarToIdr]);

  const discountInCurrency = useMemo(
    () => resolveDiscountInCurrency(discountIdr, keepValasCurrency, usdToIdr, sarToIdr, subtotal),
    [discountIdr, keepValasCurrency, usdToIdr, sarToIdr, subtotal],
  );
  const totalPayable = clampMoney(subtotal - discountInCurrency);
  const totalPaid = useMemo(() => {
    return sumMoney(payments.map((p: any) => Number(p.amount) || 0));
  }, [payments]);

  const downPaymentCoveragePercent = totalPayable > 0 ? Math.min(100, Math.round((totalPaid / totalPayable) * 100)) : 0;

  return (
    <article className="serene-form-section p-5 space-y-4 xl:flex xl:h-full xl:flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
              account_balance
            </span>
            Histori Pembayaran
          </span>
          <p className="text-[11px] leading-snug text-on-surface-variant/70">
            Catat pembayaran cicilan atau pelunasan dari customer.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition shadow-sm"
          onClick={() => appendPayment({ amount: 0, dateIso: Domain.formatLocalIsoDate(new Date()) })}
        >
          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">add</span>
          <span>Tambah Pembayaran</span>
        </button>
      </div>

      <div className="rounded-xl border border-rose-200/60 bg-rose-50/40 p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="invoice-discount-input"
            className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-rose-600"
          >
            <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">sell</span>
            Diskon (Rp)
          </label>
          <div className="flex items-center gap-1 rounded-lg border border-rose-200 bg-surface-container-lowest px-2 py-1 h-9 w-40">
            <span className="text-[9px] font-extrabold text-rose-500">IDR</span>
            <MoneyInput
              id="invoice-discount-input"
              className="min-w-0 flex-1 border-none bg-transparent p-0 text-right text-xs font-extrabold text-on-surface outline-none ring-0 focus:ring-0"
              value={discountIdr}
              onChange={(nextDiscount) => setValue("discountIdr", nextDiscount, { shouldDirty: true })}
              ariaLabel="Nominal diskon invoice dalam rupiah"
            />
          </div>
        </div>
        <p className="text-[9px] leading-snug text-on-surface-variant/70">
          Potongan langsung dari subtotal. Selalu dalam Rupiah; total tagihan &amp; sisa dihitung setelah diskon.
        </p>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {paymentFields.map((field, idx) => {
          const runningPaid = sumMoney(payments.slice(0, idx + 1).map((p: any) => Number(p.amount) || 0));
          const remainingAfterThis = clampMoney(totalPayable - runningPaid);
          return (
            <div key={field.id} className="relative bg-surface-container-low rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2 transition hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                    Pembayaran #{idx + 1}
                  </span>
                  <span className="rounded-md bg-slate-100 dark:bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-400">
                    Sisa: {invoiceCurrency} {formatNumberInput(remainingAfterThis, invoiceCurrency)}
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                  aria-label={`Hapus Pembayaran ${idx + 1}`}
                  onClick={() => removePayment(idx)}
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                    Nominal
                  </label>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-surface-container-lowest px-2 py-1 h-9">
                    <span className="text-[9px] font-extrabold text-slate-500">{invoiceCurrency}</span>
                    <MoneyInput
                      className="min-w-0 flex-1 border-none bg-transparent p-0 text-right text-xs font-extrabold text-on-surface outline-none ring-0 focus:ring-0"
                      value={watch(`payments.${idx}.amount`) ?? 0}
                      onChange={(nextAmount) =>
                        setValue(`payments.${idx}.amount`, nextAmount, { shouldDirty: true })
                      }
                      ariaLabel={`Payment ${idx + 1} amount`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                    Tanggal Bayar
                  </label>
                  <Controller
                    name={`payments.${idx}.dateIso` as any}
                    control={control}
                    render={({ field }) => (
                      <DatePickerInput
                        id={`payment-date-${idx}`}
                        inputClassName="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-surface-container-lowest px-2 py-1 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/10"
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPaid > 0 ? (
        <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-[width] duration-300 ease-out"
              style={{ width: `${downPaymentCoveragePercent}%` }}
            />
          </div>
          <p className="text-[10px] font-medium text-primary mt-1.5">
            Terbayar {downPaymentCoveragePercent}% dari total tagihan.
          </p>
        </div>
      ) : (
        <p className="text-[10px] font-medium text-on-surface-variant/60 italic pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
          Belum ada pembayaran yang dicatat.
          </p>
      )}
    </article>
  );
});
