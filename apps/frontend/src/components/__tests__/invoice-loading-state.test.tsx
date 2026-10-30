import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useInvoiceDashboardQuery } from "../../hooks/use-invoice-query";

const { source, clients, invoices } = vi.hoisted(() => ({ source: vi.fn(), clients: vi.fn(), invoices: vi.fn() }));
vi.mock("../../hooks/use-invoice-backend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/use-invoice-backend")>()),
  fetchInvoiceBackendDataSource: source,
  fetchInvoiceClientsFromBackend: clients,
  fetchInvoicesFromBackend: invoices,
}));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useInvoiceDashboardQuery(), { wrapper });
}

describe("invoice independent loading", () => {
  beforeEach(() => {
    source.mockReset();
    clients.mockReset();
    invoices.mockReset();
    source.mockResolvedValue("prisma");
    invoices.mockResolvedValue([]);
  });

  it("reveals invoice rows while client options are still loading", async () => {
    let resolve!: (value: unknown[]) => void;
    clients.mockReturnValueOnce(
      new Promise((res) => {
        resolve = res;
      }),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.rows).toEqual([]);
    expect(result.current.clientsQuery.isPending).toBe(true);
    await act(async () => resolve([]));
    await waitFor(() => expect(result.current.clientsQuery.isSuccess).toBe(true));
    expect(invoices).toHaveBeenCalledTimes(1);
  });

  it("keeps a failed client request separate from the invoice list", async () => {
    clients.mockRejectedValueOnce(new Error("Client options timeout"));
    const { result } = setup();
    await waitFor(() => expect(result.current.clientsQuery.isError).toBe(true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.dataSource).toBe("prisma");
    expect(result.current.data?.rows).toEqual([]);
  });

  it("retains the previous invoice snapshot after a failed refresh", async () => {
    clients.mockResolvedValue([]);
    invoices.mockResolvedValueOnce([{ id: "i", invoiceNumber: "INV-001", dueDateIso: "2026-10-30", amount: 100 }]);
    const { result } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    invoices.mockRejectedValueOnce(new Error("Invoice timeout"));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data?.rows[0]?.invoiceNumber).toBe("INV-001");
    expect(result.current.data?.rows[0]?.amount).toBe(100);
  });
});
