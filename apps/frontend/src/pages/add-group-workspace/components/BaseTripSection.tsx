import React from "react";
import { DatePickerInput, TimePickerInput } from "../../../components/date-time-pickers";
import { ItineraryBusCountField } from "../../../components/itinerary-bus-count-field";
import { SereneSelect } from "../../../components/serene-select";
import {
  getAllowedTransportModes,
  getRouteFieldConfigByCategory,
  getScheduleTypeOption,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  resolveFormTransportMode,
  shouldShowFridayCityTourWarning,
  TRANSPORT_MODE_META,
  type InputItineraryFormState,
  type ItineraryItem,
  type TransportMode,
} from "../../../shared/app-domain";
import {
  isBaseTripDraftInvalid,
  shouldUseSaudiCityDropdown,
  type BaseTripDraft,
} from "../helpers/add-group-workspace-helpers";
import { ItineraryTimeline } from "../../group-detail/components/ItineraryTimeline";
import { OperationalFormSection } from "./OperationalFormSection";

interface BaseTripSectionProps {
  isBaseTripFormVisible: boolean;
  currentBaseTripStepIndex: number;
  baseTripDrafts: BaseTripDraft[];
  previewItems: ItineraryItem[];
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
  previewItems,
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
  const [isPreviewVisible, setIsPreviewVisible] = React.useState(false);
  const previewHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const showPreview = isPreviewVisible && !isBaseTripSaveDisabled;

  React.useEffect(() => {
    if (!isBaseTripFormVisible || isBaseTripSaveDisabled) setIsPreviewVisible(false);
  }, [isBaseTripFormVisible, isBaseTripSaveDisabled]);

  React.useEffect(() => {
    if (showPreview) previewHeadingRef.current?.focus();
  }, [showPreview]);

  if (!isBaseTripFormVisible) {
    return null;
  }

  const activeBaseTrip = baseTripDrafts[currentBaseTripStepIndex] ?? null;
  const firstIncompleteTripIndex = baseTripDrafts.findIndex((trip) => trip.isEnabled && isBaseTripDraftInvalid(trip));
  const firstIncompleteTrip = baseTripDrafts[firstIncompleteTripIndex];
  const firstIncompleteTripLabel = firstIncompleteTrip
    ? `${getScheduleTypeOption(firstIncompleteTrip.category).cardLabel}${
        firstIncompleteTrip.category === "city-tour" ? ` ${firstIncompleteTripIndex === 1 ? "1" : "2"}` : ""
      }`
    : "";

  const fieldClassName = "serene-field min-w-0";
  const wideFieldClassName = `${fieldClassName} md:col-span-2`;
  const scheduleWideFieldClassName = `${fieldClassName} min-[460px]:col-span-2`;
  const inputClassName = "serene-input";
  const selectClassName = "serene-select";
  const textareaClassName = "serene-textarea";
  const routeHintClassName = "md:col-span-2 text-xs leading-relaxed text-on-surface-variant";
  const warningClassName =
    "md:col-span-2 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant";
  const transferTrainCardClassName = "md:col-span-2 border-l border-primary/25 py-1 pl-4";
  const transferTrainGridClassName = "mt-3 grid gap-x-5 gap-y-4 md:grid-cols-2";

