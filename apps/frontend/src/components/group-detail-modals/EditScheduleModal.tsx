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
import type { EditScheduleFormState } from "../../shared/app-domain";

const modalFieldClassName = "serene-field";
const modalInputClassName = "serene-input";
const modalSelectClassName = "serene-select";
const modalTextareaClassName = "serene-textarea";
const modalScrollableBodyClassName = "serene-dialog-body flex flex-col gap-4 overflow-y-auto px-5 py-4";
const modalSecondaryButtonClassName = "serene-btn-secondary rounded-xl px-4 py-2 text-sm font-semibold";

const modalGridClassName = "grid gap-3 md:grid-cols-2";
const modalGridThreeClassName = "grid gap-3 md:grid-cols-3";
const modalInfoClassName =
  "flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800";
const modalWarnClassName =
  "flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800";
const modalCheckClassName =
  "inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-surface-container-lowest px-3 py-2 text-sm font-medium text-slate-700";
const modalTransferCardClassName = "rounded-2xl border border-sky-200 bg-sky-50 p-3";
const modalToggleChipClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

/**
 * Props untuk EditScheduleModal
 */
type EditScheduleModalProps = {
  /** State form untuk itinerary schedule yang sedang diedit */
  form: EditScheduleFormState;
  /** Apakah tombol save dinonaktifkan */
  isSaveDisabled: boolean;
  /** Apakah akan menampilkan warning city tour pada hari Jumat */
  showFridayCityTourWarning: boolean;
  /** Callback ketika field form berubah */
  onChange: <Key extends keyof EditScheduleFormState>(field: Key, value: EditScheduleFormState[Key]) => void;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika form di-submit */
  onSave: () => void;
};

/**
 * EditScheduleModal - Modal untuk mengedit itinerary schedule yang sudah ada
 *
 * Komponen ini menyediakan form kompleks untuk mengedit jadwal itinerary
 * dengan berbagai tipe aktivitas (arrival, departure, transfer, city tour).
 * Mendukung field dinamis berdasarkan tipe aktivitas yang dipilih.
 *
 * @example
 * ```tsx
 * <EditScheduleModal
 *   form={editScheduleForm}
 *   isSaveDisabled={false}
 *   showFridayCityTourWarning={false}
 *   onChange={(field, value) => setFieldValue(field, value)}
 *   onClose={() => setIsOpen(false)}
 *   onSave={() => saveSchedule()}
 * />
 * ```
 *
 * @component
 * @param {EditScheduleModalProps} props - Komponen props
 * @returns {JSX.Element} Modal dengan form edit schedule itinerary
 */
export function EditScheduleModal({
  form,
  isSaveDisabled,
  showFridayCityTourWarning,
  onChange,
  onClose,
  onSave,
}: EditScheduleModalProps) {
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
      <ModalShell onClose={onClose} ariaLabelledBy="edit-schedule-title" size="2xl">
        <div ref={dialogRef}>
          <ModalHeader titleId="edit-schedule-title" title="Edit Schedule" onClose={onClose} centered />

          <div className={modalScrollableBodyClassName}>
            {scheduleStatusMessage ? (
              <div className={modalWarnClassName} role="status" aria-live="polite">
                <span className="material-symbols-outlined" aria-hidden="true">
                  info
                </span>
                <p>{scheduleStatusMessage}</p>
              </div>
            ) : null}
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

            <div className={modalGridClassName}>
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
            </div>

            {isTransferActivityType(form.category) ? (
              <>
                <div className={modalInfoClassName}>
                  <span className="material-symbols-outlined" aria-hidden="true">
                    info
                  </span>
                  <p>
                    For high-speed train transfers, enter the train departure time and destination station pickup time.
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
                <span>{showTransferTrainFields ? "Bus Required (Luggage + Station Pickup)" : "Requires Bus"}</span>
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

          <ModalFooter>
            <ModalFooterButton variant="primary" onClick={onSave} disabled={isSaveDisabled}>
              Save Changes
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
