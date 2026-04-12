import { DatePickerInput, TimePickerInput } from "../../../../components/date-time-pickers";
import { SereneSelect } from "../../../../components/serene-select";
import type { InputItineraryFormState } from "../../../../shared/app-domain.js";
import {
  getRouteFieldConfigByCategory,
  getScheduleTypeOption,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  shouldShowFridayCityTourWarning,
} from "../../domain.js";
import {
  isBaseTripDraftInvalid,
  shouldUseSaudiCityDropdown,
  type BaseTripDraft,
} from "../helpers.js";

const fieldClassName = "serene-field";
const wideFieldClassName = `${fieldClassName} md:col-span-2`;
const inputClassName = "serene-input";
const selectClassName = "serene-select";
const textareaClassName = "serene-textarea";
const routeHintClassName =
  "md:col-span-2 text-xs font-medium leading-relaxed text-on-surface-variant";
const warningClassName =
  "md:col-span-2 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant";
const checkClassName =
  "md:col-span-2 inline-flex items-center gap-2 rounded-md bg-surface-container-high px-3 py-2 text-sm font-medium text-on-surface-variant";
const transferTrainCardClassName = "md:col-span-2 rounded-2xl bg-surface-container-high p-3";
const transferTrainGridClassName = "mt-2 grid gap-3 md:grid-cols-2";

const activityTypeCardClassMap: Record<string, string> = {
  arrival: "border-emerald-200 bg-emerald-50/60",
  transfer: "border-slate-200 bg-slate-50/70",
  "city-tour": "border-amber-200 bg-amber-50/60",
  departure: "border-rose-200 bg-rose-50/60",
};

const activityTypeBannerClassMap: Record<string, string> = {
  arrival: "border-emerald-200 bg-emerald-50 text-emerald-700",
  transfer: "border-slate-200 bg-slate-50 text-slate-700",
  "city-tour": "border-amber-200 bg-amber-50 text-amber-700",
  departure: "border-rose-200 bg-rose-50 text-rose-700",
};

const activityTypeTitleClassMap: Record<string, string> = {
  arrival: "text-emerald-700",
  transfer: "text-slate-700",
  "city-tour": "text-amber-700",
  departure: "text-rose-700",
};

const activityTypeBadgeClassMap: Record<string, string> = {
  arrival: "border-emerald-200 bg-emerald-50 text-emerald-700",
  transfer: "border-slate-200 bg-slate-50 text-slate-700",
  "city-tour": "border-amber-200 bg-amber-50 text-amber-700",
  departure: "border-rose-200 bg-rose-50 text-rose-700",
};

const activityTypeActiveStepClassMap: Record<string, string> = {
  arrival: "border-emerald-300 bg-emerald-100 text-emerald-800",
  transfer: "border-slate-300 bg-slate-100 text-slate-800",
  "city-tour": "border-amber-300 bg-amber-100 text-amber-800",
  departure: "border-rose-300 bg-rose-100 text-rose-800",
};

const activityTypeFocusLabelMap: Record<string, string> = {
  arrival: "Start Trip - Arrival (Paling Penting)",
  transfer: "Activity Focus - Transfer",
  "city-tour": "Activity Focus - City Tour",
  departure: "End Trip - Departure",
};

