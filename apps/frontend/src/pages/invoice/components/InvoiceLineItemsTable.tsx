import { memo, useMemo, useRef } from "react";
import { useFormContext, useWatch, useFieldArray, Controller } from "react-hook-form";
import { SereneSelect } from "../../../components/serene-select";
import {
  deriveItemTotals,
  formatIdr,
  formatNumberInput,
} from "../helpers/invoice-page-shared";
import { MoneyInput } from "./MoneyInput";
import type { GroupData } from "../../../shared/app-domain";

export const InvoiceLineItemsTable = memo(function InvoiceLineItemsTable({
  usdToIdr,
  sarToIdr,
  selectedGroup,
}: {
  usdToIdr: number;
  sarToIdr: number;
  selectedGroup: GroupData | null;
}) {
  const { control, register } = useFormContext();
  const items = useWatch({ control, name: "items" }) || [];

  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({
    control,
    name: "items",
  });

  const rowCounterRef = useRef(itemFields.length + 1);

  const addItemRow = () => {
    const nextId = `line-${Date.now()}-${rowCounterRef.current}`;
    rowCounterRef.current += 1;

    appendItem({
      id: nextId,
      description: "",
      pax: Math.max(1, selectedGroup?.pax ?? 1),
      currency: "IDR",
      unitPrice: 0,
    });
  };

  const itemsWithTotals = useMemo(() => {
    return deriveItemTotals(items, usdToIdr, sarToIdr);
  }, [items, usdToIdr, sarToIdr]);

  return (
    <article className="serene-table-shell">
      <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-3">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            list_alt
          </span>
          <span>Package Items</span>
        </h3>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.11em] text-primary transition hover:underline"
          onClick={addItemRow}
        >
          <span className="material-symbols-outlined text-xs" aria-hidden="true">
            add_circle
          </span>
          <span>Tambah Uraian</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left">
          <thead className="border-b border-outline-variant/20 bg-surface-container-low">
            <tr>
              <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                No
              </th>
              <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                Uraian
              </th>
              <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                Jumlah (PAX)
              </th>
              <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                Harga per Unit (PAX)
              </th>
              <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                Total Harga
              </th>
              <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                Total Harga (IDR)
              </th>
              <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-outline-variant/15">
            {itemFields.map((itemField, index) => {
              const item = items[index] ?? itemField;
              const currentTotals = itemsWithTotals[index] || { totalPrice: 0, totalPriceIdr: 0 };
              const lineSubtotalLabel = `${item.currency} ${formatNumberInput(currentTotals.totalPrice, item.currency)}`;
              return (
                <tr key={itemField.id} className="transition hover:bg-surface-container-low/45">
                  <td className="px-5 py-3 text-xs font-bold text-on-surface">
                    {String(index + 1).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-3 min-w-[200px]">
                    <Controller
                      name={`items.${index}.description` as any}
                      control={control}
                      render={({ field }) => (
                        <textarea
                          rows={1}
                          placeholder="Input description / uraian..."
                          className="w-full resize-none overflow-hidden border-none bg-transparent p-0 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-0 placeholder:italic placeholder:text-on-surface-variant/40"
                          value={field.value || ""}
                          onChange={(event) => {
                            event.target.style.height = "auto";
                            event.target.style.height = `${event.target.scrollHeight}px`;
                            field.onChange(event.target.value);
                          }}
                          ref={(el) => {
                            field.ref(el);
                            if (el) {
                              el.style.height = "auto";
                              el.style.height = `${el.scrollHeight}px`;
                            }
                          }}
                        />
                      )}
                    />
                  </td>
                  <td className="px-5 py-3 w-[80px]">
                    <Controller
                      name={`items.${index}.pax` as any}
                      control={control}
                      render={({ field }) => (
                        <input
                          type="number"
                          min={0}
                          className="w-full border-none bg-transparent p-0 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-0"
                          value={field.value ?? ""}
                          onChange={(event) => {
                            field.onChange(Math.max(0, Number.parseInt(event.target.value || "0", 10)));
                          }}
                        />
                      )}
                    />
                  </td>
                  <td className="px-5 py-3 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <Controller
                        name={`items.${index}.currency` as any}
                        control={control}
                        render={({ field }) => (
                          <SereneSelect
                            className="serene-select h-8 min-w-[76px] rounded-lg bg-surface-container-low text-xs font-bold text-on-surface shadow-none border-none py-1 px-2"
                            value={field.value || "IDR"}
                            onChange={field.onChange}
                          >
                            <option value="IDR">IDR</option>
                            <option value="USD">USD</option>
                            <option value="SAR">SAR</option>
                          </SereneSelect>
                        )}
                      />
                      <Controller
                        name={`items.${index}.unitPrice` as any}
                        control={control}
                        render={({ field }) => (
                          <MoneyInput
                            className="w-full border-none bg-transparent p-0 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-0"
                            ariaLabel={`Item ${index + 1} unit price`}
                            value={field.value || 0}
                            onChange={field.onChange}
                          />
                        )}
                      />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs font-bold text-on-surface">{lineSubtotalLabel}</td>
                  <td className="px-5 py-3 text-xs font-bold text-on-surface">
                    {formatIdr(currentTotals.totalPriceIdr)}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Delete row ${index + 1}`}
                      onClick={() => removeItem(index)}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        delete
                      </span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
});
