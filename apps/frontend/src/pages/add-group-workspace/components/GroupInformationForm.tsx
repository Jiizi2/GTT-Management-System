import { Controller, useFormContext } from "react-hook-form";
import { DatePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import type { IdentityFormValues } from "../hooks/use-add-group-workspace-form";

interface GroupInformationFormProps {
  isScheduleOnlyMode: boolean;
  paxCount: string;
  handlePaxCountChange: (value: string) => void;
  minimumBusCount: number;
  safePaxForBusRule: number;
  hasInvalidDateRange: boolean;
  isTotalBusBelowMinimum: boolean;
}

export function GroupInformationForm({
  isScheduleOnlyMode,
  paxCount,
  handlePaxCountChange,
  minimumBusCount,
  safePaxForBusRule,
  hasInvalidDateRange,
  isTotalBusBelowMinimum,
}: GroupInformationFormProps) {
  const {
    register,
    control,
    formState: { errors: identityErrors },
  } = useFormContext<IdentityFormValues>();

  if (isScheduleOnlyMode) {
    return null;
  }

  const fieldClassName = "serene-field";
  const wideFieldClassName = `${fieldClassName} md:col-span-2`;
  const gridClassName = "grid gap-3 md:grid-cols-2";
  const inputClassName = "serene-input";
  const selectClassName = "serene-select";
  const routeHintClassName = "md:col-span-2 text-xs font-medium leading-relaxed text-on-surface-variant";
  const warningClassName =
    "md:col-span-2 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant";

  return (
    <>
      <section className="serene-section">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-semibold text-on-surface">Group Information</h2>
        </div>

        <div className={gridClassName}>
          <label className={wideFieldClassName}>
            <span>Group Number</span>
            <input
              type="text"
              {...register("groupNumber")}
              placeholder="e.g. GR-7721-UMA"
              className={`${inputClassName} text-lg font-semibold tracking-tight`}
            />
            {identityErrors.groupNumber ? (
              <p className="text-xs font-semibold text-error">{identityErrors.groupNumber.message}</p>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span>Group Name</span>
            <input
              className={inputClassName}
              type="text"
              {...register("groupName")}
              placeholder="e.g. Jakarta Umrah March Batch"
            />
            {identityErrors.groupName ? (
              <p className="text-xs font-semibold text-error">{identityErrors.groupName.message}</p>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span>Package Type</span>
            <input
              className={inputClassName}
              type="text"
              {...register("packageType")}
              placeholder="e.g. Custom VIP Package"
            />
            {identityErrors.packageType ? (
              <p className="text-xs font-semibold text-error">{identityErrors.packageType.message}</p>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span>Visa Type</span>
            <Controller
              name="busStatus"
              control={control}
              render={({ field }) => (
                <SereneSelect
                  className={selectClassName}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                >
                  <option value="" disabled>
                    Select Visa Type
                  </option>
                  <option value="Visa Only">Visa Only</option>
                  <option value="Visa+">Visa+</option>
                </SereneSelect>
              )}
            />
            {identityErrors.busStatus ? (
              <p className="text-xs font-semibold text-error">{identityErrors.busStatus.message}</p>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span>Number of Pax</span>
            <input
              className={inputClassName}
              type="number"
              min={1}
              value={paxCount}
              onChange={(event) => handlePaxCountChange(event.target.value)}
              placeholder="45"
            />
            {identityErrors.paxCount ? (
              <p className="text-xs font-semibold text-error">{identityErrors.paxCount.message}</p>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span>Total Bus Required</span>
            <input
              className={inputClassName}
              type="number"
              min={1}
              {...register("totalBusRequired")}
              placeholder={String(minimumBusCount)}
            />
            {identityErrors.totalBusRequired ? (
              <p className="text-xs font-semibold text-error">{identityErrors.totalBusRequired.message}</p>
            ) : null}
          </label>

          <p className={routeHintClassName}>
            <span className="sm:hidden">
              Min {minimumBusCount} bus for {safePaxForBusRule} pax.
            </span>
            <span className="hidden sm:inline">
              Minimum {minimumBusCount} bus for {safePaxForBusRule} pax (maximum 50 pax per bus). You can enter a
              higher number for additional requests.
            </span>
          </p>

          <label className={fieldClassName}>
            <span>Start Date</span>
            <Controller
              name="startDate"
              control={control}
              render={({ field }) => (
                <DatePickerInput inputClassName={inputClassName} value={field.value} onChange={field.onChange} />
              )}
            />
            {identityErrors.startDate ? (
              <p className="text-xs font-semibold text-error">{identityErrors.startDate.message}</p>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span>End Date</span>
            <Controller
              name="endDate"
              control={control}
              render={({ field }) => (
                <DatePickerInput inputClassName={inputClassName} value={field.value} onChange={field.onChange} />
              )}
            />
            {identityErrors.endDate ? (
              <p className="text-xs font-semibold text-error">{identityErrors.endDate.message}</p>
            ) : null}
          </label>
        </div>

        {hasInvalidDateRange ? (
          <div className={warningClassName}>
            <span className="material-symbols-outlined" aria-hidden="true">
              warning
            </span>
            <p>
              <span className="sm:hidden">End Date must be same/later than Start Date.</span>
              <span className="hidden sm:inline">End Date must be the same day or later than Start Date.</span>
            </p>
          </div>
        ) : null}

        {isTotalBusBelowMinimum ? (
          <div className={warningClassName}>
            <span className="material-symbols-outlined" aria-hidden="true">
              warning
            </span>
            <p>
              <span className="sm:hidden">Bus kurang. Minimal {minimumBusCount} bus.</span>
              <span className="hidden sm:inline">
                Total buses are insufficient. For {safePaxForBusRule} pax, a minimum of {minimumBusCount} buses is
                required.
              </span>
            </p>
          </div>
        ) : null}
      </section>

      <section className="serene-section">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-semibold text-on-surface">Musyrif Information</h2>
        </div>

        <div className={gridClassName}>
          <label className={fieldClassName}>
            <span>Musyrif Name</span>
            <input
              className={inputClassName}
              type="text"
              {...register("musyrifName")}
              placeholder="Ustadz Abdul Hakim"
            />
            {identityErrors.musyrifName ? (
              <p className="text-xs font-semibold text-error">{identityErrors.musyrifName.message}</p>
            ) : null}
          </label>

          <label className={fieldClassName}>
            <span>Phone Number</span>
            <input
              className={inputClassName}
              type="tel"
              {...register("musyrifPhone")}
              placeholder="+62 812-3456-7890"
            />
            {identityErrors.musyrifPhone ? (
              <p className="text-xs font-semibold text-error">{identityErrors.musyrifPhone.message}</p>
            ) : null}
          </label>
        </div>
      </section>
    </>
  );
}