export function BaseTripWizard({
  baseTripDrafts,
  currentBaseTripStepIndex,
  enabledBaseTripCount,
  isGroupReadyForItinerary,
  isFirstBaseTripStep,
  isLastBaseTripStep,
  isBaseTripSaveDisabled,
  isActiveBaseTripInvalid,
  saudiCityOptions,
  onJumpToBaseTripStep,
  onBaseTripStepChange,
  onBaseTripChange,
  onToggleBaseTripEnabled,
  onToggleTransferByTrain,
  onSaveBaseTrips,
  onCancel,
}: {
  baseTripDrafts: BaseTripDraft[];
  currentBaseTripStepIndex: number;
  enabledBaseTripCount: number;
  isGroupReadyForItinerary: boolean;
  isFirstBaseTripStep: boolean;
  isLastBaseTripStep: boolean;
  isBaseTripSaveDisabled: boolean;
  isActiveBaseTripInvalid: boolean;
  saudiCityOptions: string[];
  onJumpToBaseTripStep: (stepIndex: number) => void;
  onBaseTripStepChange: (direction: "next" | "previous") => void;
  onBaseTripChange: (
    tripIndex: number,
    field: keyof InputItineraryFormState,
    value: InputItineraryFormState[keyof InputItineraryFormState],
  ) => void;
  onToggleBaseTripEnabled: (tripIndex: number, enabled: boolean) => void;
  onToggleTransferByTrain: (tripIndex: number, enabled: boolean) => void;
  onSaveBaseTrips: () => void;
  onCancel: () => void;
}) {
  const activeBaseTrip = baseTripDrafts[currentBaseTripStepIndex] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <span className="material-symbols-outlined" aria-hidden="true">
            route
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Structured 5 Base Trips</h3>
          <p className="mt-1 text-sm text-slate-600">
            <span className="sm:hidden">Isi trip step 1-5. Yang tidak dipakai bisa di-skip.</span>
            <span className="hidden sm:inline">
              Isi trip secara bertahap dari step 1 sampai 5. Trip yang tidak dipakai bisa di-skip.
            </span>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800">
              Step {currentBaseTripStepIndex + 1} of {baseTripDrafts.length || 5}
            </p>
            {activeBaseTrip ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${
                  activityTypeBadgeClassMap[activeBaseTrip.category] ??
                  "border-slate-300 bg-slate-50 text-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  {getScheduleTypeOption(activeBaseTrip.category).icon}
                </span>
                <span>
                  {activeBaseTrip.title} - {enabledBaseTripCount} trip dipakai
                </span>
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
            Activity type per trip
          </p>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {baseTripDrafts.map((trip, index) => {
              const isCurrentStep = index === currentBaseTripStepIndex;
              const isDisabledStep = !trip.isEnabled;
              const isCompletedStep = !isBaseTripDraftInvalid(trip);
              const stepToneClass =
                activityTypeBadgeClassMap[trip.category] ??
                "border-slate-300 bg-surface-container-lowest text-slate-600";
              const activeStepToneClass =
                activityTypeActiveStepClassMap[trip.category] ??
                "border-brand-primary/40 bg-brand-primary/10 text-brand-primary";
              const tripTypeLabel = `${getScheduleTypeOption(trip.category).cardLabel}${
                trip.category === "city-tour" ? ` ${index === 1 ? "1" : "2"}` : ""
              }`;

              return (
                <button
                  key={trip.id}
                  type="button"
                  className={`inline-flex min-h-12 items-center justify-start gap-2 rounded-xl border-2 px-3 text-left text-sm font-semibold transition ${
                    isCurrentStep
                      ? activeStepToneClass
                      : isDisabledStep
                        ? "border-slate-200 bg-slate-100 text-slate-400"
                        : isCompletedStep
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : `${stepToneClass} hover:border-brand-primary hover:text-brand-primary`
                  }`}
                  onClick={() => onJumpToBaseTripStep(index)}
                  disabled={!isGroupReadyForItinerary}
                  aria-label={`Go to step ${index + 1}`}
                >
                  <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-surface-container-lowest px-2 text-xs font-bold text-brand-primary shadow-sm">
                    {index + 1}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      {getScheduleTypeOption(trip.category).icon}
                    </span>
                    <span className="text-xs sm:text-sm">{tripTypeLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {activeBaseTrip ? (
          <BaseTripEditor
            item={activeBaseTrip}
            currentBaseTripStepIndex={currentBaseTripStepIndex}
            isGroupReadyForItinerary={isGroupReadyForItinerary}
            saudiCityOptions={saudiCityOptions}
            onBaseTripChange={onBaseTripChange}
            onToggleBaseTripEnabled={onToggleBaseTripEnabled}
            onToggleTransferByTrain={onToggleTransferByTrain}
          />
        ) : null}

        <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-3">
          <p
            className={`text-xs font-medium ${
              isActiveBaseTripInvalid ? "text-amber-700" : "text-emerald-700"
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
                className="serene-btn-secondary min-h-10 w-full sm:w-auto"
                onClick={() => onBaseTripStepChange("previous")}
                disabled={!isGroupReadyForItinerary || isFirstBaseTripStep}
              >
                Previous
              </button>

              <button
                type="button"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-brand-primary/35 bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                onClick={() => onBaseTripStepChange("next")}
                disabled={!isGroupReadyForItinerary || isLastBaseTripStep}
              >
                Next
              </button>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:flex sm:w-auto sm:items-center sm:border-0 sm:pt-0">
              <button
                type="button"
                className="serene-btn-primary min-h-10 w-full sm:w-auto"
                onClick={onSaveBaseTrips}
                disabled={isBaseTripSaveDisabled}
              >
                <span className="sm:hidden">Save Trips</span>
                <span className="hidden sm:inline">Save 5 Base Trips</span>
              </button>
              <button
                type="button"
                className="serene-btn-secondary min-h-10 w-full sm:w-auto"
                onClick={onCancel}
                disabled={!isGroupReadyForItinerary}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BaseTripEditor({
  item,
  currentBaseTripStepIndex,
  isGroupReadyForItinerary,
  saudiCityOptions,
  onBaseTripChange,
  onToggleBaseTripEnabled,
  onToggleTransferByTrain,
}: {
  item: BaseTripDraft;
  currentBaseTripStepIndex: number;
  isGroupReadyForItinerary: boolean;
  saudiCityOptions: string[];
  onBaseTripChange: (
    tripIndex: number,
    field: keyof InputItineraryFormState,
    value: InputItineraryFormState[keyof InputItineraryFormState],
  ) => void;
  onToggleBaseTripEnabled: (tripIndex: number, enabled: boolean) => void;
  onToggleTransferByTrain: (tripIndex: number, enabled: boolean) => void;
}) {
  const showFlightNumberInput = isFlightActivityType(item.category);
  const showHotelNameInput =
    item.category === "arrival" || item.category === "transfer" || item.category === "departure";
  const showDeparturePickupRequestInput = item.category === "departure";
  const showTransferTrainInputs = isTransferActivityType(item.category) && item.transferByTrain;
  const showCityTourCityInput = isCityTourActivityType(item.category);
  const activityCardToneClass =
    activityTypeCardClassMap[item.category] ?? "border-slate-200 bg-surface-container-lowest";
  const activityBannerToneClass =
    activityTypeBannerClassMap[item.category] ?? "border-slate-200 bg-slate-50 text-slate-700";
  const activityTitleToneClass = activityTypeTitleClassMap[item.category] ?? "text-slate-900";
  const activityFocusLabel =
    activityTypeFocusLabelMap[item.category] ??
    `Activity Focus - ${getScheduleTypeOption(item.category).cardLabel}`;
  const routeFieldConfigForItem = getRouteFieldConfigByCategory(item.category);
  const showFridayWarningForItem = shouldShowFridayCityTourWarning(item.category, item.date);

  return (
    <article className={`rounded-2xl border-2 p-4 shadow-sm ${activityCardToneClass}`}>
      <div
        className={`mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${activityBannerToneClass}`}
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          {getScheduleTypeOption(item.category).icon}
        </span>
        <p className="text-xs font-semibold uppercase tracking-[0.08em]">{activityFocusLabel}</p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className={`text-base font-semibold ${activityTitleToneClass}`}>{item.title}</h4>
          <p className="text-xs text-slate-600">{item.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${
              activityTypeBadgeClassMap[item.category] ??
              "border-slate-300 bg-slate-50 text-slate-700"
            }`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {getScheduleTypeOption(item.category).icon}
            </span>
            {getScheduleTypeOption(item.category).cardLabel}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-surface-container-lowest px-2.5 py-1 text-xs font-bold leading-none text-slate-700">
            <input
              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/25"
              type="checkbox"
              checked={item.isEnabled}
              onChange={(event) => onToggleBaseTripEnabled(currentBaseTripStepIndex, event.target.checked)}
              disabled={!isGroupReadyForItinerary}
            />
            <span>Use trip</span>
          </label>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          <span>Date</span>
          <DatePickerInput
            inputClassName={inputClassName}
            value={item.date}
            onChange={(nextValue) => onBaseTripChange(currentBaseTripStepIndex, "date", nextValue)}
            disabled={!isGroupReadyForItinerary || !item.isEnabled}
          />
        </label>

        {!showTransferTrainInputs ? (
          <label className={fieldClassName}>
            <span>{item.category === "departure" ? "Flight Return Time" : "Time (Optional)"}</span>
            <TimePickerInput
              inputClassName={inputClassName}
              value={item.time}
              onChange={(nextValue) => onBaseTripChange(currentBaseTripStepIndex, "time", nextValue)}
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
              onChange={(event) =>
                onBaseTripChange(currentBaseTripStepIndex, "flightNumber", event.target.value)
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
              onChange={(event) =>
                onBaseTripChange(currentBaseTripStepIndex, "hotelName", event.target.value)
              }
              placeholder="e.g. Pullman Zamzam Madinah"
              disabled={!isGroupReadyForItinerary || !item.isEnabled}
            />
          </label>
        ) : null}

        {showDeparturePickupRequestInput ? (
          <label className={wideFieldClassName}>
            <span>Hotel Pickup Request Time</span>
            <TimePickerInput
              inputClassName={inputClassName}
              value={item.hotelPickupRequestTime}
              onChange={(nextValue) =>
                onBaseTripChange(currentBaseTripStepIndex, "hotelPickupRequestTime", nextValue)
              }
              disabled={!isGroupReadyForItinerary || !item.isEnabled}
            />
          </label>
        ) : null}

        {showCityTourCityInput ? (
          <label className={wideFieldClassName}>
            <span>City Tour City</span>
            <div className="relative">
              <span
                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              >
                location_city
              </span>
              <SereneSelect
                className={`${selectClassName} pl-11`}
                value={item.cityTourCity}
                onChange={(event) =>
                  onBaseTripChange(currentBaseTripStepIndex, "cityTourCity", event.target.value)
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
            <p className="text-xs text-slate-600">Select the city where the city tour takes place.</p>
          </label>
        ) : null}

        {isTransferActivityType(item.category) ? (
          <label className={checkClassName}>
            <input
              className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
              type="checkbox"
              checked={item.transferByTrain}
              onChange={(event) =>
                onToggleTransferByTrain(currentBaseTripStepIndex, event.target.checked)
              }
              disabled={!isGroupReadyForItinerary || !item.isEnabled}
            />
            <span>Transfer using High-Speed Train (HHR)</span>
          </label>
        ) : null}

        <label className={fieldClassName}>
          <span>{routeFieldConfigForItem.fromLabel}</span>
          {shouldUseSaudiCityDropdown(item.category, "from") ? (
            <div className="relative">
              <span
                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              >
                location_city
              </span>
              <SereneSelect
                className={`${selectClassName} pl-11`}
                value={item.from}
                onChange={(event) => onBaseTripChange(currentBaseTripStepIndex, "from", event.target.value)}
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
              onChange={(event) => onBaseTripChange(currentBaseTripStepIndex, "from", event.target.value)}
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
                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              >
                location_city
              </span>
              <SereneSelect
                className={`${selectClassName} pl-11`}
                value={item.to}
                onChange={(event) => onBaseTripChange(currentBaseTripStepIndex, "to", event.target.value)}
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
              onChange={(event) => onBaseTripChange(currentBaseTripStepIndex, "to", event.target.value)}
              placeholder={routeFieldConfigForItem.toPlaceholder}
              disabled={!isGroupReadyForItinerary || !item.isEnabled}
            />
          )}
        </label>

        {routeFieldConfigForItem.helperText ? (
          <p className={routeHintClassName}>{routeFieldConfigForItem.helperText}</p>
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
                  onChange={(nextValue) =>
                    onBaseTripChange(currentBaseTripStepIndex, "trainDepartureTime", nextValue)
                  }
                  disabled={!isGroupReadyForItinerary || !item.isEnabled}
                />
              </label>

              <label className={fieldClassName}>
                <span>Destination Station Pickup Time</span>
                <TimePickerInput
                  inputClassName={inputClassName}
                  value={item.destinationPickupTime}
                  onChange={(nextValue) =>
                    onBaseTripChange(currentBaseTripStepIndex, "destinationPickupTime", nextValue)
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
            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
            type="checkbox"
            checked={showTransferTrainInputs ? true : item.requiresBus}
            onChange={(event) =>
              onBaseTripChange(currentBaseTripStepIndex, "requiresBus", event.target.checked)
            }
            disabled={!isGroupReadyForItinerary || showTransferTrainInputs || !item.isEnabled}
          />
          <span>
            {showTransferTrainInputs ? "Bus Required (Luggage + Station Pickup)" : "Requires Bus"}
          </span>
        </label>

        <label className={wideFieldClassName}>
          <span>Notes</span>
          <textarea
            className={textareaClassName}
            rows={2}
            value={item.notes}
            onChange={(event) => onBaseTripChange(currentBaseTripStepIndex, "notes", event.target.value)}
            placeholder="Enter special instructions or details..."
            disabled={!isGroupReadyForItinerary || !item.isEnabled}
          />
        </label>
      </div>

      {!item.isEnabled ? (
        <p className="mt-3 text-xs font-medium text-slate-500">
          Trip ini di-skip dan tidak akan masuk ke itinerary.
        </p>
      ) : null}
    </article>
  );
}
