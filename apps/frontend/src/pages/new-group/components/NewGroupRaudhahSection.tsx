import { DatePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import { useNewGroupContext } from "../context/NewGroupContext";
import type { GroupRaudhahStatus } from "../../../shared/app-domain";
import * as Domain from "../../../shared/app-domain";

export function NewGroupRaudhahSection() {
  const {
    raudhahDates,
    paymentStatus,
    form,
    appendRaudhahDate,
    handleRaudhahChange,
    getInvoiceToneDotClasses,
    getInvoiceToneClasses,
    getRaudhahStatusTone,
    getPaymentStatusTone,
    getToneSelectClassName,
  } = useNewGroupContext();

  const { createNewGroupRaudhahForm } = Domain;

  const sectionClassName = "serene-section";
  const fieldClassName = "serene-field";
  const controlClassName = "serene-input";
  const toneDotClassName =
    "pointer-events-none absolute left-3 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className={sectionClassName}>
        <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Raudhah Appointments</h2>
        <div className="space-y-3">
          {raudhahDates.map((appointment, index) => (
            <article key={appointment.id} className="rounded-2xl bg-surface-container-lowest p-4 shadow-ambient">
              <div className="grid gap-3 md:grid-cols-2">
                <label className={fieldClassName}>
                  <span>Raudhah Date</span>
                  <DatePickerInput
                    inputClassName={controlClassName}
                    value={appointment.dateIso}
                    onChange={(nextValue) => handleRaudhahChange(index, "dateIso", nextValue)}
                  />
                </label>
                <label className={fieldClassName}>
                  <span>Status</span>
                  <div className="relative">
                    <span
                      className={`${toneDotClassName} ${getInvoiceToneDotClasses(
                        getRaudhahStatusTone(appointment.status)
                      )}`}
                      aria-hidden="true"
                    />
                    <SereneSelect
                      className={getToneSelectClassName(getRaudhahStatusTone(appointment.status))}
                      value={appointment.status}
                      onChange={(event) =>
                        handleRaudhahChange(index, "status", event.target.value as GroupRaudhahStatus)
                      }
                    >
                      <option value="Free">Free</option>
                      <option value="After">After</option>
                      <option value="Before">Before</option>
                    </SereneSelect>
                  </div>
                </label>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="serene-btn-secondary"
            onClick={() => appendRaudhahDate(createNewGroupRaudhahForm())}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add_circle
            </span>
            <span className="sm:hidden">Add Raudhah Date</span>
            <span className="hidden sm:inline">Add Another Raudhah Date</span>
          </button>
        </div>
      </section>

      <section className={sectionClassName}>
        <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Payment</h2>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-high p-1">
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              paymentStatus === "Unpaid"
                ? `${getInvoiceToneClasses(getPaymentStatusTone("Unpaid"))} shadow-sm`
                : "border-transparent text-on-surface-variant hover:border-outline-variant/45 hover:bg-surface-container-lowest"
            }`}
            onClick={() => form.setValue("paymentStatus", "Unpaid", { shouldDirty: true })}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              hourglass_top
            </span>
            <span>Unpaid</span>
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              paymentStatus === "Paid"
                ? `${getInvoiceToneClasses(getPaymentStatusTone("Paid"))} shadow-sm`
                : "border-transparent text-on-surface-variant hover:border-outline-variant/45 hover:bg-surface-container-lowest"
            }`}
            onClick={() => form.setValue("paymentStatus", "Paid", { shouldDirty: true })}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              task_alt
            </span>
            <span>Paid</span>
          </button>
        </div>
      </section>
    </div>
  );
}
