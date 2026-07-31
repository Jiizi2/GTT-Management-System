import { BadRequestException } from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { isIsoDateOnly, toIsoDateOnly } from "../utils/date-helpers";
import { clampMoney, isMoneyAtLeast, roundMoney, sumMoney } from "../utils/money";
import { randomUUID } from "crypto";

export { randomUUID };


export type InvoiceStatusLabel = "Paid" | "Pending" | "Overdue" | "Cancelled" | "Partially Paid";
export type InvoiceLineItemCurrency = "IDR" | "USD" | "SAR";

export type InvoiceLineItem = {
  description: string;
  pax: number;
  currency: InvoiceLineItemCurrency;
  unitPrice: number;
  totalPrice: number;
  totalPriceIdr: number;
};

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  agentId: string;
  agentName: string;
  clientName: string;
  clientLabel: string;
  clientInitials: string;
  groupCode?: string;
  groupName?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  status: InvoiceStatusLabel;
  monthKey: string;
  recipientName?: string;
  notes?: string;
  description?: string;
  items?: InvoiceLineItem[];
  version: number;
};

export type InvoiceClientListItem = {
  id: string;
  name: string;
  sortOrder: number;
  label: string;
  groupCode?: string;
  groupName?: string;
};

export type MemoryInvoiceClient = {
  id: string;
  name: string;
  sortOrder: number;
  groupCode?: string;
  groupName?: string;
};

export type MemoryInvoiceItem = {
  description: string;
  pax: number;
  currency: InvoiceLineItemCurrency;
  unitPrice: number;
  totalPrice: number;
  totalPriceIdr: number;
};

export type MemoryInvoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  agentId?: string;
  groupId?: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  status: InvoiceStatus;
  notes?: string;
  description?: string;
  recipientName?: string;
  items: MemoryInvoiceItem[];
  version: number;
  /**
   * Denormalised off the client (or the create/update payload) so list rows can
   * render a group without a second lookup. The memory repository writes these
   * on create and update; they were previously attached through an `any` cast.
   */
  groupCode?: string;
  groupName?: string;
};

export type PrismaInvoiceSummaryRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  agentId: string;
  issuedDate: Date;
  dueDate: Date;
  amount: Prisma.Decimal | number;
  status: InvoiceStatus;
  notes: string | null;
  recipientName: string | null;
  version: number;
  client: {
    id: string;
    name: string;
    sortOrder: number;
  };
  group: {
    code: string;
    name: string;
  } | null;
  agent: { name: string };
};

/** Line items, when the caller selected the `itemsRel` relation. */
export type PrismaInvoiceItemRow = {
  description: string;
  pax: number;
  currency: InvoiceLineItemCurrency;
  unitPrice: Prisma.Decimal | number;
  totalPrice: Prisma.Decimal | number;
  totalPriceIdr: Prisma.Decimal | number;
};

/**
 * Summary row plus the columns/relations that only some queries select. They are
 * optional rather than required so a caller that skips them still type-checks.
 */
export type PrismaInvoiceSummaryRowWithOptionalDownPayment = PrismaInvoiceSummaryRow & {
  downPaymentIdr?: Prisma.Decimal | number | null;
  description?: string | null;
  itemsRel?: PrismaInvoiceItemRow[];
};

export type PrismaInvoiceDownPaymentRow = {
  downPaymentIdr: Prisma.Decimal | number | null;
};

