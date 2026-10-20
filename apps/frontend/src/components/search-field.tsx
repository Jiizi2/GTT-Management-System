import { useId, useRef, type InputHTMLAttributes } from "react";
import { IconButton } from "./button";
import { Icon } from "./icon";

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  labelHidden?: boolean;
  clearLabel?: string;
}

/** A controlled search control. Filtering and URL state belong to the calling page. */
export function SearchField({
  label,
  value,
  onChange,
  labelHidden = true,
  clearLabel = "Hapus pencarian",
  className = "",
  id,
  disabled,
  ...props
}: SearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className={`min-w-0 flex-1 ${className}`.trim()}>
      <label htmlFor={inputId} className={labelHidden ? "sr-only" : "serene-field-label mb-2 block"}>
        {label}
      </label>
      <div className="serene-search-field">
        <Icon name="search" className="text-xl text-on-surface-variant" />
        <input
          {...props}
          ref={input}
          id={inputId}
          type="search"
          className="serene-search-field-input"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        {value ? (
          <IconButton
            icon="close"
            aria-label={clearLabel}
            disabled={disabled}
            className="serene-search-clear"
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
