import type { GroupSummary } from "./contracts";
import { groupAgentFamilies } from "./group-families";

export type DepartureJourney = {
  root: GroupSummary;
  members: GroupSummary[];
  date: string;
  dateSource: "flight" | "journey";
  pax: number;
};
export function validDateOnly(value: string | null | undefined): string | undefined {
  const key = value?.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/)?.[1];
  if (!key) return undefined;
  const [year, month, day] = key.split("-").map(Number);
  if (year < 1000 || year > 9999) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toISOString().slice(0, 10) === key ? key : undefined;
}
export function jakartaToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function departureJourneys(groups: GroupSummary[]): DepartureJourney[] {
  return groupAgentFamilies(groups)
    .flatMap(({ root, members }) => {
      const start = validDateOnly(root.arrivalDate);
      const outbound = root.itinerary
        .filter((item) => ["FLIGHT", "DEPARTURE"].includes(item.category.toUpperCase()))
        .map((item) => validDateOnly(item.isoDate))
        .filter((date): date is string => !!date && !!start && date <= start)
        .sort()[0];
      const date = outbound ?? start;
      return date
        ? [
            {
              root,
              members,
              date,
              dateSource: outbound ? ("flight" as const) : ("journey" as const),
              pax: members.reduce((total, member) => total + member.pax, 0),
            },
          ]
        : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.root.code.localeCompare(b.root.code));
}
export function shiftCalendarMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}
export function calendarDays(month: string): Array<{ date: string; day: number; inMonth: boolean }> {
  const [year, monthNumber] = month.split("-").map(Number);
  const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return Array.from({ length: Math.max(35, Math.ceil((offset + length) / 7) * 7) }, (_, index) => {
    const date = new Date(Date.UTC(year, monthNumber - 1, index - offset + 1));
    return {
      date: date.toISOString().slice(0, 10),
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() === monthNumber - 1,
    };
  });
}
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T12:00:00Z`),
  );
}
export function departureDateLabel(date: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
