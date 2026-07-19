export function formatDate(value: string | null): string {
  if (!value) return "Data belum tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function normalizeDateOnly(value: string | null | undefined): string | undefined {
  const matched = value?.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  return matched?.[1];
}

export const statusLabel = (value: string): string =>
  value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
