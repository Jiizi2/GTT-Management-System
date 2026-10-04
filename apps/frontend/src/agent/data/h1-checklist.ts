import type { QueryClient } from "@tanstack/react-query";
import type { GroupSummary, TransportationItem } from "./contracts";
import { validDateOnly } from "./departure-calendar";
import { groupAgentFamilies } from "./group-families";
import { portalGet } from "./portal-query";

export type ChecklistRow = TransportationItem & { group: GroupSummary };

export async function getAgentChecklist(client: QueryClient, groups: GroupSummary[]): Promise<ChecklistRow[]> {
  const rows = await Promise.all(
    groupAgentFamilies(groups).map(async ({ root: group }) =>
      (await portalGet<TransportationItem[]>(client, `/groups/${encodeURIComponent(group.code)}/transportation`)).map(
        (item) => ({ ...item, group }),
      ),
    ),
  );
  return [...new Map(rows.flat().map((row) => [row.id, row])).values()].sort(
    (a, b) => String(a.tripDate).localeCompare(String(b.tripDate)) || a.scheduledTime.localeCompare(b.scheduledTime),
  );
}

export function checklistDateRange(today: string): Set<string> {
  const start = new Date(`${today}T00:00:00Z`);
  return new Set(
    [0, 1, 2].map((offset) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    }),
  );
}

export function checklistInRange(row: ChecklistRow, range: Set<string>): boolean {
  const date = validDateOnly(row.tripDate);
  return Boolean(date && range.has(date));
}

export function checklistReady(row: ChecklistRow): boolean {
  return row.status === "ASSIGNED" && row.verifiedDriverCount >= row.requiredBusCount;
}
