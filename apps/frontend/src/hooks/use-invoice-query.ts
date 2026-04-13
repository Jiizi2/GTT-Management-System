import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvoiceInBackend,
  fetchInvoiceBackendDataSource,
  fetchInvoiceClientsFromBackend,
  fetchInvoicesFromBackend,
  updateInvoiceInBackend,
  type BackendDataSource,
  type BackendInvoiceClient,
  type BackendInvoiceRow,
  type CreateBackendInvoicePayload,
  type UpdateBackendInvoicePayload,
} from "./use-invoice-backend";
import { invoiceQueryKeys } from "../shared/query-keys";

type InvoiceDashboardData = {
  dataSource: BackendDataSource;
  clients: BackendInvoiceClient[];
  rows: BackendInvoiceRow[];
};

// Invoice is edited from multiple browsers/devices, so keep this dashboard fresh.
const INVOICE_DASHBOARD_REFRESH_INTERVAL_MS = 15_000;

function sortInvoiceRows(rows: BackendInvoiceRow[]): BackendInvoiceRow[] {
  return [...rows].sort((left, right) => {
    const dueDateDiff = right.dueDateIso.localeCompare(left.dueDateIso);
    if (dueDateDiff !== 0) {
      return dueDateDiff;
    }

    return right.invoiceNumber.localeCompare(left.invoiceNumber);
  });
}

export function useInvoiceDashboardQuery() {
  return useQuery({
    queryKey: invoiceQueryKeys.dashboard,
    queryFn: async ({ signal }): Promise<InvoiceDashboardData> => {
      const [dataSource, clients, rows] = await Promise.all([
        fetchInvoiceBackendDataSource({ signal }),
        fetchInvoiceClientsFromBackend({ signal }),
        fetchInvoicesFromBackend({ signal }),
      ]);

      return {
        dataSource,
        clients: [...clients].sort((left, right) => left.sortOrder - right.sortOrder),
        rows: sortInvoiceRows(rows),
      };
    },
    retry: false,
    staleTime: 15_000,
    refetchInterval: INVOICE_DASHBOARD_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useCreateInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBackendInvoicePayload) => createInvoiceInBackend(payload),
    retry: false,
    onSuccess: (createdInvoice) => {
      queryClient.setQueryData<InvoiceDashboardData | undefined>(invoiceQueryKeys.dashboard, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rows: sortInvoiceRows([createdInvoice, ...current.rows]),
        };
      });
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
    },
  });
}

export function useUpdateInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: string; payload: UpdateBackendInvoicePayload }) =>
      updateInvoiceInBackend(invoiceId, payload),
    retry: false,
    onSuccess: (updatedInvoice) => {
      queryClient.setQueryData<InvoiceDashboardData | undefined>(invoiceQueryKeys.dashboard, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rows: sortInvoiceRows(current.rows.map((row) => (row.id === updatedInvoice.id ? updatedInvoice : row))),
        };
      });
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
    },
  });
}
