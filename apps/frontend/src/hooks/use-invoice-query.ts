import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvoiceInBackend,
  deleteInvoiceInBackend,
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

let isQueryMounted = false;

if (typeof window !== "undefined") {
  window.addEventListener("focus", () => {
    (window as any)._queryFetchReason = "windowFocus";
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

      const rawRows = Array.isArray(rows) ? rows : rows.data;

      const data = {
        dataSource,
        clients: [...clients].sort((left, right) => left.sortOrder - right.sortOrder),
        rows: sortInvoiceRows(rawRows),
      };

      let reason = (window as any)._queryFetchReason;
      if (!reason) {
        if (!isQueryMounted) {
          reason = "mount";
          isQueryMounted = true;
        } else {
          reason = "refetchInterval";
        }
      }
      (window as any)._queryFetchReason = null;
      console.log(`[QUERY FETCH] reason=${reason}`);

      const lastId = (window as any)._lastEditedInvoiceId;
      const matched = data.rows.find((r) => r.id === lastId);
      console.log(`[CACHE WRITE] source=query fetch\ntime=${performance.now()}\ninvoiceId=${lastId || "none"}\nstatus=${matched?.status || "none"}\namount=${matched?.amount || "none"}`);

      return data;
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
    mutationFn: (payload: CreateBackendInvoicePayload) => {
      (window as any)._createStartTime = performance.now();
      console.log(`[${new Date().toISOString()}] POST start`);
      return createInvoiceInBackend(payload);
    },
    retry: false,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: invoiceQueryKeys.dashboard });
      const previous = queryClient.getQueryData<InvoiceDashboardData>(invoiceQueryKeys.dashboard);
      return { previous };
    },
    onSuccess: (createdInvoice) => {
      const duration = Math.round(performance.now() - ((window as any)._createStartTime || performance.now()));
      console.log(`[${new Date().toISOString()}] POST success\ninvoiceId=${createdInvoice.id}\ninvoiceNumber=${createdInvoice.invoiceNumber}\nduration=${duration}ms`);
      
      console.log(`[${new Date().toISOString()}] setQueryData() start`);
      queryClient.setQueryData<InvoiceDashboardData | undefined>(invoiceQueryKeys.dashboard, (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          rows: sortInvoiceRows([createdInvoice, ...current.rows]),
        };
      });
      console.log(`[${new Date().toISOString()}] setQueryData() end`);
      
      console.log(`[${new Date().toISOString()}] invalidateQueries() start`);
      (window as any)._queryFetchReason = "invalidateQueries";
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
      console.log(`[${new Date().toISOString()}] invalidateQueries() end`);
    },
    onError: (err, variables, context) => {
      console.log(`[${new Date().toISOString()}] POST error:`, err);
      if (context?.previous) {
        queryClient.setQueryData(invoiceQueryKeys.dashboard, context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
    },
  });
}

export function useUpdateInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, payload }: { invoiceId: string; payload: UpdateBackendInvoicePayload }) => {
      (window as any)._patchStartTime = performance.now();
      console.log(`[${new Date().toISOString()}] PATCH start (id: ${invoiceId})`);
      return updateInvoiceInBackend(invoiceId, payload);
    },
    retry: false,
    onMutate: async ({ invoiceId }) => {
      (window as any)._lastEditedInvoiceId = invoiceId;
      await queryClient.cancelQueries({ queryKey: invoiceQueryKeys.dashboard });
      const previous = queryClient.getQueryData<InvoiceDashboardData>(invoiceQueryKeys.dashboard);
      return { previous };
    },
    onSuccess: (updatedInvoice) => {
      const duration = Math.round(performance.now() - ((window as any)._patchStartTime || performance.now()));
      console.log(`[${new Date().toISOString()}] PATCH success\ninvoiceId=${updatedInvoice.id}\ninvoiceNumber=${updatedInvoice.invoiceNumber}\nstatus=${updatedInvoice.status}\namount=${updatedInvoice.amount}\nduration=${duration}ms`);
      
      const before = queryClient.getQueryData<InvoiceDashboardData>(invoiceQueryKeys.dashboard);
      const beforeRow = before?.rows.find((r) => r.id === updatedInvoice.id);
      console.log(`[${new Date().toISOString()}] Cache before setQueryData:\nstatus=${beforeRow?.status}\namount=${beforeRow?.amount}`);
      
      console.log(`[${new Date().toISOString()}] setQueryData() start`);
      queryClient.setQueryData<InvoiceDashboardData | undefined>(invoiceQueryKeys.dashboard, (current) => {
        if (!current) {
          return current;
        }

        const nextRows = sortInvoiceRows(current.rows.map((row) => (row.id === updatedInvoice.id ? updatedInvoice : row)));
        console.log(`[${new Date().toISOString()}] setQueryData() reference change:`, current.rows !== nextRows);
        
        const matched = nextRows.find((r) => r.id === updatedInvoice.id);
        console.log(`[CACHE WRITE] source=setQueryData\ntime=${performance.now()}\ninvoiceId=${updatedInvoice.id}\nstatus=${matched?.status}\namount=${matched?.amount}`);
        
        return {
          ...current,
          rows: nextRows,
        };
      });
      console.log(`[${new Date().toISOString()}] setQueryData() end`);

      const after = queryClient.getQueryData<InvoiceDashboardData>(invoiceQueryKeys.dashboard);
      const afterRow = after?.rows.find((r) => r.id === updatedInvoice.id);
      console.log(`[${new Date().toISOString()}] Cache after setQueryData:\nstatus=${afterRow?.status}\namount=${afterRow?.amount}`);
      
      console.log(`[${new Date().toISOString()}] invalidateQueries() start`);
      (window as any)._queryFetchReason = "invalidateQueries";
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
      console.log(`[${new Date().toISOString()}] invalidateQueries() end`);
    },
    onError: (err, variables, context) => {
      console.log(`[${new Date().toISOString()}] PATCH error:`, err);
      if (context?.previous) {
        queryClient.setQueryData(invoiceQueryKeys.dashboard, context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
    },
  });
}

export function useDeleteInvoiceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) => {
      return deleteInvoiceInBackend(invoiceId);
    },
    retry: false,
    onMutate: async (invoiceId) => {
      await queryClient.cancelQueries({ queryKey: invoiceQueryKeys.dashboard });
      const previous = queryClient.getQueryData<InvoiceDashboardData>(invoiceQueryKeys.dashboard);
      return { previous };
    },
    onSuccess: (_, invoiceId) => {
      queryClient.setQueryData<InvoiceDashboardData | undefined>(invoiceQueryKeys.dashboard, (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          rows: current.rows.filter((row) => row.id !== invoiceId),
        };
      });
      (window as any)._queryFetchReason = "invalidateQueries";
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(invoiceQueryKeys.dashboard, context.previous);
      }
      void queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.dashboard });
    },
  });
}
