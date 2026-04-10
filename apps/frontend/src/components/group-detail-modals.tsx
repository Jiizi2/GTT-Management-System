import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import * as Domain from "../shared/app-domain";
import { DatePickerInput, TimePickerInput } from "./date-time-pickers";
import { SereneSelect } from "./serene-select";
import { useSaudiCityOptions } from "../hooks/use-saudi-city-options";
import type {
  EditScheduleFormState,
  ItineraryItem,
  MusyrifFormState,
  NoteFormState,
  ScheduleFormState,
} from "../shared/app-domain";

const {
  getRouteFieldConfigByCategory,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  normalizeSaudiCityValue,
  saudiCityOptions: defaultSaudiCityOptions,
  scheduleTypeOptions,
} = Domain;

const modalFieldClassName =
  "serene-field";
const modalInputClassName = "serene-input";
const modalSelectClassName = "serene-select";
const modalTextareaClassName = "serene-textarea";
const modalOverlayClassName = "serene-modal-overlay z-[120]";

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

function shouldUseSaudiCityDropdown(category: string, field: "from" | "to"): boolean {
  if (field === "from") {
    return category === "transfer";
  }

  return category === "arrival" || category === "transfer";
}

export function MusyrifModal({
  form,
  isSaveDisabled,
  onChange,
  onClose,
  onSave,
}: {
  form: MusyrifFormState;
  isSaveDisabled: boolean;
  onChange: <Key extends keyof MusyrifFormState>(field: Key, value: MusyrifFormState[Key]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} grid place-items-center p-3 sm:p-4`} onClick={onClose}>
        <div
          className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-musyrif-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 id="edit-musyrif-title" className="text-2xl font-bold tracking-tight text-slate-900">Edit Musyrif</h2>

            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-primary hover:text-primary" onClick={onClose} aria-label="Close edit musyrif popup">
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className={modalFieldClassName}>
                <span>Musyrif Name</span>
                <input
                  className={modalInputClassName}
                  type="text"
                  value={form.name}
                  onChange={(event) => onChange("name", event.target.value)}
                  placeholder="e.g. Ust. Ahmad Hidayat"
                />
              </label>

              <label className={modalFieldClassName}>
                <span>Phone Number</span>
                <input
                  className={modalInputClassName}
                  type="tel"
                  value={form.phone}
                  onChange={(event) => onChange("phone", event.target.value)}
                  placeholder="+62 812-3456-7890"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" className="serene-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45" onClick={onSave} disabled={isSaveDisabled}>
              Save Changes
            </button>

            <button type="button" className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function DeleteConfirmModal({
  item,
  onClose,
  onConfirm,
}: {
  item: ItineraryItem;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} grid place-items-center p-3 sm:p-4`} onClick={onClose}>
        <div
          className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-itinerary-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <span className="material-symbols-outlined" aria-hidden="true">
                delete_forever
              </span>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-primary hover:text-primary"
              onClick={onClose}
              aria-label="Close delete confirmation popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className="space-y-3 px-5 py-4">
            <h2 id="delete-itinerary-title" className="text-2xl font-bold tracking-tight text-slate-900">Delete this itinerary?</h2>
            <p className="text-sm text-slate-600">
              This action will remove the selected itinerary item from the group detail
              page. Please confirm before continuing.
            </p>

            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
                <strong className="mt-1 block text-sm text-slate-900">
                  {item.date} {item.year}
                </strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</span>
                <strong className="mt-1 block text-sm text-slate-900">{item.title}</strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
                <strong className="mt-1 block text-sm text-slate-900">{item.category}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700" onClick={onConfirm}>
              <span className="material-symbols-outlined" aria-hidden="true">
                delete
              </span>
              <span>Delete Itinerary</span>
            </button>

            <button type="button" className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function DeleteGroupModal({
  groupCode,
  groupName,
  onClose,
  onConfirm,
}: {
  groupCode: string;
  groupName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} grid place-items-center p-3 sm:p-4`} onClick={onClose}>
        <div
          className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-group-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-tertiary/15 text-brand-tertiary">
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-brand-primary hover:text-brand-primary"
              onClick={onClose}
              aria-label="Close delete group confirmation popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className="space-y-3 px-5 py-4">
            <h2 id="delete-group-title" className="text-2xl font-bold tracking-tight text-slate-900">Delete this group?</h2>
            <p className="text-sm text-slate-600">
              This action will permanently remove the group from overview and detail pages.
              This action cannot be undone.
            </p>

            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Group Code</span>
                <strong className="mt-1 block text-sm text-slate-900">{groupCode}</strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Group Name</span>
                <strong className="mt-1 block text-sm text-slate-900">{groupName}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl bg-brand-tertiary px-4 py-2 text-sm font-semibold text-brand-neutral transition hover:bg-brand-tertiary/90" onClick={onConfirm}>
              <span className="material-symbols-outlined" aria-hidden="true">
                delete
              </span>
              <span>Delete Group</span>
            </button>

            <button type="button" className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function GroupEditModal({
  groupCode,
  groupName,
  codeDraft,
  nameDraft,
  codeError,
  nameError,
  isSaveDisabled,
  onCodeChange,
  onNameChange,
  onClose,
  onSave,
}: {
  groupCode: string;
  groupName: string;
  codeDraft: string;
  nameDraft: string;
  codeError: string;
  nameError: string;
  isSaveDisabled: boolean;
  onCodeChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} grid place-items-center p-3 sm:p-4`} onClick={onClose}>
        <div
          id="group-edit-modal"
          className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-edit-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/15 text-brand-primary">
              <span className="material-symbols-outlined" aria-hidden="true">
                edit
              </span>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-brand-primary hover:text-brand-primary"
              onClick={onClose}
              aria-label="Close edit group popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="space-y-1">
              <h2 id="group-edit-title" className="text-2xl font-bold tracking-tight text-slate-900">
                Edit Group
              </h2>
              <p className="text-sm text-slate-600">
                Update the group number and name in one place.
              </p>
            </div>

            <label className={modalFieldClassName}>
              <span>Group Number</span>
              <input
                className={modalInputClassName}
                type="text"
                value={codeDraft}
                onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
                placeholder={groupCode}
              />
            </label>
            {codeError ? <p className="text-xs font-medium text-brand-tertiary">{codeError}</p> : null}

            <label className={modalFieldClassName}>
              <span>Group Name</span>
              <input
                className={modalInputClassName}
                type="text"
                value={nameDraft}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={groupName}
              />
            </label>
            {nameError ? <p className="text-xs font-medium text-brand-tertiary">{nameError}</p> : null}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              className="serene-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              onClick={onSave}
              disabled={isSaveDisabled}
            >
              Save Changes
            </button>

            <button
              type="button"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function ScheduleModal({
  form,
  isSaveDisabled,
  showFridayCityTourWarning,
  onChange,
  onClose,
  onSave,
}: {
  form: ScheduleFormState;
  isSaveDisabled: boolean;
  showFridayCityTourWarning: boolean;
  onChange: <Key extends keyof ScheduleFormState>(field: Key, value: ScheduleFormState[Key]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const saudiCityOptions = useSaudiCityOptions(defaultSaudiCityOptions);
  const showFlightNumberField = isFlightActivityType(form.category);
  const showPrimaryHotelNameField =
    form.category === "arrival" || form.category === "transfer" || form.category === "departure";
  const showTransferHotelFields = isTransferActivityType(form.category);
  const showSingleHotelNameField = showPrimaryHotelNameField && !showTransferHotelFields;
  const showDeparturePickupField = form.category === "departure";
  const showTransferTrainFields = isTransferActivityType(form.category) && form.transferByTrain;
  const showCityTourCityField = isCityTourActivityType(form.category);
  const routeFieldConfig = getRouteFieldConfigByCategory(form.category);
  const modalGridClassName = "grid gap-3 md:grid-cols-2";
  const modalWideClassName = "md:col-span-2";
  const modalInfoClassName =
    "md:col-span-2 flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800";
  const modalWarnClassName =
    "flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800";
  const modalCheckClassName =
    "md:col-span-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-surface-container-lowest px-3 py-2 text-sm font-medium text-slate-700";
  const modalTransferCardClassName = "md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-3";
  const modalMetaClassName =
    "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2";
  const modalToggleTrackClassName =
    "inline-flex h-6 w-11 items-center rounded-full bg-slate-300 p-0.5 transition";
  const modalToggleChipClassName =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} flex items-center justify-center overflow-y-auto p-3 sm:p-4`} onClick={onClose}>
        <div
          className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-surface-container-lowest px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <span className="material-symbols-outlined" aria-hidden="true">
                edit_note
              </span>
            </div>

            <div>
              <h2 id="schedule-modal-title" className="text-2xl font-bold tracking-tight text-slate-900">Add New Schedule</h2>
              <p className="mt-1 text-sm text-slate-600">Capture the next operational activity for this group itinerary.</p>
            </div>
          </div>

          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-brand-primary hover:text-brand-primary" onClick={onClose} aria-label="Close add schedule popup">
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className={modalGridClassName}>
            <div className={`${modalFieldClassName} ${modalWideClassName}`}>
              <span>Activity Type</span>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {scheduleTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${modalToggleChipClassName} ${
                      form.category === option.value
                        ? "border-primary/60 bg-primary/18 text-primary shadow-sm"
                        : "border-slate-300 bg-surface-container-lowest text-slate-700 hover:border-primary/45 hover:bg-primary/10 hover:text-primary"
                    }`}
                    onClick={() => {
                      const nextCategory = option.value;
                      onChange("category", nextCategory);

                      if (shouldUseSaudiCityDropdown(nextCategory, "from")) {
                        onChange("from", normalizeSaudiCityValue(form.from));
                      }

                      if (shouldUseSaudiCityDropdown(nextCategory, "to")) {
                        onChange("to", normalizeSaudiCityValue(form.to));
                      }

                      if (!isFlightActivityType(nextCategory)) {
                        onChange("flightNumber", "");
                      }

                      if (nextCategory !== "departure") {
                        onChange("hotelPickupRequestTime", "");
                      }

                      if (!isCityTourActivityType(nextCategory)) {
                        onChange("cityTourCity", "");
                      }

                      if (!isTransferActivityType(nextCategory)) {
                        onChange("fromHotelName", "");
                        onChange("transferByTrain", false);
                        onChange("trainDepartureTime", "");
                        onChange("destinationPickupTime", "");
                      }
                    }}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      {option.icon}
                    </span>
                    <span>{option.modalLabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className={modalFieldClassName}>
              <span>Date</span>
              <DatePickerInput
                inputClassName={modalInputClassName}
                value={form.date}
                onChange={(nextValue) => onChange("date", nextValue)}
              />
            </label>

            {!showTransferTrainFields ? (
              <label className={modalFieldClassName}>
                <span>{form.category === "departure" ? "Flight Return Time" : "Time"}</span>
                <TimePickerInput
                  inputClassName={modalInputClassName}
                  value={form.time}
                  onChange={(nextValue) => onChange("time", nextValue)}
                />
              </label>
            ) : null}

            {showFlightNumberField ? (
              <label className={modalFieldClassName}>
                <span>Flight Number</span>
                <input
                  className={modalInputClassName}
                  type="text"
                  value={form.flightNumber}
                  onChange={(event) => onChange("flightNumber", event.target.value)}
                  placeholder="e.g. SV-827"
                />
              </label>
            ) : null}

            {showCityTourCityField ? (
              <label className={modalFieldClassName}>
                <span>City Tour City</span>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" aria-hidden="true">
                    location_city
                  </span>
                  <SereneSelect
                    className={`${modalSelectClassName} pl-11`}
                    value={form.cityTourCity}
                    onChange={(event) => onChange("cityTourCity", event.target.value)}
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

            <label className={modalFieldClassName}>
              <span>{routeFieldConfig.fromLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "from") ? (
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" aria-hidden="true">
                    location_city
                  </span>
                  <SereneSelect
                    className={`${modalSelectClassName} pl-11`}
                    value={form.from}
                    onChange={(event) => onChange("from", event.target.value)}
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
                  className={modalInputClassName}
                  type="text"
                  value={form.from}
                  onChange={(event) => onChange("from", event.target.value)}
                  placeholder={routeFieldConfig.fromPlaceholder}
                />
              )}
            </label>

            <label className={modalFieldClassName}>
              <span>{routeFieldConfig.toLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "to") ? (
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" aria-hidden="true">
                    location_city
                  </span>
                  <SereneSelect
                    className={`${modalSelectClassName} pl-11`}
                    value={form.to}
                    onChange={(event) => onChange("to", event.target.value)}
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
                  className={modalInputClassName}
                  type="text"
                  value={form.to}
                  onChange={(event) => onChange("to", event.target.value)}
                  placeholder={routeFieldConfig.toPlaceholder}
                />
              )}
            </label>

            {routeFieldConfig.helperText ? (
              <p className={`${modalWideClassName} text-xs text-slate-600`}>{routeFieldConfig.helperText}</p>
            ) : null}

            {showSingleHotelNameField ? (
              <label className={modalFieldClassName}>
                <span>Hotel Name</span>
                <input
                  className={modalInputClassName}
                  type="text"
                  value={form.hotelName}
                  onChange={(event) => onChange("hotelName", event.target.value)}
                  placeholder={
                    form.category === "arrival"
                      ? "e.g. Swissotel Al Maqam"
                      : "e.g. Pullman Zamzam Madinah"
                  }
                />
              </label>
            ) : null}

            {showTransferHotelFields ? (
              <>
                <label className={modalFieldClassName}>
                  <span>Hotel 1 (From City)</span>
                  <input
                    className={modalInputClassName}
                    type="text"
                    value={form.fromHotelName}
                    onChange={(event) => onChange("fromHotelName", event.target.value)}
                    placeholder="e.g. Swissotel Al Maqam"
                  />
                </label>

                <label className={modalFieldClassName}>
                  <span>Hotel 2 (To City)</span>
                  <input
                    className={modalInputClassName}
                    type="text"
                    value={form.hotelName}
                    onChange={(event) => onChange("hotelName", event.target.value)}
                    placeholder="e.g. Pullman Zamzam Madinah"
                  />
                </label>
              </>
            ) : null}

            {showDeparturePickupField ? (
              <label className={modalFieldClassName}>
                <span>Hotel Pickup Request Time</span>
                <TimePickerInput
                  inputClassName={modalInputClassName}
                  value={form.hotelPickupRequestTime}
                  onChange={(nextValue) => onChange("hotelPickupRequestTime", nextValue)}
                />
              </label>
            ) : null}

            {isTransferActivityType(form.category) ? (
              <>
                <div className={modalInfoClassName}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    info
                  </span>
                  <p>
                    For high-speed train transfers, enter the train departure time and destination
                    station pickup time.
                  </p>
                </div>

                <label className={modalCheckClassName}>
                  <input
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/25"
                    type="checkbox"
                    checked={form.transferByTrain}
                    onChange={(event) => {
                      onChange("transferByTrain", event.target.checked);

                      if (!event.target.checked) {
                        onChange("trainDepartureTime", "");
                        onChange("destinationPickupTime", "");
                      }
                    }}
                  />
                  <span>Transfer using High-Speed Train (HHR)</span>
                </label>
              </>
            ) : null}

            {showTransferTrainFields ? (
              <div className={modalTransferCardClassName}>
                <div className={modalGridClassName}>
                  <label className={modalFieldClassName}>
                    <span>Train Departure Time</span>
                    <TimePickerInput
                      inputClassName={modalInputClassName}
                      value={form.trainDepartureTime}
                      onChange={(nextValue) => onChange("trainDepartureTime", nextValue)}
                    />
                  </label>

                  <label className={modalFieldClassName}>
                    <span>Destination Station Pickup Time</span>
                    <TimePickerInput
                      inputClassName={modalInputClassName}
                      value={form.destinationPickupTime}
                      onChange={(nextValue) => onChange("destinationPickupTime", nextValue)}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </div>

          {showFridayCityTourWarning ? (
            <div className={modalWarnClassName}>
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
              <p>City Tour on Friday detected - please confirm timing around Jumu'ah prayer.</p>
            </div>
          ) : null}

          <label className={`${modalFieldClassName} ${modalWideClassName}`}>
            <span>Operational Note</span>
            <div className="space-y-1.5">
              <textarea
                className={modalTextareaClassName}
                rows={7}
                maxLength={500}
                value={form.note}
                onChange={(event) => onChange("note", event.target.value)}
                placeholder="Write any instruction, risk, or coordination note for operators..."
              />
              <div className="text-xs text-slate-500">Character limit: 500</div>
            </div>
          </label>

          <div className={modalMetaClassName}>
            <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
              <span className="material-symbols-outlined" aria-hidden="true">
                visibility
              </span>
              <span>Visible to all operators</span>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-3"
              onClick={() => onChange("highlighted", !form.highlighted)}
              aria-pressed={form.highlighted}
            >
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <span className="material-symbols-outlined" aria-hidden="true">
                  push_pin
                </span>
                <span>Highlight in itinerary</span>
              </div>

              <span className={`${modalToggleTrackClassName} ${form.highlighted ? "bg-primary" : "bg-slate-300"}`}>
                <span
                  className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition ${
                    form.highlighted ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-surface-container-lowest px-5 py-4">
          <button
            type="button"
            className="serene-btn-primary gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onSave}
            disabled={isSaveDisabled}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              check_circle
            </span>
            <span>Save Schedule</span>
          </button>

          <button type="button" className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary" onClick={onClose}>
            Cancel
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function EditScheduleModal({
  form,
  isSaveDisabled,
  showFridayCityTourWarning,
  onChange,
  onClose,
  onSave,
}: {
  form: EditScheduleFormState;
  isSaveDisabled: boolean;
  showFridayCityTourWarning: boolean;
  onChange: <Key extends keyof EditScheduleFormState>(
    field: Key,
    value: EditScheduleFormState[Key],
  ) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const saudiCityOptions = useSaudiCityOptions(defaultSaudiCityOptions);
  const showFlightNumberField = isFlightActivityType(form.category);
  const showPrimaryHotelNameField =
    form.category === "arrival" || form.category === "transfer" || form.category === "departure";
  const showTransferHotelFields = isTransferActivityType(form.category);
  const showSingleHotelNameField = showPrimaryHotelNameField && !showTransferHotelFields;
  const showDeparturePickupField = form.category === "departure";
  const showTransferTrainFields = isTransferActivityType(form.category) && form.transferByTrain;
  const showCityTourCityField = isCityTourActivityType(form.category);
  const routeFieldConfig = getRouteFieldConfigByCategory(form.category);
  const modalGridClassName = "grid gap-3 md:grid-cols-2";
  const modalGridThreeClassName = "grid gap-3 md:grid-cols-3";
  const modalWideClassName = "md:col-span-2";
  const modalCheckClassName =
    "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-surface-container-lowest px-3 py-2 text-sm font-medium text-slate-700";
  const modalWarnClassName =
    "flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800";
  const modalInfoClassName =
    "flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800";
  const modalTransferCardClassName = "rounded-2xl border border-sky-200 bg-sky-50 p-3";
  const modalToggleChipClassName =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} flex items-center justify-center overflow-y-auto p-3 sm:p-4`} onClick={onClose}>
        <div
          className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-2xl sm:max-h-[calc(100dvh-2rem)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-schedule-title"
          onClick={(event) => event.stopPropagation()}
        >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-surface-container-lowest px-5 py-4">
          <h2 id="edit-schedule-title" className="text-2xl font-bold tracking-tight text-slate-900">Edit Schedule</h2>

          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-brand-primary hover:text-brand-primary" onClick={onClose} aria-label="Close edit schedule popup">
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className={modalFieldClassName}>
            <span>Activity Type</span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {scheduleTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${modalToggleChipClassName} ${
                    form.category === option.value
                      ? "border-primary/60 bg-primary/18 text-primary shadow-sm"
                      : "border-slate-300 bg-surface-container-lowest text-slate-700 hover:border-primary/45 hover:bg-primary/10 hover:text-primary"
                  }`}
                  onClick={() => {
                    onChange("category", option.value);

                    if (shouldUseSaudiCityDropdown(option.value, "from")) {
                      onChange("from", normalizeSaudiCityValue(form.from));
                    }

                    if (shouldUseSaudiCityDropdown(option.value, "to")) {
                      onChange("to", normalizeSaudiCityValue(form.to));
                    }

                    if (!isFlightActivityType(option.value)) {
                      onChange("flightNumber", "");
                    }

                    if (option.value !== "departure") {
                      onChange("hotelPickupRequestTime", "");
                    }

                    if (!isCityTourActivityType(option.value)) {
                      onChange("cityTourCity", "");
                    }

                    if (!isTransferActivityType(option.value)) {
                      onChange("fromHotelName", "");
                      onChange("transferByTrain", false);
                      onChange("trainDepartureTime", "");
                      onChange("destinationPickupTime", "");
                    }
                  }}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {option.icon}
                  </span>
                  <span>{option.modalLabel}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={modalGridThreeClassName}>
            <label className={modalFieldClassName}>
              <span>Date</span>
              <DatePickerInput
                inputClassName={modalInputClassName}
                value={form.date}
                onChange={(nextValue) => onChange("date", nextValue)}
              />
            </label>

            {!showTransferTrainFields ? (
              <label className={modalFieldClassName}>
                <span>{form.category === "departure" ? "Flight Return Time" : "Time (optional)"}</span>
                <TimePickerInput
                  inputClassName={modalInputClassName}
                  value={form.time}
                  onChange={(nextValue) => onChange("time", nextValue)}
                />
              </label>
            ) : null}

            {showFlightNumberField ? (
              <label className={modalFieldClassName}>
                <span>Flight Number</span>
                <input
                  className={modalInputClassName}
                  type="text"
                  value={form.flightNumber}
                  onChange={(event) => onChange("flightNumber", event.target.value)}
                  placeholder="e.g. SV-821"
                />
              </label>
            ) : null}
          </div>

          {showFridayCityTourWarning ? (
            <div className={modalWarnClassName}>
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
              <p>City Tour on Friday detected - please confirm timing around Jumu'ah prayer.</p>
            </div>
          ) : null}

          {showCityTourCityField ? (
            <label className={modalFieldClassName}>
              <span>City Tour City</span>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" aria-hidden="true">
                  location_city
                </span>
                <SereneSelect
                  className={`${modalSelectClassName} pl-11`}
                  value={form.cityTourCity}
                  onChange={(event) => onChange("cityTourCity", event.target.value)}
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

          <div className={modalGridClassName}>
            <label className={modalFieldClassName}>
              <span>{routeFieldConfig.fromLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "from") ? (
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" aria-hidden="true">
                    location_city
                  </span>
                  <SereneSelect
                    className={`${modalSelectClassName} pl-11`}
                    value={form.from}
                    onChange={(event) => onChange("from", event.target.value)}
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
                  className={modalInputClassName}
                  type="text"
                  value={form.from}
                  onChange={(event) => onChange("from", event.target.value)}
                  placeholder={routeFieldConfig.fromPlaceholder}
                />
              )}
            </label>

            <label className={modalFieldClassName}>
              <span>{routeFieldConfig.toLabel}</span>
              {shouldUseSaudiCityDropdown(form.category, "to") ? (
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" aria-hidden="true">
                    location_city
                  </span>
                  <SereneSelect
                    className={`${modalSelectClassName} pl-11`}
                    value={form.to}
                    onChange={(event) => onChange("to", event.target.value)}
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
                  className={modalInputClassName}
                  type="text"
                  value={form.to}
                  onChange={(event) => onChange("to", event.target.value)}
                  placeholder={routeFieldConfig.toPlaceholder}
                />
              )}
            </label>
          </div>

          {routeFieldConfig.helperText ? (
            <p className="text-xs text-slate-600">{routeFieldConfig.helperText}</p>
          ) : null}

          <div className={modalGridClassName}>
            {showSingleHotelNameField ? (
              <label className={modalFieldClassName}>
                <span>Hotel Name</span>
                <input
                  className={modalInputClassName}
                  type="text"
                  value={form.hotelName}
                  onChange={(event) => onChange("hotelName", event.target.value)}
                  placeholder={
                    form.category === "arrival"
                      ? "e.g. Swissotel Al Maqam"
                      : "e.g. Pullman Zamzam Madinah"
                  }
                />
              </label>
            ) : null}

            {showTransferHotelFields ? (
              <>
                <label className={modalFieldClassName}>
                  <span>Hotel 1 (From City)</span>
                  <input
                    className={modalInputClassName}
                    type="text"
                    value={form.fromHotelName}
                    onChange={(event) => onChange("fromHotelName", event.target.value)}
                    placeholder="e.g. Swissotel Al Maqam"
                  />
                </label>

                <label className={modalFieldClassName}>
                  <span>Hotel 2 (To City)</span>
                  <input
                    className={modalInputClassName}
                    type="text"
                    value={form.hotelName}
                    onChange={(event) => onChange("hotelName", event.target.value)}
                    placeholder="e.g. Pullman Zamzam Madinah"
                  />
                </label>
              </>
            ) : null}

            {showDeparturePickupField ? (
              <label className={modalFieldClassName}>
                <span>Hotel Pickup Request Time</span>
                <TimePickerInput
                  inputClassName={modalInputClassName}
                  value={form.hotelPickupRequestTime}
                  onChange={(nextValue) => onChange("hotelPickupRequestTime", nextValue)}
                />
              </label>
            ) : null}
          </div>

          {isTransferActivityType(form.category) ? (
            <>
              <div className={modalInfoClassName}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  info
                </span>
                <p>
                  For high-speed train transfers, enter the train departure time and destination
                  station pickup time.
                </p>
              </div>

              <label className={modalCheckClassName}>
                <input
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/25"
                  type="checkbox"
                  checked={form.transferByTrain}
                  onChange={(event) => {
                    onChange("transferByTrain", event.target.checked);

                    if (!event.target.checked) {
                      onChange("trainDepartureTime", "");
                      onChange("destinationPickupTime", "");
                    }
                  }}
                />
                <span>Transfer using High-Speed Train (HHR)</span>
              </label>
            </>
          ) : null}

          {showTransferTrainFields ? (
            <div className={modalTransferCardClassName}>
              <div className={modalGridClassName}>
                <label className={modalFieldClassName}>
                  <span>Train Departure Time</span>
                  <TimePickerInput
                    inputClassName={modalInputClassName}
                    value={form.trainDepartureTime}
                    onChange={(nextValue) => onChange("trainDepartureTime", nextValue)}
                  />
                </label>

                <label className={modalFieldClassName}>
                  <span>Destination Station Pickup Time</span>
                  <TimePickerInput
                    inputClassName={modalInputClassName}
                    value={form.destinationPickupTime}
                    onChange={(nextValue) => onChange("destinationPickupTime", nextValue)}
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <label className={modalCheckClassName}>
              <input
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/25"
                type="checkbox"
                checked={showTransferTrainFields ? true : form.requiresBus}
                onChange={(event) => onChange("requiresBus", event.target.checked)}
                disabled={showTransferTrainFields}
              />
              <span>
                {showTransferTrainFields
                  ? "Bus Required (Luggage + Station Pickup)"
                  : "Requires Bus"}
              </span>
            </label>

            <label className={modalFieldClassName}>
              <span>Notes</span>
              <textarea
                className={modalTextareaClassName}
                rows={4}
                value={form.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                placeholder="Additional logistics or group requirements..."
              />
            </label>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-surface-container-lowest px-5 py-4">
          <button
            type="button"
            className="serene-btn-primary rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            onClick={onSave}
            disabled={isSaveDisabled}
          >
            Save Changes
          </button>

          <button type="button" className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary" onClick={onClose}>
            Cancel
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export function NoteModal({
  form,
  isSaveDisabled,
  onChange,
  onClose,
  onSave,
}: {
  form: NoteFormState;
  isSaveDisabled: boolean;
  onChange: <Key extends keyof NoteFormState>(field: Key, value: NoteFormState[Key]) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} grid place-items-center p-3 sm:p-4`} onClick={onClose}>
        <div
          className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="note-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <span className="material-symbols-outlined" aria-hidden="true">
                  edit_note
                </span>
              </div>

              <h2 id="note-modal-title" className="text-2xl font-bold tracking-tight text-slate-900">Add New Note</h2>
            </div>

            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-primary hover:text-primary" onClick={onClose} aria-label="Close add note popup">
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <label className={modalFieldClassName}>
              <span>Operational Note</span>
              <div className="space-y-1.5">
                <textarea
                  className={modalTextareaClassName}
                  rows={8}
                  maxLength={2000}
                  value={form.text}
                  onChange={(event) => onChange("text", event.target.value)}
                  placeholder="Write your operational note here..."
                />
                <div className="text-xs text-slate-500">{form.text.length}/2000</div>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <span className="material-symbols-outlined" aria-hidden="true">
                  visibility
                </span>
                <span>Visible to all operators</span>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-3"
                onClick={() => onChange("pinned", !form.pinned)}
                aria-pressed={form.pinned}
              >
                <div className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    push_pin
                  </span>
                  <span>Pin to top of group feed</span>
                </div>

                <span className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition ${form.pinned ? "bg-primary" : "bg-slate-300"}`}>
                  <span
                    className={`h-5 w-5 rounded-full bg-surface-container-lowest shadow-sm transition ${
                      form.pinned ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              className="serene-btn-primary gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
              onClick={onSave}
              disabled={isSaveDisabled}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                check_circle
              </span>
              <span>Save Note</span>
            </button>

            <button type="button" className="inline-flex items-center rounded-xl border border-slate-300 bg-surface-container-lowest px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}








