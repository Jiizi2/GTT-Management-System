export type InvoiceFilters = { status?: string; page: number; pageSize: number };

export function buildInvoiceListPath(filters: InvoiceFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  params.set("sortBy", "dueDate");
  params.set("sortDirection", "desc");
  return `/invoices?${params.toString()}`;
}
