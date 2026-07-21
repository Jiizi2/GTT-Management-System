import React from "react";
import { DatePickerInput, TimePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import {
  getRouteFieldConfigByCategory,
  getScheduleTypeOption,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  shouldShowFridayCityTourWarning,
  type InputItineraryFormState,
} from "../../../shared/app-domain";
import {
  isBaseTripDraftInvalid,
  shouldUseSaudiCityDropdown,
  type BaseTripDraft,
} from "../helpers/add-group-workspace-helpers";
import { OperationalFormSection } from "./OperationalFormSection";

interface BaseTripSectionProps {
  isBaseTripFormVisible: boolean;
  currentBaseTripStepIndex: number;
  baseTripDrafts: BaseTripDraft[];
  enabledBaseTripCount: number;
  isGroupReadyForItinerary: boolean;
  handleJumpToBaseTripStep: (stepIndex: number) => void;
  updateBaseTripDraftAtIndex: (tripIndex: number, updater: (draft: BaseTripDraft) => BaseTripDraft) => void;
  handleBaseTripChange: <Key extends keyof InputItineraryFormState>(
    tripIndex: number,
    field: Key,
    value: InputItineraryFormState[Key],
  ) => void;
  handleBaseTripStepChange: (direction: "next" | "previous") => void;
  isFirstBaseTripStep: boolean;
  isLastBaseTripStep: boolean;
  handleSaveBaseTrips: () => void;
  isBaseTripSaveDisabled: boolean;
  handleCloseBaseTripForm: () => void;
  isActiveBaseTripInvalid: boolean;
  saudiCityOptions: string[];
}

export function BaseTripSection({
  isBaseTripFormVisible,
  currentBaseTripStepIndex,
  baseTripDrafts,
  enabledBaseTripCount,
  isGroupReadyForItinerary,
  handleJumpToBaseTripStep,
  updateBaseTripDraftAtIndex,
  handleBaseTripChange,
  handleBaseTripStepChange,
  isFirstBaseTripStep,
  isLastBaseTripStep,
  handleSaveBaseTrips,
  isBaseTripSaveDisabled,
  handleCloseBaseTripForm,
  isActiveBaseTripInvalid,
  saudiCityOptions,
}: BaseTripSectionProps) {
  if (!isBaseTripFormVisible) {
    return null;
  }

  const activeBaseTrip = baseTripDrafts[currentBaseTripStepIndex] ?? null;

  const activityTypeAccentLineClassMap: Record<string, string> = {
    arrival: "bg-primary/80",
    transfer: "bg-secondary/80",
    "city-tour": "bg-tertiary-fixed/90",
    departure: "bg-error-container/90",
  };

  const activityTypeIconClassMap: Record<string, string> = {
    arrival: "bg-primary-fixed/75 text-primary",
    transfer: "bg-secondary/18 text-secondary",
    "city-tour": "bg-tertiary-fixed/18 text-on-tertiary-fixed-variant",
    departure: "bg-error-container/18 text-on-error-container",
  };

  const activityTypeTextToneClassMap: Record<string, string> = {
    arrival: "text-primary",
    transfer: "text-secondary",
    "city-tour": "text-on-tertiary-fixed-variant",
    departure: "text-on-error-container",
  };

  const activityTypeBadgeClassMap: Record<string, string> = {
    arrival: "border-primary/30 bg-surface-container-lowest text-primary",
    transfer: "border-secondary/35 bg-surface-container-lowest text-secondary",
    "city-tour": "border-tertiary-fixed/40 bg-surface-container-lowest text-on-tertiary-fixed-variant",
    departure: "border-error-container/40 bg-surface-container-lowest text-on-error-container",
  };

  const activityTypeActiveStepClassMap: Record<string, string> = {
    arrival: "border-primary/45 bg-surface-container-lowest text-on-surface",
    transfer: "border-secondary/45 bg-surface-container-lowest text-on-surface",
    "city-tour": "border-tertiary-fixed/60 bg-surface-container-lowest text-on-surface",
    departure: "border-error-container/60 bg-surface-container-lowest text-on-surface",
  };

  const activityTypeCompletedStepClassMap: Record<string, string> = {
    arrival: "border-primary/35 bg-surface-container-lowest text-on-surface",
    transfer: "border-secondary/35 bg-surface-container-lowest text-on-surface",
    "city-tour": "border-tertiary-fixed/45 bg-surface-container-lowest text-on-surface",
    departure: "border-error-container/45 bg-surface-container-lowest text-on-surface",
  };

  const neutralItinerarySectionClass = "border-outline-variant/45 bg-surface-container-lowest";
  const activityTypeCardClassMap: Record<string, string> = {
    arrival: neutralItinerarySectionClass,
    transfer: neutralItinerarySectionClass,
    "city-tour": neutralItinerarySectionClass,
    departure: neutralItinerarySectionClass,
  };

  const fieldClassName = "serene-field min-w-0";
  const wideFieldClassName = `${fieldClassName} md:col-span-2`;
  const inputClassName = "serene-input";
  const selectClassName = "serene-select";
  const textareaClassName = "serene-textarea";
  const routeHintClassName =
    "md:col-span-2 rounded-xl border border-outline-variant/35 bg-surface-container-low px-3 py-2 text-xs font-medium leading-relaxed text-on-surface-variant";
  const warningClassName =
    "md:col-span-2 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant";
  const checkClassName =
    "md:col-span-2 inline-flex min-h-11 items-center gap-3 rounded-xl bg-surface-container-low px-3 py-2.5 text-sm font-medium text-on-surface-variant";
  const transferTrainCardClassName = "md:col-span-2 border-l-2 border-primary/35 py-1 pl-4";
  const transferTrainGridClassName = "mt-3 grid gap-x-5 gap-y-4 md:grid-cols-2";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-surface-container-high px-3 py-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-fixed text-primary">
          <span className="material-symbols-outlined" aria-hidden="true">
            route
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-on-surface">Structured 5 Base Trips</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            <span className="sm:hidden">Isi trip step 1-5. Yang tidak dipakai bisa di-skip.</span>
            <span className="hidden sm:inline">
              Isi trip secara bertahap dari step 1 sampai 5. Trip yang tidak dipakai bisa di-skip.
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-surface-container-high p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-on-surface">
              Step {currentBaseTripStepIndex + 1} of {baseTripDrafts.length || 5}
            </p>
            <span className="text-xs font-semibold text-on-surface-variant">
              {enabledBaseTripCount} of {baseTripDrafts.length || 5} used
            </span>
          </div>

          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
            Activity type per trip
          </p>

          <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-5">
            {baseTripDrafts.map((trip, index) => {
              const isCurrentStep = index === currentBaseTripStepIndex;
              const isDisabledStep = !trip.isEnabled;
              const isCompletedStep = !isBaseTripDraftInvalid(trip);
              const stepToneClass =
                activityTypeBadgeClassMap[trip.category] ??
                "border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant";
              const activeStepToneClass =
                activityTypeActiveStepClassMap[trip.category] ??
                "border-primary/35 bg-primary-fixed text-on-primary-fixed-variant";
              const completedStepToneClass =
                activityTypeCompletedStepClassMap[trip.category] ??
                "border-primary/35 bg-surface-container-lowest text-primary";
              const tripTypeLabel = `${getScheduleTypeOption(trip.category).cardLabel}${
                trip.category === "city-tour" ? ` ${index === 1 ? "1" : "2"}` : ""
              }`;

              return (
                <button
                  key={trip.id}
                  type="button"
                  className={`relative inline-flex min-h-12 min-w-[9.5rem] snap-start items-center justify-start gap-2 overflow-hidden rounded-xl border-2 px-3 text-left text-sm font-semibold transition sm:min-w-0 ${
                    isCurrentStep
                      ? activeStepToneClass
                      : isDisabledStep
                        ? "border-outline-variant/25 bg-surface-container-low text-on-surface-variant/45"
                        : isCompletedStep
                          ? completedStepToneClass
                          : `${stepToneClass} hover:border-primary/45 hover:text-primary`
                  }`}
                  onClick={() => handleJumpToBaseTripStep(index)}
                  disabled={!isGroupReadyForItinerary}
                  aria-label={`Go to step ${index + 1}`}
                >
                  <span
                    className={`absolute inset-x-0 top-0 h-0.5 ${
                      activityTypeAccentLineClassMap[trip.category] ?? "bg-primary/80"
                    }`}
                    aria-hidden="true"
                  />
                  <span
                    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold shadow-sm ${
                      activityTypeIconClassMap[trip.category] ?? "bg-primary-fixed text-primary"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`material-symbols-outlined text-base ${
                        activityTypeTextToneClassMap[trip.category] ?? "text-primary"
                      }`}
                      aria-hidden="true"
                    >
                      {getScheduleTypeOption(trip.category).icon}
                    </span>
                    <span className="text-xs sm:text-sm">{tripTypeLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {(activeBaseTrip ? [activeBaseTrip] : []).map((item) => {
          const showFlightNumberInput = isFlightActivityType(item.category);
          const showHotelNameInput = item.category === "arrival" || item.category === "departure";
          const showDeparturePickupRequestInput = item.category === "departure";
          const showTransferTrainInputs = isTransferActivityType(item.category) && item.transferByTrain;
          const showCityTourCityInput = isCityTourActivityType(item.category);
          const activityCardToneClass =
            activityTypeCardClassMap[item.category] ?? "border-outline-variant/45 bg-surface-container-lowest";
          const routeFieldConfigForItem = getRouteFieldConfigByCategory(item.category);
          const showFridayWarningForItem = shouldShowFridayCityTourWarning(item.category, item.date);

          return (
            <article
              key={item.id}
              className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 ${activityCardToneClass}`}
            >
              <span
                className={`absolute inset-x-0 top-0 h-0.5 ${
                  activityTypeAccentLineClassMap[item.category] ?? "bg-primary/80"
                }`}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-primary">
                    Editing step {currentBaseTripStepIndex + 1}
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-on-surface">Operational details</h4>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/45 bg-surface-container-lowest px-2.5 py-1 text-xs font-bold leading-none text-on-surface">
                    <input
                      className="h-3.5 w-3.5 rounded border-outline-variant/45 text-primary focus:ring-primary/25"
                      type="checkbox"
                      checked={item.isEnabled}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        updateBaseTripDraftAtIndex(currentBaseTripStepIndex, (trip) => ({
                          ...trip,
                          isEnabled: event.target.checked,
                        }))
                      }
                      disabled={!isGroupReadyForItinerary}
                    />
                    <span>Use trip</span>
                  </label>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <OperationalFormSection
                  step={1}
                  icon="event"
                  title="Schedule details"
                  description="Date, time, accommodation, and activity-specific information."
                >
                  <label className={fieldClassName}>
                    <span>Date</span>
                    <DatePickerInput
                      inputClassName={inputClassName}
                      value={item.date}
                      onChange={(nextValue: string) =>
                        handleBaseTripChange(currentBaseTripStepIndex, "date", nextValue)
                      }
                      disabled={!isGroupReadyForItinerary || !item.isEnabled}
                    />
                  </label>

                  {!showTransferTrainInputs ? (
                    <label className={fieldClassName}>
                      <span>{item.category === "departure" ? "Flight Return Time" : "Time (Optional)"}</span>
                      <TimePickerInput
                        inputClassName={inputClassName}
                        value={item.time}
                        onChange={(nextValue: string) =>
                          handleBaseTripChange(currentBaseTripStepIndex, "time", nextValue)
                        }
                        disabled={!isGroupReadyForItinerary || !item.isEnabled}
                      />
                    </label>
                  ) : null}

                  {showFlightNumberInput ? (
                    <label className={wideFieldClassName}>
                      <span>Flight Number</span>
                      <input
                        className={inputClassName}
                        type="text"
                        value={item.flightNumber}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          handleBaseTripChange(currentBaseTripStepIndex, "flightNumber", event.target.value)
                        }
                        placeholder="e.g. SV-827"
                        disabled={!isGroupReadyForItinerary || !item.isEnabled}
                      />
                    </label>
                  ) : null}

                  {showHotelNameInput ? (
                    <label className={wideFieldClassName}>
                      <span>Hotel Name</span>
                      <input
                        className={inputClassName}
                        type="text"
                        value={item.hotelName ?? ""}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          handleBaseTripChange(currentBaseTripStepIndex, "hotelName", event.target.value)
                        }
                        placeholder="e.g. Pullman Zamzam Madinah"
                        disabled={!isGroupReadyForItinerary || !item.isEnabled}
                      />
                    </label>
                  ) : null}

                  {showCityTourCityInput ? (
                    <label className={wideFieldClassName}>
                      <span>City Tour City</span>
                      <div className="relative">
                        <span
                          className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-on-surface-variant"
                          aria-hidden="true"
                        >
                          location_city
                        </span>
                        <SereneSelect
                          className={`${selectClassName} pl-11`}
                          value={item.cityTourCity}
                          onChange={(event: { target: { value: string } }) =>
                            handleBaseTripChange(currentBaseTripStepIndex, "cityTourCity", event.target.value)
                          }
                          disabled={!isGroupReadyForItinerary || !item.isEnabled}
                        >
                          <option value="">Select city in Saudi</option>
                          {saudiCityOptions.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </SereneSelect>
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Select the city where the city tour takes place.
                      </p>
                    </label>
                  ) : null}

                  {showDeparturePickupRequestInput ? (
                    <label className={wideFieldClassName}>
                      <span>Hotel Pickup Request Time</span>
                      <TimePickerInput
                        inputClassName={inputClassName}
                        value={item.hotelPickupRequestTime}
                        onChange={(nextValue: string) =>
                          handleBaseTripChange(currentBaseTripStepIndex, "hotelPickupRequestTime", nextValue)
                        }
                        disabled={!isGroupReadyForItinerary || !item.isEnabled}
                      />
                    </label>
                  ) : null}
                </OperationalFormSection>

                <OperationalFormSection
                  step={2}
                  icon="route"
                  title="Route & transportation"
                  description="Origin, destination, train transfer, pickup, and bus requirements."
                >
                  <label className={fieldClassName}>
                    <span>{routeFieldConfigForItem.fromLabel}</span>
                    {shouldUseSaudiCityDropdown(item.category, "from") ? (
                      <div className="relative">
                        <span
                          className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-on-surface-variant"
                          aria-hidden="true"
                        >
                          location_city
                        </span>
                        <SereneSelect
                          className={`${selectClassName} pl-11`}
                          value={item.from}
                          onChange={(event: { target: { value: string } }) =>
                            handleBaseTripChange(currentBaseTripStepIndex, "from", event.target.value)
                          }
                          disabled={!isGroupReadyForItinerary || !item.isEnabled}
                        >
                          <option value="">Select city in Saudi</option>
                          {saudiCityOptions.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </SereneSelect>
                      </div>
                    ) : (
                      <input
                        className={inputClassName}
                        type="text"
                        value={item.from}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          handleBaseTripChange(currentBaseTripStepIndex, "from", event.target.value)
                        }
                        placeholder={routeFieldConfigForItem.fromPlaceholder}
                        disabled={!isGroupReadyForItinerary || !item.isEnabled}
                      />
                    )}
                  </label>

                  <label className={fieldClassName}>
                    <span>{routeFieldConfigForItem.toLabel}</span>
                    {shouldUseSaudiCityDropdown(item.category, "to") ? (
                      <div className="relative">
                        <span
                          className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-on-surface-variant"
                          aria-hidden="true"
                        >
                          location_city
                        </span>
                        <SereneSelect
                          className={`${selectClassName} pl-11`}
                          value={item.to}
                          onChange={(event: { target: { value: string } }) =>
                            handleBaseTripChange(currentBaseTripStepIndex, "to", event.target.value)
                          }
                          disabled={!isGroupReadyForItinerary || !item.isEnabled}
                        >
                          <option value="">Select city in Saudi</option>
                          {saudiCityOptions.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </SereneSelect>
                      </div>
                    ) : (
                      <input
                        className={inputClassName}
                        type="text"
                        value={item.to}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          handleBaseTripChange(currentBaseTripStepIndex, "to", event.target.value)
                        }
                        placeholder={routeFieldConfigForItem.toPlaceholder}
                        disabled={!isGroupReadyForItinerary || !item.isEnabled}
                      />
                    )}
                  </label>

                  {routeFieldConfigForItem.helperText ? (
                    <p className={routeHintClassName}>{routeFieldConfigForItem.helperText}</p>
                  ) : null}

                  {isTransferActivityType(item.category) ? (
                    <label className={checkClassName}>
                      <input
                        className="h-4 w-4 rounded border-outline-variant/45 text-primary focus:ring-primary/25"
                        type="checkbox"
                        checked={item.transferByTrain}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                          updateBaseTripDraftAtIndex(currentBaseTripStepIndex, (trip) => ({
                            ...trip,
                            transferByTrain: event.target.checked,
                            requiresBus: event.target.checked ? true : trip.requiresBus,
                          }))
                        }
                        disabled={!isGroupReadyForItinerary || !item.isEnabled}
                      />
                      <span>Transfer menggunakan Kereta Cepat (HHR)</span>
                    </label>
                  ) : null}

                  {showTransferTrainInputs ? (
                    <div className={transferTrainCardClassName}>
                      <p className="text-sm font-semibold text-primary">
                        High-speed train transfer operational details
                      </p>

                      <div className={transferTrainGridClassName}>
                        <label className={fieldClassName}>
                          <span>Train Departure Time</span>
                          <TimePickerInput
                            inputClassName={inputClassName}
                            value={item.trainDepartureTime}
                            onChange={(nextValue: string) =>
                              handleBaseTripChange(currentBaseTripStepIndex, "trainDepartureTime", nextValue)
                            }
                            disabled={!isGroupReadyForItinerary || !item.isEnabled}
                          />
                        </label>

                        <label className={fieldClassName}>
                          <span>Destination Station Pickup Time</span>
                          <TimePickerInput
                            inputClassName={inputClassName}
                            value={item.destinationPickupTime}
                            onChange={(nextValue: string) =>
                              handleBaseTripChange(currentBaseTripStepIndex, "destinationPickupTime", nextValue)
                            }
                            disabled={!isGroupReadyForItinerary || !item.isEnabled}
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}

                  {showFridayWarningForItem ? (
                    <div className={warningClassName}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        warning
                      </span>
                      <p>Friday detected. Please align City Tour timing with Jumu&apos;ah prayer schedule.</p>
                    </div>
                  ) : null}

                  <label className={checkClassName}>
                    <input
                      className="h-4 w-4 rounded border-outline-variant/45 text-primary focus:ring-primary/25"
                      type="checkbox"
                      checked={showTransferTrainInputs ? true : item.requiresBus}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        handleBaseTripChange(currentBaseTripStepIndex, "requiresBus", event.target.checked)
                      }
                      disabled={!isGroupReadyForItinerary || showTransferTrainInputs || !item.isEnabled}
                    />
                    <span>{showTransferTrainInputs ? "Bus Required (Luggage + Station Pickup)" : "Requires Bus"}</span>
                  </label>
                </OperationalFormSection>

                <OperationalFormSection
                  step={3}
                  icon="edit_note"
                  title="Operational notes"
                  description="Keep special instructions available to the operations team."
                >
                  <label className={wideFieldClassName}>
                    <span>Notes</span>
                    <textarea
                      className={textareaClassName}
                      rows={2}
                      value={item.notes}
                      onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) =>
                        handleBaseTripChange(currentBaseTripStepIndex, "notes", event.target.value)
                      }
                      placeholder="Enter special instructions or details..."
                      disabled={!isGroupReadyForItinerary || !item.isEnabled}
                    />
                  </label>
                </OperationalFormSection>
              </div>

              {!item.isEnabled ? (
                <p className="mt-3 text-xs font-medium text-on-surface-variant">
                  Trip ini di-skip dan tidak akan masuk ke itinerary.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 space-y-2 rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 shadow-float sm:bottom-3">
        <p
          className={`text-xs font-medium ${
            isActiveBaseTripInvalid ? "text-on-tertiary-fixed-variant" : "text-primary"
          }`}
        >
          {enabledBaseTripCount === 0
            ? "Pilih minimal 1 trip yang digunakan."
            : isActiveBaseTripInvalid
              ? "Step aktif belum lengkap. Pastikan tanggal, rute, dan field wajib sudah terisi."
              : "Step aktif sudah lengkap."}
        </p>

        <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <button
              type="button"
              className="serene-btn-secondary min-h-12 w-full sm:min-h-10 sm:w-auto"
              onClick={() => handleBaseTripStepChange("previous")}
              disabled={!isGroupReadyForItinerary || isFirstBaseTripStep}
            >
              Previous
            </button>

            <button
              type="button"
              className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-primary/35 bg-primary-fixed px-4 py-2 text-sm font-semibold text-on-primary-fixed-variant transition hover:bg-primary-fixed/80 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
              onClick={() => handleBaseTripStepChange("next")}
              disabled={!isGroupReadyForItinerary || isLastBaseTripStep}
            >
              Next
            </button>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 border-t border-outline-variant/35 pt-3 sm:flex sm:w-auto sm:items-center sm:border-0 sm:pt-0">
            <button
              type="button"
              className="serene-btn-secondary min-h-10 w-full sm:w-auto"
              onClick={handleCloseBaseTripForm}
              disabled={!isGroupReadyForItinerary}
            >
              Cancel
            </button>
            <button
              type="button"
              className="serene-btn-primary min-h-12 w-full sm:min-h-10 sm:w-auto"
              onClick={handleSaveBaseTrips}
              disabled={isBaseTripSaveDisabled}
            >
              <span className="sm:hidden">Save Trips</span>
              <span className="hidden sm:inline">Save 5 Base Trips</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
