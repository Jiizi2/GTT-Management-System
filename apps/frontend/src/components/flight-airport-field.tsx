import { useState, type Ref } from "react";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "./form-accessibility";
import { SereneSelect } from "./serene-select";
import { findSaudiAirport, SAUDI_AIRPORTS } from "../shared/saudi-airports";

const CUSTOM_AIRPORT = "custom";

export function FlightAirportField({
  id,
  label,
  accessibleLabel,
  value,
  onChange,
  onBlur,
  inputRef,
  errorMessage,
}: {
  id: string;
  label: string;
  accessibleLabel: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: Ref<HTMLInputElement>;
  errorMessage?: string;
}) {
  const [manual, setManual] = useState(false);
  const airport = findSaudiAirport(value);
  const isCustom = manual || Boolean(value && !airport);
  const describedBy = getFieldDescribedBy(id, { errorMessage });

  return (
    <div className="serene-field lg:col-span-2">
      <label htmlFor={id}>{label}</label>
      <SereneSelect
        id={id}
        className="serene-select"
        aria-label={accessibleLabel}
        aria-invalid={getFieldAriaInvalid(errorMessage)}
        aria-describedby={describedBy}
        value={isCustom ? CUSTOM_AIRPORT : (airport?.code ?? "")}
        onChange={(event) => {
          setManual(event.target.value === CUSTOM_AIRPORT);
          onChange(event.target.value === CUSTOM_AIRPORT ? "" : event.target.value);
          onBlur();
        }}
      >
        <option value="">Pilih bandara</option>
        {SAUDI_AIRPORTS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.code} · {option.city}
          </option>
        ))}
        <option value={CUSTOM_AIRPORT}>Bandara lain / transit</option>
      </SereneSelect>
      {isCustom ? (
        <input
          id={`${id}-custom`}
          ref={inputRef}
          className="serene-input uppercase"
          aria-label={`Kode IATA ${accessibleLabel}`}
          aria-invalid={getFieldAriaInvalid(errorMessage)}
          aria-describedby={describedBy}
          value={value}
          maxLength={3}
          placeholder="CGK, DOH, DXB, AUH"
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          onBlur={onBlur}
        />
      ) : null}
      <FieldErrorMessage fieldId={id} message={errorMessage} className="text-xs font-medium text-brand-tertiary" />
    </div>
  );
}
