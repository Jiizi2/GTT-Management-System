import { memo } from "react";
import { useFormContext } from "react-hook-form";

export const InvoiceNotesSection = memo(function InvoiceNotesSection() {
  const { register } = useFormContext();

  return (
    <article className="serene-form-section border-primary/20 bg-surface-container-low ring-1 ring-primary/10 flex flex-col min-h-[140px]">
      <h3 className="serene-form-section-header text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          notes
        </span>
        <span>Internal Notes / Memo</span>
      </h3>
      <textarea
        className="w-full flex-1 resize-none bg-transparent p-4 text-xs font-semibold text-on-surface outline-none ring-0 placeholder:italic placeholder:text-on-surface-variant/40"
        placeholder="Catatan internal operasional..."
        {...register("notes")}
      />
    </article>
  );
});
