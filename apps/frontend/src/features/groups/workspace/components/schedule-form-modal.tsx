import { createPortal } from "react-dom";
import { Controller, type Control, type FieldErrors, type UseFormGetValues, type UseFormRegister } from "react-hook-form";
import { DatePickerInput, TimePickerInput } from "../../../../components/date-time-pickers";
import { SereneSelect } from "../../../../components/serene-select";
import type { ManualScheduleFormValues } from "../form-types.js";
import {
  getRouteFieldConfigByCategory,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  normalizeSaudiCityValue,
  scheduleTypeOptions,
  shouldShowFridayCityTourWarning,
} from "../../domain.js";
import { shouldUseSaudiCityDropdown } from "../helpers.js";

const fieldClassName = "serene-field";
const wideFieldClassName = `${fieldClassName} md:col-span-2`;
const gridClassName = "grid gap-3 md:grid-cols-2";
const inputClassName = "serene-input";
const selectClassName = "serene-select";
const textareaClassName = "serene-textarea";
const routeHintClassName = "md:col-span-2 text-xs font-medium leading-relaxed text-on-surface-variant";
const warningClassName =
  "md:col-span-2 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant";
const infoClassName =
  "md:col-span-2 flex items-start gap-2 rounded-md bg-surface-container-high p-3 text-sm text-on-surface-variant";
const checkClassName =
  "md:col-span-2 inline-flex items-center gap-2 rounded-md bg-surface-container-high px-3 py-2 text-sm font-medium text-on-surface-variant";
const transferTrainCardClassName = "md:col-span-2 rounded-2xl bg-surface-container-high p-3";
const transferTrainGridClassName = "mt-2 grid gap-3 md:grid-cols-2";