export function normalizeIsoDate(input: string, fieldName: "issuedDate" | "dueDate"): string {
  const trimmed = input.trim();
  if (isIsoDateOnly(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${fieldName} value: '${input}'.`);
  }

  return toIsoDateOnly(parsed);
}

export function formatClientLabel(sortOrder: number, name: string): string {
  return `${String(sortOrder).padStart(2, "0")}. ${name.trim()}`;
}

export function getInitials(name: string): string {
  const chunks = name
    .trim()
    .split(/\s+/)
    .map((chunk) => chunk[0]?.toUpperCase())
    .filter((chunk): chunk is string => Boolean(chunk));

  if (chunks.length === 0) {
    return "NA";
  }

  return chunks.slice(0, 2).join("");
}

export function toStatusLabel(status: InvoiceStatus): InvoiceStatusLabel {
  if (status === InvoiceStatus.CANCELLED) {
    return "Cancelled";
  }

  if (status === InvoiceStatus.PAID) {
    return "Paid";
  }

  if (status === InvoiceStatus.OVERDUE) {
    return "Overdue";
  }

  if (status === InvoiceStatus.PARTIALLY_PAID) {
    return "Partially Paid";
  }

  return "Pending";
}

export function resolveMonthKey(isoDate: string): string {
  return isIsoDateOnly(isoDate) ? isoDate.slice(0, 7) : "unknown";
}

export function resolveEffectiveStatus(
  status: InvoiceStatus,
  dueDateIso: string,
  amount: number,
  downPaymentIdr: number,
  notes?: string,
): InvoiceStatus {
  if (status === InvoiceStatus.CANCELLED) {
    return InvoiceStatus.CANCELLED;
  }

  const sanitizedAmount = clampMoney(amount);
  const sanitizedDownPayment = clampMoney(downPaymentIdr);

  if (sanitizedAmount > 0 && isMoneyAtLeast(sanitizedDownPayment, sanitizedAmount)) {
    return InvoiceStatus.PAID;
  }

  if (status === InvoiceStatus.PAID) {
    return InvoiceStatus.PAID;
  }

  const isNoDueDate = notes?.includes("[NoDueDate:true]");
  if (!isNoDueDate && dueDateIso && dueDateIso !== "none") {
    const todayIso = toIsoDateOnly(new Date());
    if (dueDateIso < todayIso) {
      return InvoiceStatus.OVERDUE;
    }
  }

  if (status === InvoiceStatus.OVERDUE) {
    return isNoDueDate ? InvoiceStatus.PENDING : InvoiceStatus.OVERDUE;
  }

  if (sanitizedDownPayment > 0 && !isMoneyAtLeast(sanitizedDownPayment, sanitizedAmount)) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  if (status === InvoiceStatus.PARTIALLY_PAID) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  return InvoiceStatus.PENDING;
}

export function toNumberAmount(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeDownPaymentByAmount(amount: number, downPaymentIdr: number): number {
  const sanitizedAmount = clampMoney(amount);
  const sanitizedDownPayment = clampMoney(downPaymentIdr);
  return Math.min(sanitizedAmount, sanitizedDownPayment);
}

export function resolveDisplayedDownPaymentByAmount(
  amount: number,
  status: InvoiceStatus,
  downPaymentIdr: Prisma.Decimal | number | null | undefined,
): number {
  const sanitizedAmount = clampMoney(amount);
  const normalizedDownPayment = normalizeDownPaymentByAmount(sanitizedAmount, toNumberAmount(downPaymentIdr));
  if (normalizedDownPayment > 0) {
    return normalizedDownPayment;
  }

  return status === InvoiceStatus.PAID ? sanitizedAmount : 0;
}

export function coerceNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export function isInvoiceLineItemCurrency(value: string): value is InvoiceLineItemCurrency {
  return value === "IDR" || value === "USD" || value === "SAR";
}

/**
 * Rates are persisted as a `[Rates:USD=...,SAR=...]` tag inside `notes` because
 * they have no column. The pattern must accept decimals: it is mirrored by the
 * frontend strip patterns, and a rate that fails to parse here also fails to be
 * stripped there, leaking the raw tag onto the printed invoice.
 */
const INVOICE_RATES_TAG_PATTERN = /\[(?:Rates|ExchangeRate):USD=(\d+(?:\.\d+)?),SAR=(\d+(?:\.\d+)?)\]/;

export function extractExchangeRatesFromNotes(notes: string | undefined): { usdToIdr: number | null; sarToIdr: number | null } {
  const rates: { usdToIdr: number | null; sarToIdr: number | null } = { usdToIdr: null, sarToIdr: null };
  if (!notes) return rates;
  const match = notes.match(INVOICE_RATES_TAG_PATTERN);
  if (match) {
    const usdToIdr = Number.parseFloat(match[1]);
    const sarToIdr = Number.parseFloat(match[2]);
    rates.usdToIdr = Number.isFinite(usdToIdr) ? usdToIdr : null;
    rates.sarToIdr = Number.isFinite(sarToIdr) ? sarToIdr : null;
  }
  return rates;
}

export function normalizeInvoiceLineItem(
  value: unknown,
  usdToIdr: number | null,
  sarToIdr: number | null,
): InvoiceLineItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const description = getTrimmedString(item.description);
  const currency = getTrimmedString(item.currency).toUpperCase();
  // pax is a head count, not money — it stays an integer.
  const pax = Math.max(0, Math.round(coerceNumber(item.pax, 0)));
  const unitPrice = clampMoney(coerceNumber(item.unitPrice, 0));

  // Authoritatively recalculate totalPrice to reinforce data integrity
  const totalPrice = roundMoney(pax * unitPrice);

  // Authoritatively recalculate totalPriceIdr using extracted exchange rates
  let totalPriceIdr = totalPrice;
  if (currency === "USD" && usdToIdr !== null) {
    totalPriceIdr = roundMoney(totalPrice * usdToIdr);
  } else if (currency === "SAR" && sarToIdr !== null) {
    totalPriceIdr = roundMoney(totalPrice * sarToIdr);
  } else if (currency !== "IDR") {
    totalPriceIdr = clampMoney(coerceNumber(item.totalPriceIdr, totalPrice));
  }

  if (!description || !isInvoiceLineItemCurrency(currency) || pax <= 0 || unitPrice <= 0) {
    return null;
  }

  return {
    description,
    pax,
    currency,
    unitPrice,
    totalPrice,
    totalPriceIdr,
  };
}

export function normalizeInvoiceLineItems(items: unknown, notes?: string): InvoiceLineItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  const { usdToIdr, sarToIdr } = extractExchangeRatesFromNotes(notes);
  return items
    .map((item) => normalizeInvoiceLineItem(item, usdToIdr, sarToIdr))
    .filter((item): item is InvoiceLineItem => item !== null);
}

export function resolveInvoiceAmountFromItems(
  amount: number,
  items: ReadonlyArray<InvoiceLineItem> | undefined,
): number {
  const normalizedAmount = clampMoney(amount);
  if (!items || items.length === 0) {
    return normalizedAmount;
  }

  const itemsTotalIdr = sumMoney(items.map((item) => clampMoney(item.totalPriceIdr)));
  return itemsTotalIdr > 0 ? itemsTotalIdr : normalizedAmount;
}

export function resolveStoredInvoiceAmount(
  amount: number,
  items: ReadonlyArray<InvoiceLineItem> | undefined,
): number {
  const normalizedAmount = clampMoney(amount);
  if (normalizedAmount > 0 || !items || items.length === 0) {
    return normalizedAmount;
  }

  const itemsTotalIdr = sumMoney(items.map((item) => clampMoney(item.totalPriceIdr)));
  return itemsTotalIdr > 0 ? itemsTotalIdr : normalizedAmount;
}

export function hasInvoiceStatusEnumMismatch(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes('invalid input value for enum "InvoiceStatus"') ||
    message.includes("InvoiceStatus") && message.includes("CANCELLED")
  );
}

export function isRetryablePrismaWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

export function resolveNextClientSortOrder<T extends { sortOrder: number }>(clients: T[]): number {
  const usedSortOrders = new Set(
    clients
      .map((client) => Math.max(1, Math.round(client.sortOrder)))
      .filter((sortOrder) => Number.isFinite(sortOrder)),
  );

  let nextSortOrder = 1;
  while (usedSortOrders.has(nextSortOrder)) {
    nextSortOrder += 1;
  }

  return nextSortOrder;
}

export function getTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeInvoiceClientName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export const invoiceSummarySelect = {
  id: true,
  invoiceNumber: true,
  clientId: true,
  agentId: true,
  agent: { select: { name: true } },
  issuedDate: true,
  dueDate: true,
  amount: true,
  status: true,
  notes: true,
  description: true,
  recipientName: true,
  version: true,
  client: {
    select: {
      id: true,
      name: true,
      sortOrder: true,
    },
  },
  group: {
    select: {
      code: true,
      name: true,
    },
  },
  itemsRel: {
    select: {
      description: true,
      pax: true,
      currency: true,
      unitPrice: true,
      totalPrice: true,
      totalPriceIdr: true,
    },
  },
} as const;

export const invoiceSummarySelectWithDownPayment = {
  ...invoiceSummarySelect,
  downPaymentIdr: true,
} as const;