  return (
    <div className="base-trip-workspace min-w-0 space-y-5 xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:items-start xl:gap-6 xl:space-y-0">
      <aside className="min-w-0 xl:sticky xl:top-5 xl:border-r xl:border-outline-variant/30 xl:pr-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold tracking-tight text-on-surface">5 Base Trips</h3>
          <span className="text-xs text-on-surface-variant xl:sr-only">
            Step {currentBaseTripStepIndex + 1} of {baseTripDrafts.length || 5}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
          Isi trip bertahap. Trip yang tidak dipakai bisa dilewati.
        </p>
        <div
          className="mt-4 grid min-w-0 grid-cols-5 gap-1.5 xl:grid-cols-1 xl:gap-1"
          role="group"
          aria-label="Base trip steps"
        >
          {baseTripDrafts.map((trip, index) => {
            const isCurrentStep = index === currentBaseTripStepIndex;
            const state = !trip.isEnabled ? "Skipped" : isBaseTripDraftInvalid(trip) ? "Pending" : "Ready";
            const label = `${getScheduleTypeOption(trip.category).cardLabel}${trip.category === "city-tour" ? ` ${index === 1 ? "1" : "2"}` : ""}`;
            const shortLabel =
              trip.category === "city-tour"
                ? `Tour ${index === 1 ? "1" : "2"}`
                : trip.category === "departure"
                  ? "Depart"
                  : label;
            return (
              <button
                key={trip.id}
                type="button"
                className={`base-trip-step serene-focus-ring relative flex min-h-14 min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-on-surface transition-colors xl:grid xl:min-h-16 xl:grid-cols-[2rem_1.25rem_minmax(0,1fr)_auto] xl:gap-2 xl:px-2.5 xl:py-3 ${isCurrentStep ? "bg-surface-container-low text-primary" : "hover:bg-surface-container-low"}`}
                onClick={() => {
                  setIsPreviewVisible(false);
                  handleJumpToBaseTripStep(index);
                }}
                disabled={!isGroupReadyForItinerary}
                aria-label={`Step ${index + 1}: ${label}, ${state}`}
                aria-current={isCurrentStep ? "step" : undefined}
              >
                <span
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${isCurrentStep ? "border-primary bg-primary text-on-primary" : "border-outline-variant/45 bg-surface-container-lowest text-on-surface"}`}
                >
                  {index + 1}
                </span>
                <span className="material-symbols-outlined text-lg max-xl:!hidden xl:!text-xl" aria-hidden="true">
                  {getScheduleTypeOption(trip.category).icon}
                </span>
                <span className="text-[10px] font-semibold xl:hidden">{shortLabel}</span>
                <span className="hidden min-w-0 whitespace-nowrap text-left text-sm font-semibold xl:block">
                  {label}
                </span>
                <span className="hidden whitespace-nowrap text-[11px] font-medium text-on-surface-variant xl:block xl:justify-self-end">
                  {state}
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        {showPreview ? (
          <section aria-labelledby="base-trip-preview-heading">
            <h3
              ref={previewHeadingRef}
              id="base-trip-preview-heading"
              tabIndex={-1}
              className="text-xl font-semibold tracking-tight text-on-surface focus:outline-none sm:text-2xl"
            >
              Full Itinerary
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">Journey timeline and key milestones</p>
            <ItineraryTimeline items={previewItems} />
          </section>
        ) : null}
        {(!showPreview && activeBaseTrip ? [activeBaseTrip] : []).map((item) => {
          const transportMode = resolveFormTransportMode(item.category, item.transportMode);
          const allowedTransportModes = getAllowedTransportModes(item.category);
          const showTransportModeInput = allowedTransportModes.length > 0;
          const showFlightNumberInput = false;
          const showHotelNameInput = item.category === "arrival" || item.category === "departure";
          const showDeparturePickupRequestInput = item.category === "departure";
          const showTransferTrainInputs = isTransferActivityType(item.category) && transportMode === "train";
          const showCityTourCityInput = isCityTourActivityType(item.category);
          const handleBaseTripModeChange = (mode: TransportMode) =>
            updateBaseTripDraftAtIndex(currentBaseTripStepIndex, (trip) => ({
              ...trip,
              transportMode: mode,
              busCount: mode === "bus" ? Math.max(1, trip.busCount ?? 0) : 0,
              flightNumber: mode === "flight" ? trip.flightNumber : "",
              transferByTrain: mode === "train",
              trainDepartureTime: mode === "train" ? trip.trainDepartureTime : "",
              destinationPickupTime: mode === "train" ? trip.destinationPickupTime : "",
            }));
          const handleBaseTripBusCountChange = (busCount: number) => {
            const nextMode =
              busCount === 0 && transportMode === "bus"
                ? (allowedTransportModes.find((mode) => mode === "none") ??
                  allowedTransportModes.find((mode) => mode === "flight") ??
                  transportMode)
                : busCount > 0 && transportMode === "none" && allowedTransportModes.includes("bus")
                  ? "bus"
                  : transportMode;
            updateBaseTripDraftAtIndex(currentBaseTripStepIndex, (trip) => {
              return {
                ...trip,
                busCount,
                transportMode: nextMode,
                flightNumber: nextMode === "flight" ? trip.flightNumber : "",
                transferByTrain: nextMode === "train",
                trainDepartureTime: nextMode === "train" ? trip.trainDepartureTime : "",
                destinationPickupTime: nextMode === "train" ? trip.destinationPickupTime : "",
              };
            });
          };
          const routeFieldConfigForItem = getRouteFieldConfigByCategory(item.category);
          const showFridayWarningForItem = shouldShowFridayCityTourWarning(item.category, item.date);

          return (
            <article key={item.id} className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-display text-xl font-semibold tracking-tight text-on-surface sm:text-2xl">
                    Step {currentBaseTripStepIndex + 1} – {getScheduleTypeOption(item.category).cardLabel}
                  </h4>
                  <p className="sr-only">{item.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 px-1 text-sm font-medium text-on-surface">
                    <input
                      className="h-5 w-5 rounded border-outline-variant/45 accent-primary focus:ring-primary/25"
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
                  gridClassName="grid grid-cols-1 gap-x-3 gap-y-4 min-[460px]:grid-cols-2 md:gap-x-5"
                  compactMobile
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
                      <span>{item.category === "departure" ? "Departure Activity Time" : "Time (Optional)"}</span>
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
                    <label className={scheduleWideFieldClassName}>
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
                    <label className={fieldClassName}>
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
                    <label className={scheduleWideFieldClassName}>
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
                    <label className={fieldClassName}>
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
                  {isFlightActivityType(item.category) ? (
                    <div className={`${routeHintClassName} min-[460px]:col-span-2`}>
                      Rute dan nomor penerbangan internasional dikelola di Visa Detail → Detail Penerbangan.
                    </div>
                  ) : null}
                </OperationalFormSection>

                <OperationalFormSection
                  step={2}
                  icon="route"
                  title="Route & transportation"
                  description="Origin, destination, train transfer, pickup, and bus requirements."
                  compactMobile
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
                          {item.from && !saudiCityOptions.includes(item.from) ? (
                            <option value={item.from}>{item.from}</option>
                          ) : null}
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
                          {item.to && !saudiCityOptions.includes(item.to) ? (
                            <option value={item.to}>{item.to}</option>
                          ) : null}
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

                  {showTransportModeInput ? (
                    <div className={wideFieldClassName}>
                      <span>Transport Mode</span>
                      <div
                        className="base-trip-transport-options inline-grid w-full grid-flow-col auto-cols-fr gap-1 rounded-xl border border-outline-variant/35 bg-surface-container-low p-1 sm:w-fit sm:min-w-80"
                        role="group"
                        aria-label="Transport Mode"
                      >
                        {allowedTransportModes.map((mode) => {
                          return (
                            <button
                              key={mode}
                              type="button"
                              className="base-trip-transport-option serene-focus-ring inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
                              onClick={() => handleBaseTripModeChange(mode)}
                              aria-pressed={transportMode === mode}
                              disabled={!isGroupReadyForItinerary || !item.isEnabled}
                            >
                              <span className="material-symbols-outlined text-base" aria-hidden="true">
                                {TRANSPORT_MODE_META[mode].icon}
                              </span>
                              <span>{TRANSPORT_MODE_META[mode].label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
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

                  <ItineraryBusCountField
                    id={`base-trip-${item.id}-bus`}
                    compact
                    busCount={item.busCount ?? 0}
                    onChange={handleBaseTripBusCountChange}
                    disabled={!isGroupReadyForItinerary || !item.isEnabled}
                  />
                </OperationalFormSection>

                <OperationalFormSection
                  step={3}
                  icon="edit_note"
                  title="Operational notes"
                  description="Keep special instructions available to the operations team."
                  compactMobile
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
        <div className="base-trip-actions sticky z-10 space-y-3 border-t border-outline-variant/30 bg-surface-container-lowest pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3">
          <p
            className={`flex items-start gap-2 text-xs font-medium leading-relaxed ${isBaseTripSaveDisabled ? "text-on-surface-variant" : "text-primary"}`}
            role="status"
            aria-live="polite"
          >
            {!isBaseTripSaveDisabled ? (
              <span className="material-symbols-outlined shrink-0 text-base" aria-hidden="true">
                check_circle
              </span>
            ) : null}
            <span>
              {enabledBaseTripCount === 0
                ? "Pilih minimal 1 trip yang digunakan."
                : firstIncompleteTripIndex >= 0
                  ? `Lengkapi Step ${firstIncompleteTripIndex + 1} (${firstIncompleteTripLabel}) sebelum menyimpan.`
                  : isActiveBaseTripInvalid
                    ? "Step aktif belum lengkap. Pastikan tanggal, rute, dan field wajib sudah terisi."
                    : "Semua trip yang digunakan sudah lengkap. Siap disimpan."}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="serene-btn-secondary min-h-12 flex-1 sm:min-h-11 sm:flex-none"
              onClick={() => {
                if (showPreview) setIsPreviewVisible(false);
                else handleBaseTripStepChange("previous");
              }}
              disabled={!isGroupReadyForItinerary || (!showPreview && isFirstBaseTripStep)}
            >
              Previous
            </button>
            <button
              type="button"
              className="serene-btn-secondary min-h-12 flex-1 sm:ml-auto sm:min-h-11 sm:flex-none"
              onClick={handleCloseBaseTripForm}
              disabled={!isGroupReadyForItinerary}
            >
              Cancel
            </button>
            {showPreview ? (
              <button
                type="button"
                className="serene-btn-primary min-h-12 w-full sm:min-h-11 sm:w-auto"
                onClick={handleSaveBaseTrips}
                disabled={isBaseTripSaveDisabled}
              >
                Save Trips
              </button>
            ) : (
              <button
                type="button"
                className="serene-btn-primary min-h-12 w-full sm:min-h-11 sm:w-auto"
                onClick={() => {
                  if (isLastBaseTripStep) setIsPreviewVisible(true);
                  else handleBaseTripStepChange("next");
                }}
                disabled={!isGroupReadyForItinerary || (isLastBaseTripStep && isBaseTripSaveDisabled)}
              >
                {isLastBaseTripStep ? "Preview Trips" : "Next"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
