import React from "react";
import { createPortal } from "react-dom";
import { Controller, UseFormReturn } from "react-hook-form";
import { DatePickerInput, TimePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import {
  getRouteFieldConfigByCategory,
  getScheduleTypeOption,
  isTransferActivityType,
} from "../../../shared/app-domain";
import { shouldUseSaudiCityDropdown } from "../helpers/add-group-workspace-helpers";
import type { ManualScheduleFormValues } from "../hooks/use-add-group-workspace-form";

interface ManualScheduleModalProps {
  isScheduleFormVisible: boolean;
  handleCloseScheduleForm: () => void;
  editingItemId: string | null;
  handleSaveItem: () => void;
  isFormDisabled: boolean;
  validationState: {
    showFlightNumberField: boolean;
    showHotelNameField: boolean;
    showTransferTrainFields: boolean;
    showDeparturePickupField: boolean;
    showCityTourCityField: boolean;
  };
  form: ManualScheduleFormValues;
  scheduleMethods: UseFormReturn<ManualScheduleFormValues>;
  handleFormChange: <Key extends keyof ManualScheduleFormValues>(
    field: Key,
    value: ManualScheduleFormValues[Key]
  ) => void;
  applyManualScheduleDraft: (
    draft: ManualScheduleFormValues,
    options?: { shouldDirty?: boolean; shouldValidate?: boolean }
  ) => void;
  isGroupReadyForItinerary: boolean;
  saudiCityOptions: string[];
  showFridayCityTourWarning: boolean;
}

export function ManualScheduleModal({
  isScheduleFormVisible,
  handleCloseScheduleForm,
  editingItemId,
  handleSaveItem,
  isFormDisabled,
  validationState,
  form,
  scheduleMethods,
  handleFormChange,
  applyManualScheduleDraft,
  isGroupReadyForItinerary,
  saudiCityOptions,
  showFridayCityTourWarning,
}: ManualScheduleModalProps) {
  if (!isScheduleFormVisible || typeof document === "undefined") {
    return null;
  }

  const {
    showFlightNumberField,
    showHotelNameField,
    showTransferTrainFields,
    showDeparturePickupField,
    showCityTourCityField,
  } = validationState;

  const scheduleErrors = scheduleMethods.formState.errors;

  const activityTypeAccentLineClassMap: Record<string, string> = {
    arrival: "bg-primary/80",
    transfer: "bg-secondary/80",
    "city-tour": "bg-tertiary-fixed/90",
    departure: "bg-error-container/90",
  };

  const activityTypeBannerClassMap: Record<string, string> = {
    arrival: "border-primary/35 bg-primary-fixed/12 text-primary",
    transfer: "border-secondary/35 bg-secondary/12 text-secondary",
    "city-tour": "border-tertiary-fixed/45 bg-tertiary-fixed/12 text-on-tertiary-fixed-variant",
    departure: "border-error-container/45 bg-error-container/12 text-on-error-container",
  };

  const activityTypeOptionClassMap: Record<string, string> = {
    arrival:
      "border-primary/30 bg-surface-container-lowest text-primary hover:border-primary/45 hover:bg-primary-fixed/12",
    transfer:
      "border-secondary/35 bg-surface-container-lowest text-secondary hover:border-secondary/55 hover:bg-secondary/12",
    "city-tour":
      "border-tertiary-fixed/40 bg-surface-container-lowest text-on-tertiary-fixed-variant hover:border-tertiary-fixed/65 hover:bg-tertiary-fixed/12",
    departure:
      "border-error-container/40 bg-surface-container-lowest text-on-error-container hover:border-error-container/65 hover:bg-error-container/12",
  };

  const neutralItinerarySectionClass = "border-outline-variant/45 bg-surface-container-high/70";
  const activityTypeCardClassMap: Record<string, string> = {
    arrival: neutralItinerarySectionClass,
    transfer: neutralItinerarySectionClass,
    "city-tour": neutralItinerarySectionClass,
    departure: neutralItinerarySectionClass,
  };

  const activityTypeTitleClassMap: Record<string, string> = {
    arrival: "text-on-surface",
    transfer: "text-on-surface",
    "city-tour": "text-on-surface",
    departure: "text-on-surface",
  };

  const activityTypeFocusLabelMap: Record<string, string> = {
    arrival: "Start Trip - Arrival (Paling Penting)",
    transfer: "Activity Focus - Transfer",
    "city-tour": "Activity Focus - City Tour",
    departure: "End Trip - Departure",
  };

  const fieldClassName = "serene-field";
  const wideFieldClassName = `${fieldClassName} md:col-span-2`;
  const inputClassName = "serene-input";
  const selectClassName = "serene-select";
  const textareaClassName = "serene-textarea";
  const warningClassName =
    "md:col-span-2 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant";
  const transferTrainGridClassName = "mt-2 grid gap-3 md:grid-cols-2";

  const manualScheduleFieldClassName = `${fieldClassName} rounded-2xl border p-3 shadow-sm ${
    activityTypeCardClassMap[form.category] ?? "border-outline-variant/45 bg-surface-container-lowest"
  }`;
  const manualScheduleWideFieldClassName = `${wideFieldClassName} rounded-2xl border p-3 shadow-sm ${
    activityTypeCardClassMap[form.category] ?? "border-outline-variant/45 bg-surface-container-lowest"
  }`;
  const manualScheduleInfoClassName = `md:col-span-2 flex items-start gap-2 rounded-2xl border p-3 text-sm ${
    activityTypeBannerClassMap[form.category] ?? "border-outline-variant/45 bg-surface-container-high text-on-surface"
  }`;
  const manualScheduleCheckClassName = `md:col-span-2 inline-flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-medium ${
    activityTypeBannerClassMap[form.category] ?? "border-outline-variant/45 bg-surface-container-high text-on-surface"
  }`;
  const manualScheduleRouteHintClassName = `md:col-span-2 rounded-2xl border px-3 py-2 text-xs font-medium leading-relaxed ${
    activityTypeCardClassMap[form.category] ?? "border-outline-variant/45 bg-surface-container-lowest"
  } text-on-surface-variant`;
  const manualScheduleTransferTrainCardClassName = `md:col-span-2 rounded-2xl border p-3 ${
    activityTypeCardClassMap[form.category] ?? "border-outline-variant/45 bg-surface-container-high"
  }`;

  const routeFieldConfig = getRouteFieldConfigByCategory(form.category);

  return createPortal(
    <div
      className="serene-modal-overlay fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
      role="dialog"
      aria-modal="true"
      onClick={handleCloseScheduleForm}
    >
      <section
        className="serene-modal-shell w-full max-w-[42rem] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <span
          className={`absolute inset-x-0 top-0 h-1 ${
            activityTypeAccentLineClassMap[form.category] ?? "bg-primary/80"
          }`}
          aria-hidden="true"
        />

        <header className="serene-dialog-header border-b border-outline-variant/35 bg-surface-container-lowest px-4 py-4 sm:px-5">
          <div
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              activityTypeBannerClassMap[form.category] ?? "bg-primary-fixed text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">
              {getScheduleTypeOption(form.category).icon}
            </span>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-on-surface">
              {editingItemId ? "Edit Itinerary Item" : "Add Itinerary Item"}
            </h2>
            <p className="text-sm text-on-surface-variant">
              Configure activity type and operational details for group travel schedule.
            </p>
          </div>
        </header>

        <div className="serene-dialog-body bg-surface-container-lowest px-4 py-4 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Select Activity Type
          </p>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["arrival", "transfer", "city-tour", "departure"] as const).map((category) => {
              const opt = getScheduleTypeOption(category);
              const isActive = form.category === category;
              const activeClass =
                activityTypeBannerClassMap[category] ??
                "border-primary/45 bg-primary-fixed/12 text-primary";
              const normalClass =
                activityTypeOptionClassMap[category] ??
                "border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant";

              return (
                <button
                  key={category}
                  type="button"
                  className={`inline-flex min-h-12 flex-col items-center justify-center rounded-xl border px-2 py-1 text-center transition ${
                    isActive ? `${activeClass} border-2` : normalClass
                  }`}
                  onClick={() => handleFormChange("category", category)}
                  disabled={!isGroupReadyForItinerary}
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    {opt.icon}
                  </span>
                  <span className="mt-1 text-[11px] font-bold uppercase tracking-wider">{opt.cardLabel}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 border-t border-outline-variant/35 pt-4 md:grid-cols-2">
            <label className={manualScheduleFieldClassName}>
              <span>Date</span>
              <Controller
                name="date"
                control={scheduleMethods.control}
                render={({ field }) => (
                  <DatePickerInput
                    inputClassName={inputClassName}
                    value={field.value}
                    onChange={(nextValue: string) => handleFormChange("date", nextValue)}
                    disabled={!isGroupReadyForItinerary}
                  />
                )}
              />
              {scheduleErrors.date ? (
                <p className="text-xs font-semibold text-error">{scheduleErrors.date.message}</p>
              ) : null}
            </label>

            {!showTransferTrainFields ? (
              <label className={manualScheduleFieldClassName}>
                <span>{form.category === "departure" ? "Flight Return Time" : "Time (Optional)"}</span>
                <Controller
                  name="time"
                  control={scheduleMethods.control}
                  render={({ field }) => (
                    <TimePickerInput
                      inputClassName={inputClassName}
                      value={field.value}
                      onChange={(nextValue: string) => handleFormChange("time", nextValue)}
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
              <label className={manualScheduleWideFieldClassName}>
                <span>Flight Number</span>
                <Controller
                  name="flightNumber"
                  control={scheduleMethods.control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleFormChange("flightNumber", event.target.value)}
                      placeholder="e.g. SV-827"
                      disabled={!isGroupReadyForItinerary}
                    />
                  )}
                />
                {scheduleErrors.flightNumber ? (
                  <p className="text-xs font-semibold text-error">
                    {scheduleErrors.flightNumber.message}
                  </p>
                ) : null}
              </label>
            ) : null}

            {showHotelNameField ? (
              <label className={manualScheduleWideFieldClassName}>
                <span>Hotel Name</span>
                <Controller
                  name="hotelName"
                  control={scheduleMethods.control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value ?? ""}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleFormChange("hotelName", event.target.value)}
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
              <label className={manualScheduleWideFieldClassName}>
                <span>City Tour City</span>
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-on-surface-variant"
                    aria-hidden="true"
                  >
                    location_city
                  </span>
                  <Controller
                    name="cityTourCity"
                    control={scheduleMethods.control}
                    render={({ field }) => (
                      <SereneSelect
                        className={`${selectClassName} pl-11`}
                        value={field.value}
                        onChange={(event: { target: { value: string } }) => handleFormChange("cityTourCity", event.target.value)}
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
                <p className="text-xs text-on-surface-variant">
                  Select the city where the city tour takes place.
                </p>
                {scheduleErrors.cityTourCity ? (
                  <p className="text-xs font-semibold text-error">
                    {scheduleErrors.cityTourCity.message}
                  </p>
                ) : null}
              </label>
            ) : null}

            {showDeparturePickupField ? (
              <label className={manualScheduleWideFieldClassName}>
                <span>Hotel Pickup Request Time</span>
                <Controller
                  name="hotelPickupRequestTime"
                  control={scheduleMethods.control}
                  render={({ field }) => (
                    <TimePickerInput
                      inputClassName={inputClassName}
                      value={field.value}
                      onChange={(nextValue: string) => handleFormChange("hotelPickupRequestTime", nextValue)}
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
                <div className={manualScheduleInfoClassName}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    info
                  </span>
                  <p>
                    If transfer uses a high-speed train, buses are still needed for hotel luggage pickup,
                    pilgrim drop-off at the station, and pickup at the destination station.
                  </p>
                </div>

                <label className={manualScheduleCheckClassName}>
                  <Controller
                    name="transferByTrain"
                    control={scheduleMethods.control}
                    render={({ field }) => (
                      <input
                        className="h-4 w-4 rounded border-outline-variant/45 text-primary focus:ring-primary/25"
                        type="checkbox"
                        checked={field.value}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                          const current = scheduleMethods.getValues();
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

            <label className={manualScheduleFieldClassName}>
              <span>{routeFieldConfig.fromLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "from") ? (
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-on-surface-variant"
                    aria-hidden="true"
                  >
                    location_city
                  </span>
                  <Controller
                    name="from"
                    control={scheduleMethods.control}
                    render={({ field }) => (
                      <SereneSelect
                        className={`${selectClassName} pl-11`}
                        value={field.value}
                        onChange={(event: { target: { value: string } }) => handleFormChange("from", event.target.value)}
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
                  control={scheduleMethods.control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleFormChange("from", event.target.value)}
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

            <label className={manualScheduleFieldClassName}>
              <span>{routeFieldConfig.toLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "to") ? (
                <div className="relative">
                  <span
                    className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-on-surface-variant"
                    aria-hidden="true"
                  >
                    location_city
                  </span>
                  <Controller
                    name="to"
                    control={scheduleMethods.control}
                    render={({ field }) => (
                      <SereneSelect
                        className={`${selectClassName} pl-11`}
                        value={field.value}
                        onChange={(event: { target: { value: string } }) => handleFormChange("to", event.target.value)}
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
                  control={scheduleMethods.control}
                  render={({ field }) => (
                    <input
                      className={inputClassName}
                      type="text"
                      value={field.value}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleFormChange("to", event.target.value)}
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
              <p className={manualScheduleRouteHintClassName}>{routeFieldConfig.helperText}</p>
            ) : null}

            {showTransferTrainFields ? (
              <div className={manualScheduleTransferTrainCardClassName}>
                <p
                  className={`text-sm font-semibold ${activityTypeTitleClassMap[form.category] ?? "text-primary"}`}
                >
                  High-speed train transfer operational details
                </p>

                <div className={transferTrainGridClassName}>
                  <label className={manualScheduleFieldClassName}>
                    <span>Train Departure Time</span>
                    <Controller
                      name="trainDepartureTime"
                      control={scheduleMethods.control}
                      render={({ field }) => (
                        <TimePickerInput
                          inputClassName={inputClassName}
                          value={field.value}
                          onChange={(nextValue: string) => handleFormChange("trainDepartureTime", nextValue)}
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

                  <label className={manualScheduleFieldClassName}>
                    <span>Destination Station Pickup Time</span>
                    <Controller
                      name="destinationPickupTime"
                      control={scheduleMethods.control}
                      render={({ field }) => (
                        <TimePickerInput
                          inputClassName={inputClassName}
                          value={field.value}
                          onChange={(nextValue: string) => handleFormChange("destinationPickupTime", nextValue)}
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

            <label className={manualScheduleCheckClassName}>
              <Controller
                name="requiresBus"
                control={scheduleMethods.control}
                render={({ field }) => (
                  <input
                    className="h-4 w-4 rounded border-outline-variant/45 text-primary focus:ring-primary/25"
                    type="checkbox"
                    checked={showTransferTrainFields ? true : field.value}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => handleFormChange("requiresBus", event.target.checked)}
                    disabled={!isGroupReadyForItinerary || showTransferTrainFields}
                  />
                )}
              />
              <span>
                {showTransferTrainFields ? "Bus Required (Luggage + Station Pickup)" : "Requires Bus"}
              </span>
            </label>

            <label className={manualScheduleWideFieldClassName}>
              <span>Notes</span>
              <Controller
                name="notes"
                control={scheduleMethods.control}
                render={({ field }) => (
                  <textarea
                    className={textareaClassName}
                    rows={3}
                    value={field.value}
                    onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => handleFormChange("notes", event.target.value)}
                    placeholder="Enter special instructions or details..."
                    disabled={!isGroupReadyForItinerary}
                  />
                )}
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant/35 pt-4">
            <button
              type="button"
              className="serene-btn-primary min-h-10 w-full sm:w-auto"
              onClick={handleSaveItem}
              disabled={isFormDisabled}
            >
              {editingItemId ? "Update Timeline" : "Add to Timeline"}
            </button>
            <button
              type="button"
              className="serene-btn-secondary min-h-10 w-full sm:w-auto"
              onClick={handleCloseScheduleForm}
            >
              Cancel
            </button>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
