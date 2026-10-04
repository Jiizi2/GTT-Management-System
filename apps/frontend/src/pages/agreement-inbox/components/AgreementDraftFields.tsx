import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { DatePickerInput } from "../../../components/date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../../../components/form-accessibility";
import { SereneSelect } from "../../../components/serene-select";
import type { HotelAgreementDraftFormState } from "../../../shared/app-domain";
import { useAgentsQuery } from "../../../hooks/use-agents-backend";
import { useMuassasahQuery } from "../../../hooks/use-directory-backend";

export function AgreementDraftFields({
  control,
  register,
  errors,
  idPrefix,
  layout = "columns",
}: {
  control: Control<HotelAgreementDraftFormState>;
  register: UseFormRegister<HotelAgreementDraftFormState>;
  errors: FieldErrors<HotelAgreementDraftFormState>;
  idPrefix: string;
  layout?: "columns" | "stacked";
}) {
  const agentsQuery = useAgentsQuery();
  const muassasahQuery = useMuassasahQuery();
  const isStacked = layout === "stacked";
  const fieldClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-slate-700";
  const inputClassName = "serene-input serene-input-md";
  const textareaClassName = "serene-textarea min-h-24";
  const fieldLayoutClassNames = isStacked
    ? {
        agent: "grid gap-1.5",
        muassasah: "grid gap-1.5",
        groupName: "grid gap-1.5",
        pax: "grid gap-1.5",
        city: "grid gap-1.5",
        hotelName: "grid gap-1.5",
        agreementNumber: "grid gap-1.5",
        status: "grid gap-1.5",
        stayStart: "grid gap-1.5",
        stayEnd: "grid gap-1.5",
        notes: fieldClassName,
      }
    : {
        agent: "order-1 grid gap-1.5 lg:col-span-3",
        muassasah: "order-2 grid gap-1.5 lg:col-span-3",
        groupName: "order-3 grid gap-1.5 lg:col-span-4",
        pax: "order-4 grid gap-1.5 lg:col-span-2",
        city: "order-5 grid gap-1.5 lg:col-span-2",
        hotelName: "order-6 grid gap-1.5 lg:col-span-5",
        agreementNumber: "order-7 grid gap-1.5 lg:col-span-5",
        status: "order-8 grid gap-1.5 lg:col-span-4",
        stayStart: "order-9 grid gap-1.5 lg:col-span-4",
        stayEnd: "order-10 grid gap-1.5 lg:col-span-4",
        notes: `${fieldClassName} order-11 lg:col-span-12`,
      };

  const cityErrorMessage = errors.city?.message;
  const agentIdErrorMessage = errors.agentId?.message;
  const groupNameErrorMessage = errors.groupName?.message;
  const hotelNameErrorMessage = errors.hotelName?.message;
  const agreementNumberErrorMessage = errors.agreementNumber?.message;
  const paxErrorMessage = errors.pax?.message;
  const statusErrorMessage = errors.status?.message;
  const stayStartErrorMessage = errors.stayStartIso?.message;
  const stayEndErrorMessage = errors.stayEndIso?.message;

  return (
    <div className={isStacked ? "grid gap-4" : "grid gap-4 lg:grid-cols-12"}>
      <div className={fieldLayoutClassNames.agent}>
        <label className={fieldClassName}>
          <span>Agent</span>
          <Controller
            control={control}
            name="agentId"
            render={({ field }) => (
              <SereneSelect
                id={`${idPrefix}-agent`}
                className="serene-select"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              >
                <option value="" disabled>
                  Select Agent
                </option>
                {(agentsQuery.data ?? [])
                  .filter((agent) => agent.status === "ACTIVE")
                  .map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
              </SereneSelect>
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-agent`} message={agentIdErrorMessage} />
      </div>

      <div className={fieldLayoutClassNames.muassasah}>
        <label className={fieldClassName}>
          <span>Muassasah <span className="text-xs font-normal text-on-surface-variant">(opsional)</span></span>
          <Controller control={control} name="muassasahId" render={({ field }) => (
            <SereneSelect id={`${idPrefix}-muassasah`} className="serene-select" value={field.value ?? ""} onChange={(event) => field.onChange(event.target.value)} disabled={muassasahQuery.isLoading || muassasahQuery.isError} aria-label="Muassasah draft">
              <option value="">Belum dipilih</option>
              {(muassasahQuery.data ?? []).filter((option) => option.isActive || option.id === field.value).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </SereneSelect>
          )} />
        </label>
        {muassasahQuery.isError ? <p className="text-xs font-semibold text-rose-700" role="alert">Data Muassasah belum dapat dimuat. <button type="button" className="underline underline-offset-2" onClick={() => void muassasahQuery.refetch()}>Coba lagi</button></p> : <p className="text-xs text-on-surface-variant">Pilih dari Master Data.</p>}
      </div>

      <div className={fieldLayoutClassNames.groupName}>
        <label className={fieldClassName}>
          <span>Group Name</span>
          <input
            id={`${idPrefix}-group-name`}
            type="text"
            className={inputClassName}
            placeholder="Group Al Falah April"
            {...register("groupName")}
            aria-invalid={getFieldAriaInvalid(groupNameErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-group-name`, {
              errorMessage: groupNameErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-group-name`} message={groupNameErrorMessage} />
      </div>

      <div className={fieldLayoutClassNames.pax}>
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

      <div className={fieldLayoutClassNames.city}>
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

      <div className={fieldLayoutClassNames.hotelName}>
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

      <div className={fieldLayoutClassNames.agreementNumber}>
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

      <div className={fieldLayoutClassNames.status}>
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

      <div className={fieldLayoutClassNames.stayStart}>
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

      <div className={fieldLayoutClassNames.stayEnd}>
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

      <label className={fieldLayoutClassNames.notes}>
        <span>Notes</span>
        <textarea className={textareaClassName} placeholder="Optional notes" {...register("notes")} />
      </label>
    </div>
  );
}