export function ScheduleFormModal({
  isVisible,
  editingItemId,
  register,
  control,
  form,
  scheduleErrors,
  getScheduleValues,
  applyManualScheduleDraft,
  handleFormChange,
  isGroupReadyForItinerary,
  isFormDisabled,
  saudiCityOptions,
  onSave,
  onClose,
}: {
  isVisible: boolean;
  editingItemId: string | null;
  register: UseFormRegister<ManualScheduleFormValues>;
  control: Control<ManualScheduleFormValues>;
  form: ManualScheduleFormValues;
  scheduleErrors: FieldErrors<ManualScheduleFormValues>;
  getScheduleValues: UseFormGetValues<ManualScheduleFormValues>;
  applyManualScheduleDraft: (
    draft: ManualScheduleFormValues,
    options?: {
      shouldDirty?: boolean;
      shouldValidate?: boolean;
    },
  ) => void;
  handleFormChange: <Key extends keyof ManualScheduleFormValues>(
    field: Key,
    value: ManualScheduleFormValues[Key],
  ) => void;
  isGroupReadyForItinerary: boolean;
  isFormDisabled: boolean;
  saudiCityOptions: string[];
  onSave: () => void;
  onClose: () => void;
}) {
  if (!isVisible || typeof document === "undefined") {
    return null;
  }

  const routeFieldConfig = getRouteFieldConfigByCategory(form.category);
  const showFridayCityTourWarning = shouldShowFridayCityTourWarning(form.category, form.date);
  const showFlightNumberField = isFlightActivityType(form.category);
  const showHotelNameField =
    form.category === "arrival" || form.category === "transfer" || form.category === "departure";
  const showTransferTrainFields = isTransferActivityType(form.category) && form.transferByTrain;
  const showDeparturePickupField = form.category === "departure";
  const showCityTourCityField = isCityTourActivityType(form.category);

  return createPortal(
    <div
      className="serene-modal-overlay fixed inset-0 z-[130] grid place-items-center p-3 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="serene-modal-shell relative max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl sm:max-h-[calc(100dvh-3rem)]"
        role="dialog"
        aria-modal="true"
        aria-label={editingItemId ? "Edit schedule details" : "Add schedule details"}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <span className="material-symbols-outlined" aria-hidden="true">
                event_note
              </span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingItemId ? "Edit Schedule Details" : "Schedule Details"}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                <span className="sm:hidden">Set timeline details.</span>
                <span className="hidden sm:inline">Set timeline details for this group itinerary.</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant transition hover:text-primary"
            onClick={onClose}
            aria-label="Close schedule form"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-4 py-4 sm:px-5">
          <div className={gridClassName}>
            <input type="hidden" {...register("category")} />
            <input type="hidden" {...register("fromHotelName")} />

            <div className={wideFieldClassName}>
              <span>Activity Type</span>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {scheduleTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                      form.category === option.value
                        ? "border-primary bg-emerald-50 text-primary"
                        : "border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                    }`}
                    onClick={() => {
                      const current = getScheduleValues();
                      const nextCategory = option.value;
                      const isNextTransfer = isTransferActivityType(nextCategory);
                      const nextFrom = shouldUseSaudiCityDropdown(nextCategory, "from")
                        ? normalizeSaudiCityValue(current.from)
                        : current.from;
                      const nextTo = shouldUseSaudiCityDropdown(nextCategory, "to")
                        ? normalizeSaudiCityValue(current.to)
                        : current.to;
                      const nextDraft: ManualScheduleFormValues = {
                        ...current,
                        category: nextCategory,
                        from: nextFrom,
                        to: nextTo,
                        cityTourCity: isCityTourActivityType(option.value) ? current.cityTourCity : "",
                        flightNumber: isFlightActivityType(option.value) ? current.flightNumber : "",
                        hotelPickupRequestTime:
                          option.value === "departure" ? current.hotelPickupRequestTime : "",
                        transferByTrain: isNextTransfer ? current.transferByTrain : false,
                        trainDepartureTime: isNextTransfer ? current.trainDepartureTime : "",
                        destinationPickupTime: isNextTransfer ? current.destinationPickupTime : "",
                      };

                      applyManualScheduleDraft(nextDraft);
                    }}
                    disabled={!isGroupReadyForItinerary}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {option.icon}
                    </span>
                    <span>{option.modalLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className={fieldClassName}>
              <span>Date</span>
              <Controller
                name="date"
                control={control}
                render={({ field }) => (
                  <DatePickerInput
                    inputClassName={inputClassName}
                    value={field.value}
                    onChange={(nextValue) => handleFormChange("date", nextValue)}
                    disabled={!isGroupReadyForItinerary}
                  />
                )}
              />
              {scheduleErrors.date ? (
                <p className="text-xs font-semibold text-error">{scheduleErrors.date.message}</p>
              ) : null}
            </label>

            {!showTransferTrainFields ? (
              <label className={fieldClassName}>
                <span>{form.category === "departure" ? "Flight Return Time" : "Time (Optional)"}</span>
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => (
                    <TimePickerInput
                      inputClassName={inputClassName}
                      value={field.value}
                      onChange={(nextValue) => handleFormChange("time", nextValue)}
                      disabled={!isGroupReadyForItinerary}
                    />
                  )}
                />
                {scheduleErrors.time ? (
                  <p className="text-xs font-semibold text-error">{scheduleErrors.time.message}</p>
                ) : null}
              </label>
            ) : null}

            {showFlightNumberField ? (
              <label className={wideFieldClassName}>
                <span>Flight Number</span>
                <Controller
                  name="flightNumber"
                  control={control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value}
                      onChange={(event) => handleFormChange("flightNumber", event.target.value)}
                      placeholder="e.g. SV-827"
                      disabled={!isGroupReadyForItinerary}
                    />
                  )}
                />
                {scheduleErrors.flightNumber ? (
                  <p className="text-xs font-semibold text-error">{scheduleErrors.flightNumber.message}</p>
                ) : null}
              </label>
            ) : null}

            {showHotelNameField ? (
              <label className={wideFieldClassName}>
                <span>Hotel Name</span>
                <Controller
                  name="hotelName"
                  control={control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value ?? ""}
                      onChange={(event) => handleFormChange("hotelName", event.target.value)}
                      placeholder="e.g. Pullman Zamzam Madinah"
                      disabled={!isGroupReadyForItinerary}
                    />
                  )}
                />
                {scheduleErrors.hotelName ? (
                  <p className="text-xs font-semibold text-error">{scheduleErrors.hotelName.message}</p>
                ) : null}
              </label>
            ) : null}

            {showCityTourCityField ? (
              <label className={wideFieldClassName}>
                <span>City Tour City</span>
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  >
                    location_city
                  </span>
                  <Controller
                    name="cityTourCity"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        className={`${selectClassName} pl-11`}
                        value={field.value}
                        onChange={(event) => handleFormChange("cityTourCity", event.target.value)}
                        disabled={!isGroupReadyForItinerary}
                      >
                        <option value="">Select city in Saudi</option>
                        {saudiCityOptions.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                </div>
                <p className="text-xs text-slate-600">Select the city where the city tour takes place.</p>
                {scheduleErrors.cityTourCity ? (
                  <p className="text-xs font-semibold text-error">{scheduleErrors.cityTourCity.message}</p>
                ) : null}
              </label>
            ) : null}

            {showDeparturePickupField ? (
              <label className={wideFieldClassName}>
                <span>Hotel Pickup Request Time</span>
                <Controller
                  name="hotelPickupRequestTime"
                  control={control}
                  render={({ field }) => (
                    <TimePickerInput
                      inputClassName={inputClassName}
                      value={field.value}
                      onChange={(nextValue) => handleFormChange("hotelPickupRequestTime", nextValue)}
                      disabled={!isGroupReadyForItinerary}
                    />
                  )}
                />
                {scheduleErrors.hotelPickupRequestTime ? (
                  <p className="text-xs font-semibold text-error">
                    {scheduleErrors.hotelPickupRequestTime.message}
                  </p>
                ) : null}
              </label>
            ) : null}

            {showFridayCityTourWarning ? (
              <div className={warningClassName}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  warning
                </span>
                <p>Friday detected. Please align City Tour timing with Jumu&apos;ah prayer schedule.</p>
              </div>
            ) : null}

            {isTransferActivityType(form.category) ? (
              <>
                <div className={infoClassName}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    info
                  </span>
                  <p>
                    If transfer uses a high-speed train, buses are still needed for hotel luggage
                    pickup, pilgrim drop-off at the station, and pickup at the destination station.
                  </p>
                </div>

                <label className={checkClassName}>
                  <Controller
                    name="transferByTrain"
                    control={control}
                    render={({ field }) => (
                      <input
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                        type="checkbox"
                        checked={field.value}
                        onChange={(event) => {
                          const current = getScheduleValues();
                          applyManualScheduleDraft({
                            ...current,
                            transferByTrain: event.target.checked,
                            requiresBus: event.target.checked ? true : current.requiresBus,
                            trainDepartureTime: event.target.checked ? current.trainDepartureTime : "",
                            destinationPickupTime: event.target.checked
                              ? current.destinationPickupTime
                              : "",
                          });
                        }}
                        disabled={!isGroupReadyForItinerary}
                      />
                    )}
                  />
                  <span>Transfer using High-Speed Train (HHR)</span>
                </label>
              </>
            ) : null}

            <label className={fieldClassName}>
              <span>{routeFieldConfig.fromLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "from") ? (
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  >
                    location_city
                  </span>
                  <Controller
                    name="from"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        className={`${selectClassName} pl-11`}
                        value={field.value}
                        onChange={(event) => handleFormChange("from", event.target.value)}
                        disabled={!isGroupReadyForItinerary}
                      >
                        <option value="">Select city in Saudi</option>
                        {saudiCityOptions.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                </div>
              ) : (
                <Controller
                  name="from"
                  control={control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value}
                      onChange={(event) => handleFormChange("from", event.target.value)}
                      placeholder={routeFieldConfig.fromPlaceholder}
                      disabled={!isGroupReadyForItinerary}
                    />
                  )}
                />
              )}
              {scheduleErrors.from ? (
                <p className="text-xs font-semibold text-error">{scheduleErrors.from.message}</p>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span>{routeFieldConfig.toLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "to") ? (
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  >
                    location_city
                  </span>
                  <Controller
                    name="to"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        className={`${selectClassName} pl-11`}
                        value={field.value}
                        onChange={(event) => handleFormChange("to", event.target.value)}
                        disabled={!isGroupReadyForItinerary}
                      >
                        <option value="">Select city in Saudi</option>
                        {saudiCityOptions.map((city) => (
                          <option key={city} value={city}>
                            {city}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                </div>
              ) : (
                <Controller
                  name="to"
                  control={control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value}
                      onChange={(event) => handleFormChange("to", event.target.value)}
                      placeholder={routeFieldConfig.toPlaceholder}
                      disabled={!isGroupReadyForItinerary}
                    />
                  )}
                />
              )}
              {scheduleErrors.to ? (
                <p className="text-xs font-semibold text-error">{scheduleErrors.to.message}</p>
              ) : null}
            </label>

            {routeFieldConfig.helperText ? (
              <p className={routeHintClassName}>{routeFieldConfig.helperText}</p>
            ) : null}

            {showTransferTrainFields ? (
              <div className={transferTrainCardClassName}>
                <p className="text-sm font-semibold text-primary">
                  High-speed train transfer operational details
                </p>

                <div className={transferTrainGridClassName}>
                  <label className={fieldClassName}>
                    <span>Train Departure Time</span>
                    <Controller
                      name="trainDepartureTime"
                      control={control}
                      render={({ field }) => (
                        <TimePickerInput
                          inputClassName={inputClassName}
                          value={field.value}
                          onChange={(nextValue) => handleFormChange("trainDepartureTime", nextValue)}
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                    {scheduleErrors.trainDepartureTime ? (
                      <p className="text-xs font-semibold text-error">
                        {scheduleErrors.trainDepartureTime.message}
                      </p>
                    ) : null}
                  </label>

                  <label className={fieldClassName}>
                    <span>Destination Station Pickup Time</span>
                    <Controller
                      name="destinationPickupTime"
                      control={control}
                      render={({ field }) => (
                        <TimePickerInput
                          inputClassName={inputClassName}
                          value={field.value}
                          onChange={(nextValue) => handleFormChange("destinationPickupTime", nextValue)}
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                    {scheduleErrors.destinationPickupTime ? (
                      <p className="text-xs font-semibold text-error">
                        {scheduleErrors.destinationPickupTime.message}
                      </p>
                    ) : null}
                  </label>
                </div>
              </div>
            ) : null}

            <label className={checkClassName}>
              <Controller
                name="requiresBus"
                control={control}
                render={({ field }) => (
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                    type="checkbox"
                    checked={showTransferTrainFields ? true : field.value}
                    onChange={(event) => handleFormChange("requiresBus", event.target.checked)}
                    disabled={!isGroupReadyForItinerary || showTransferTrainFields}
                  />
                )}
              />
              <span>
                {showTransferTrainFields ? "Bus Required (Luggage + Station Pickup)" : "Requires Bus"}
              </span>
            </label>

            <label className={wideFieldClassName}>
              <span>Notes</span>
              <Controller
                name="notes"
                control={control}
                render={({ field }) => (
                  <textarea
                    className={textareaClassName}
                    rows={3}
                    value={field.value}
                    onChange={(event) => handleFormChange("notes", event.target.value)}
                    placeholder="Enter special instructions or details..."
                    disabled={!isGroupReadyForItinerary}
                  />
                )}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              className="serene-btn-primary min-h-10 w-full sm:w-auto"
              onClick={onSave}
              disabled={isFormDisabled}
            >
              {editingItemId ? "Update Timeline" : "Add to Timeline"}
            </button>
            <button
              type="button"
              className="serene-btn-secondary min-h-10 w-full sm:w-auto"
              onClick={onClose}
              disabled={!isGroupReadyForItinerary}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
