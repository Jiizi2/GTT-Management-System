export function toIsoDateOnly(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value.trim().slice(0, 10);
}

export function toUtcMidnightDate(isoDate: string): Date {
  return new Date(`${isoDate.trim()}T00:00:00.000Z`);
}

export function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function parseIsoDateOnly(value: string): string {
  const trimmed = value.trim();
  if (isIsoDateOnly(trimmed)) {
    return trimmed;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid ISO date value '${value}'.`);
  }

  return parsedDate.toISOString().slice(0, 10);
}
