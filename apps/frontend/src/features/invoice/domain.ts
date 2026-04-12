import type { BackendInvoiceClient, BackendInvoiceRow } from "./api.js";

export const INVOICE_PAGE_SIZE = 8;
export const MANUAL_CLIENT_OPTION_ID = "__invoice_client_other__";

export type InvoiceStatus = BackendInvoiceRow["status"];
export type InvoiceRow = BackendInvoiceRow;
export type InvoiceClientOption = BackendInvoiceClient;

export type DueMonthOption = {
  value: string;
  label: string;
};

export type SelectOption = {
  value: string;
  label: string;
};

export type InvoiceStatusOption = {
  value: InvoiceStatus;
  label: string;
};

export type InvoiceDraftCurrency = "IDR" | "USD" | "SAR";

export type InvoiceDraftItem = {
  id: string;
  description: string;
  pax: number;
  currency: InvoiceDraftCurrency;
  unitPrice: number;
};

export type InvoiceWorkspaceInitialData = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientLabel: string;
  clientId: string;
  groupCode: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  status: InvoiceStatus;
};
