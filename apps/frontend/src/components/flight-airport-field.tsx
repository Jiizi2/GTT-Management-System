import { useState, type Ref } from "react";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "./form-accessibility";
import { SereneSelect } from "./serene-select";
import { findSaudiAirport, SAUDI_AIRPORTS } from "../shared/saudi-airports";

const CUSTOM_AIRPORT = "custom";
const DEFAULT_QUICK_CODES = ["JED", "MED", "CGK", "SUB", "DOH", "DXB"] as const;

export function FlightAirportField({
  id,
  label,
  accessibleLabel,
  value,
  onChange,
  onBlur,
  inputRef,
  errorMessage,
  quickCodes = DEFAULT_QUICK_CODES,
  preferCustomWhenEmpty = false,
  className = "serene-field lg:col-span-2",
}: {
  id: string;
  label: string;
  accessibleLabel: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef: Ref<HTMLInputElement>;
  errorMessage?: string;
  quickCodes?: readonly string[];
  preferCustomWhenEmpty?: boolean;
  className?: string;
}) {
  const [manual, setManual] = useState(preferCustomWhenEmpty && !value);
  const airport = findSaudiAirport(value);
  const isCustom = !airport && (manual || Boolean(value));
  const describedBy = getFieldDescribedBy(id, { errorMessage });
  const normalizedValue = value.trim().toUpperCase();

  return (
    <div className={className}>
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
      {quickCodes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          {quickCodes.map((code) => {
            const isSelected = normalizedValue === code;
            return (
              <button
                key={code}
                type="button"
                aria-label={`Pilih cepat ${code} untuk ${accessibleLabel}`}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold transition ${
                  isSelected
                    ? "bg-brand-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-primary/10 hover:text-brand-primary"
                }`}
                onClick={() => {
                  const isSaudi = Boolean(findSaudiAirport(code));
                  setManual(!isSaudi);
                  onChange(code);
                  onBlur();
                }}
              >
                {code}
              </button>
            );
          })}
        </div>
      ) : null}
      <FieldErrorMessage fieldId={id} message={errorMessage} className="text-xs font-medium text-brand-tertiary" />
    </div>
  );
}
