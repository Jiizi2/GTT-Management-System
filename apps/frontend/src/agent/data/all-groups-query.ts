import type { QueryClient } from "@tanstack/react-query";
import type { GroupSummary, Page } from "./contracts";
import { portalGet } from "./portal-query";

export async function getAllAgentGroups(
  client: QueryClient,
  direction: "asc" | "desc" = "asc",
): Promise<GroupSummary[]> {
  const pageSize = 50;
  const path = (page: number) =>
    `/groups?page=${page}&pageSize=${pageSize}&sortBy=arrivalDate&sortDirection=${direction}`;
  const first = await portalGet<Page<GroupSummary>>(client, path(1));
  const pageCount = Math.ceil(first.total / pageSize);
  if (pageCount <= 1) return first.items;
  const rest = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => portalGet<Page<GroupSummary>>(client, path(index + 2))),
  );
  return [first, ...rest].flatMap((page) => page.items);
}
