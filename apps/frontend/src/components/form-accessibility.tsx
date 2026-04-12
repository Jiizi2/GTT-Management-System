type FieldA11yOptions = {
  describedBy?: string | null;
  errorMessage?: string | null;
  extraDescribedBy?: Array<string | null | undefined>;
};

export function getFieldErrorId(fieldId: string): string {
  return `${fieldId}-error`;
}

export function getFieldDescribedBy(fieldId: string, options: FieldA11yOptions = {}): string | undefined {
  const ids = [
    options.describedBy,
    ...(options.extraDescribedBy ?? []),
    options.errorMessage ? getFieldErrorId(fieldId) : null,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (ids.length === 0) {
    return undefined;
  }

  return ids.join(" ");
}

export function getFieldAriaInvalid(errorMessage?: string | null): "true" | "false" {
  return errorMessage ? "true" : "false";
}

export function FieldErrorMessage({
  fieldId,
  message,
  className = "text-xs font-semibold text-error",
}: {
  fieldId: string;
  message?: string | null;
  className?: string;
}) {
  if (!message) {
    return null;
  }

  return (
    <p id={getFieldErrorId(fieldId)} role="alert" aria-live="polite" className={className}>
      {message}
    </p>
  );
}

