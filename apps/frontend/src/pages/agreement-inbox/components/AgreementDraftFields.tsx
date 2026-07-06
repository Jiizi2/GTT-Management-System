import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { DatePickerInput } from "../../../components/date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../../../components/form-accessibility";
import { SereneSelect } from "../../../components/serene-select";
import type { HotelAgreementDraftFormState } from "../../../shared/app-domain";

export function AgreementDraftFields({
  control,
  register,
  errors,
  idPrefix,
}: {
  control: Control<HotelAgreementDraftFormState>;
  register: UseFormRegister<HotelAgreementDraftFormState>;
  errors: FieldErrors<HotelAgreementDraftFormState>;
  idPrefix: string;
}) {
  const fieldClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-slate-700";
  const inputClassName = "serene-input serene-input-md";
  const textareaClassName = "serene-textarea min-h-24";

  const cityErrorMessage = errors.city?.message;
  const agentNameErrorMessage = errors.agentName?.message;
  const hotelNameErrorMessage = errors.hotelName?.message;
  const agreementNumberErrorMessage = errors.agreementNumber?.message;
  const paxErrorMessage = errors.pax?.message;
  const statusErrorMessage = errors.status?.message;
  const stayStartErrorMessage = errors.stayStartIso?.message;
  const stayEndErrorMessage = errors.stayEndIso?.message;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="grid gap-1.5 lg:col-span-3">
        <label className={fieldClassName}>
          <span>City</span>
          <Controller
            control={control}
            name="city"
            render={({ field }) => (
              <SereneSelect
                id={`${idPrefix}-city`}
                className="serene-select"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                aria-invalid={getFieldAriaInvalid(cityErrorMessage)}
                aria-describedby={getFieldDescribedBy(`${idPrefix}-city`, {
                  errorMessage: cityErrorMessage,
                })}
              >
                <option value="makkah">Makkah</option>
                <option value="madinah">Madinah</option>
              </SereneSelect>
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-city`} message={cityErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-3">
        <label className={fieldClassName}>
          <span>Agent Name</span>
          <input
            id={`${idPrefix}-agent`}
            type="text"
            className={inputClassName}
            placeholder="Optional"
            {...register("agentName")}
            aria-invalid={getFieldAriaInvalid(agentNameErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-agent`, {
              errorMessage: agentNameErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-agent`} message={agentNameErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-6">
        <label className={fieldClassName}>
          <span>Hotel Name</span>
          <input
            id={`${idPrefix}-hotel`}
            type="text"
            className={inputClassName}
            placeholder="Swissotel Al Maqam"
            {...register("hotelName")}
            aria-invalid={getFieldAriaInvalid(hotelNameErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-hotel`, {
              errorMessage: hotelNameErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-hotel`} message={hotelNameErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-5">
        <label className={fieldClassName}>
          <span>Agreement Number</span>
          <input
            id={`${idPrefix}-number`}
            type="text"
            className={inputClassName}
            placeholder="2026xxxxxxxxxxxxx"
            {...register("agreementNumber")}
            aria-invalid={getFieldAriaInvalid(agreementNumberErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-number`, {
              errorMessage: agreementNumberErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-number`} message={agreementNumberErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-2">
        <label className={fieldClassName}>
          <span>Pax</span>
          <input
            id={`${idPrefix}-pax`}
            type="number"
            min={1}
            className={inputClassName}
            {...register("pax")}
            aria-invalid={getFieldAriaInvalid(paxErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-pax`, {
              errorMessage: paxErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-pax`} message={paxErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-3">
        <label className={fieldClassName}>
          <span>Approval Status</span>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SereneSelect
                id={`${idPrefix}-status`}
                className="serene-select"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                aria-invalid={getFieldAriaInvalid(statusErrorMessage)}
                aria-describedby={getFieldDescribedBy(`${idPrefix}-status`, {
                  errorMessage: statusErrorMessage,
                })}
              >
                <option value="Waiting for Approval">Waiting for Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </SereneSelect>
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-status`} message={statusErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-2">
        <label className={fieldClassName}>
          <span>Stay Start</span>
          <Controller
            control={control}
            name="stayStartIso"
            render={({ field }) => (
              <DatePickerInput
                id={`${idPrefix}-stay-start`}
                inputClassName={inputClassName}
                value={field.value}
                onChange={field.onChange}
                ariaInvalid={getFieldAriaInvalid(stayStartErrorMessage)}
                ariaDescribedBy={getFieldDescribedBy(`${idPrefix}-stay-start`, {
                  errorMessage: stayStartErrorMessage,
                })}
              />
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-stay-start`} message={stayStartErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-2">
        <label className={fieldClassName}>
          <span>Stay End</span>
          <Controller
            control={control}
            name="stayEndIso"
            render={({ field }) => (
              <DatePickerInput
                id={`${idPrefix}-stay-end`}
                inputClassName={inputClassName}
                value={field.value}
                onChange={field.onChange}
                ariaInvalid={getFieldAriaInvalid(stayEndErrorMessage)}
                ariaDescribedBy={getFieldDescribedBy(`${idPrefix}-stay-end`, {
                  errorMessage: stayEndErrorMessage,
                })}
              />
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-stay-end`} message={stayEndErrorMessage} />
      </div>

      <label className={`${fieldClassName} lg:col-span-12`}>
        <span>Notes</span>
        <textarea className={textareaClassName} placeholder="Optional notes" {...register("notes")} />
      </label>
    </div>
  );
}
