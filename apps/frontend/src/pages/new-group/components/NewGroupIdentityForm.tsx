import { Controller } from "react-hook-form";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../../../components/form-accessibility";
import { SereneSelect } from "../../../components/serene-select";
import { useNewGroupContext } from "../context/NewGroupContext";

export function NewGroupIdentityForm() {
  const {
    form,
    visaStatus,
    syarikahName,
    busStatus,
    minimumBusCount,
    hideGroupInformation,
    getInvoiceToneDotClasses,
    getVisaStatusTone,
    getBusStatusTone,
    getToneSelectClassName,
  } = useNewGroupContext();

  const { register, control, formState: { errors } } = form;

  const sectionClassName = "serene-section";
  const fieldClassName = "serene-field";
  const controlClassName = "serene-input";
  const toneDotClassName =
    "pointer-events-none absolute left-3 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border";

  const groupNumberErrorMessage = errors.groupNumber?.message;
  const totalPaxErrorMessage = errors.totalPax?.message;
  const groupNameErrorMessage = errors.groupName?.message;

  return (
    <div className={`grid gap-4 ${hideGroupInformation ? "" : "xl:grid-cols-2"}`}>
      {!hideGroupInformation ? (
        <section className={sectionClassName}>
          <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Group Information</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={fieldClassName}>
              <span>Group Number</span>
              <input
                id="new-group-number"
                className={controlClassName}
                type="text"
                {...register("groupNumber")}
                placeholder="e.g. 901794508"
                aria-invalid={getFieldAriaInvalid(groupNumberErrorMessage)}
                aria-describedby={getFieldDescribedBy("new-group-number", {
                  errorMessage: groupNumberErrorMessage,
                })}
              />
              <FieldErrorMessage fieldId="new-group-number" message={groupNumberErrorMessage} />
            </label>
            <label className={fieldClassName}>
              <span>Total Pax</span>
              <input
                id="new-group-total-pax"
                className={controlClassName}
                type="number"
                min={1}
                {...register("totalPax")}
                placeholder="45"
                aria-invalid={getFieldAriaInvalid(totalPaxErrorMessage)}
                aria-describedby={getFieldDescribedBy("new-group-total-pax", {
                  errorMessage: totalPaxErrorMessage,
                })}
              />
              <FieldErrorMessage fieldId="new-group-total-pax" message={totalPaxErrorMessage} />
            </label>
            <label className={`${fieldClassName} md:col-span-2`}>
              <span>Group Name</span>
              <input
                id="new-group-name"
                className={controlClassName}
                type="text"
                {...register("groupName")}
                placeholder="e.g. FEB 25 - Group 3"
                aria-invalid={getFieldAriaInvalid(groupNameErrorMessage)}
                aria-describedby={getFieldDescribedBy("new-group-name", {
                  errorMessage: groupNameErrorMessage,
                })}
              />
              <FieldErrorMessage fieldId="new-group-name" message={groupNameErrorMessage} />
            </label>
          </div>
        </section>
      ) : null}

      <section className={sectionClassName}>
        <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Visa Information</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className={fieldClassName}>
            <span>Visa Status</span>
            <div className="relative">
              <span
                className={`${toneDotClassName} ${getInvoiceToneDotClasses(getVisaStatusTone(visaStatus))}`}
                aria-hidden="true"
              />
              <Controller
                name="visaStatus"
                control={control}
                render={({ field }) => (
                  <SereneSelect
                    className={getToneSelectClassName(getVisaStatusTone(field.value))}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Pending">On Process</option>
                    <option value="Issued">Issued</option>
                  </SereneSelect>
                )}
              />
            </div>
          </label>
          <label className={fieldClassName}>
            <span>Syarikah</span>
            <input
              className={controlClassName}
              type="text"
              {...register("syarikahName")}
              placeholder="Enter syarikah name"
            />
          </label>
          <label className={fieldClassName}>
            <span>Visa Type</span>
            <div className="relative">
              <span
                className={`${toneDotClassName} ${getInvoiceToneDotClasses(getBusStatusTone(busStatus))}`}
                aria-hidden="true"
              />
              <Controller
                name="busStatus"
                control={control}
                render={({ field }) => (
                  <SereneSelect
                    className={getToneSelectClassName(getBusStatusTone(field.value))}
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    <option value="Visa Only">Visa Only</option>
                    <option value="Visa+">Visa+</option>
                  </SereneSelect>
                )}
              />
            </div>
          </label>
          <div className={`${fieldClassName} justify-end`}>
            <span className="text-xs text-on-surface-variant/80">Minimum buses</span>
            <strong className="text-lg text-on-surface">{minimumBusCount}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
