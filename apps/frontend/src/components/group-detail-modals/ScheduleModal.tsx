import { DatePickerInput, TimePickerInput } from "../date-time-pickers";
import { SereneSelect } from "../serene-select";
import { useModalFocusTrap } from "../use-modal-focus-trap";
import { useSaudiCityOptions } from "../../hooks/use-saudi-city-options";
import {
  getRouteFieldConfigByCategory,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  normalizeSaudiCityValue,
  saudiCityOptions as defaultSaudiCityOptions,
  scheduleTypeOptions,
} from "../../shared/app-domain";
import { shouldUseSaudiCityDropdown } from "./helpers";
import { ModalPortal, ModalShell, ModalHeader, ModalFooter, ModalFooterButton } from "./shared";
import type { ScheduleFormState } from "../../shared/app-domain";

const modalFieldClassName = "serene-field";
const modalInputClassName = "serene-input";
const modalSelectClassName = "serene-select";
const modalTextareaClassName = "serene-textarea";
const modalScrollableBodyClassName = "serene-dialog-body flex flex-col gap-4 overflow-y-auto px-5 py-4";
const modalSecondaryButtonClassName = "serene-btn-secondary rounded-xl px-4 py-2 text-sm font-semibold";

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
const modalToggleTrackClassName = "inline-flex h-6 w-11 items-center rounded-full bg-slate-300 p-0.5 transition";
const modalToggleChipClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

/**
 * Props untuk ScheduleModal
 */
type ScheduleModalProps = {
  /** State form untuk itinerary schedule */
  form: ScheduleFormState;
  /** Apakah tombol save dinonaktifkan */
  isSaveDisabled: boolean;
  /** Apakah akan menampilkan warning city tour pada hari Jumat */
  showFridayCityTourWarning: boolean;
  /** Callback ketika field form berubah */
  onChange: <Key extends keyof ScheduleFormState>(field: Key, value: ScheduleFormState[Key]) => void;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika form di-submit */
  onSave: () => void;
};

/**
 * ScheduleModal - Modal untuk menambahkan/mengedit itinerary schedule
 *
 * Komponen ini menyediakan form kompleks untuk mengelola jadwal itinerary
 * dengan berbagai tipe aktivitas (arrival, departure, transfer, city tour).
 * Mendukung field dinamis berdasarkan tipe aktivitas yang dipilih.
 *
 * @example
 * ```tsx
 * <ScheduleModal
 *   form={scheduleForm}
 *   isSaveDisabled={false}
 *   showFridayCityTourWarning={false}
 *   onChange={(field, value) => setFieldValue(field, value)}
 *   onClose={() => setIsOpen(false)}
 *   onSave={() => saveSchedule()}
 * />
 * ```
 *
 * @component
 * @param {ScheduleModalProps} props - Komponen props
 * @returns {JSX.Element} Modal dengan form schedule itinerary
 */
export function ScheduleModal({
  form,
  isSaveDisabled,
  showFridayCityTourWarning,
  onChange,
  onClose,
  onSave,
}: ScheduleModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const saudiCityOptions = useSaudiCityOptions(defaultSaudiCityOptions);
  const showFlightNumberField = isFlightActivityType(form.category);
  const showPrimaryHotelNameField = form.category === "arrival" || form.category === "departure";
  const showTransferHotelFields = false;
  const showSingleHotelNameField = showPrimaryHotelNameField && !showTransferHotelFields;
  const showDeparturePickupField = form.category === "departure";
  const showTransferTrainFields = isTransferActivityType(form.category) && form.transferByTrain;
  const showCityTourCityField = isCityTourActivityType(form.category);
  const routeFieldConfig = getRouteFieldConfigByCategory(form.category);
  const scheduleStatusMessage = isSaveDisabled ? "Complete all required schedule fields before saving." : null;

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="schedule-modal-title" size="4xl">
        <div ref={dialogRef}>
          <ModalHeader titleId="schedule-modal-title" title="Add New Schedule" onClose={onClose} />

          <div className={modalScrollableBodyClassName}>
            {scheduleStatusMessage ? (
              <div className={modalWarnClassName} role="status" aria-live="polite">
                <span className="material-symbols-outlined" aria-hidden="true">
                  info
                </span>
                <p>{scheduleStatusMessage}</p>
              </div>
            ) : null}
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
                    <span
                      className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    >
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
                    <span
                      className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    >
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
                    <span
                      className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    >
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
                      form.category === "arrival" ? "e.g. Swissotel Al Maqam" : "e.g. Pullman Zamzam Madinah"
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
                      For high-speed train transfers, enter the train departure time and destination station pickup
                      time.
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

          <ModalFooter>
            <ModalFooterButton variant="primary" onClick={onSave} disabled={isSaveDisabled}>
              <span className="material-symbols-outlined" aria-hidden="true">
                check_circle
              </span>
              <span>Save Schedule</span>
            </ModalFooterButton>
            <ModalFooterButton variant="secondary" onClick={onClose}>
              Cancel
            </ModalFooterButton>
          </ModalFooter>
        </div>
      </ModalShell>
    </ModalPortal>
  );
}
