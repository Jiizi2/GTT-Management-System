export type GroupFilters = { q?: string; lifecycle?: string; page: number; pageSize: number };

export function buildGroupListPath(filters: GroupFilters): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.lifecycle) params.set("lifecycle", filters.lifecycle);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  params.set("sortBy", "arrivalDate");
  params.set("sortDirection", "asc");
  return `/groups?${params.toString()}`;
}
