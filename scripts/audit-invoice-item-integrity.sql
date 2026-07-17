\set ON_ERROR_STOP on

SELECT COUNT(*) AS total_invoice,
       COUNT(*) FILTER (WHERE items IS NOT NULL) AS invoice_with_legacy_items
FROM "Invoice";

SELECT COUNT(*) AS total_relational_items,
       COUNT(DISTINCT "invoiceId") AS invoice_with_relational_items
FROM "InvoiceItem";

SELECT i.id,
       i."invoiceNumber",
       CASE WHEN jsonb_typeof(i.items) = 'array' THEN jsonb_array_length(i.items) ELSE 0 END AS legacy_count,
       COUNT(ii.id)::int AS relational_count
FROM "Invoice" AS i
LEFT JOIN "InvoiceItem" AS ii ON ii."invoiceId" = i.id
WHERE i.items IS NOT NULL
GROUP BY i.id, i."invoiceNumber", i.items
HAVING CASE WHEN jsonb_typeof(i.items) = 'array' THEN jsonb_array_length(i.items) ELSE 0 END <> COUNT(ii.id)
ORDER BY i."invoiceNumber";

-- Canonical runtime integrity: InvoiceItem is the source used by GET/export.
-- A legacy-count mismatch can be a stale JSON snapshot after an invoice edit,
-- so it must be evaluated together with the canonical amount reconciliation.
WITH relational_totals AS (
  SELECT i.id,
         i."invoiceNumber",
         i.amount,
         COUNT(ii.id)::int AS relational_count,
         COALESCE(SUM(ii."totalPriceIdr"), 0) AS relational_total_idr
  FROM "Invoice" AS i
  LEFT JOIN "InvoiceItem" AS ii ON ii."invoiceId" = i.id
  GROUP BY i.id, i."invoiceNumber", i.amount
)
SELECT id,
       "invoiceNumber",
       amount,
       relational_count,
       relational_total_idr
FROM relational_totals
WHERE amount <> relational_total_idr
ORDER BY "invoiceNumber";

-- Deterministic sampling candidates: oldest, newest, largest, Paid, and Pending.
WITH ranked AS (
  SELECT i.*,
         ROW_NUMBER() OVER (ORDER BY i."createdAt", i.id) AS oldest_rank,
         ROW_NUMBER() OVER (ORDER BY i."createdAt" DESC, i.id) AS newest_rank,
         ROW_NUMBER() OVER (ORDER BY i.amount DESC, i.id) AS amount_rank
  FROM "Invoice" AS i
)
SELECT r."invoiceNumber",
       r.status,
       r.amount,
       COUNT(ii.id)::int AS relational_count,
       COALESCE(SUM(ii."totalPriceIdr"), 0) AS relational_total_idr,
       r."createdAt"
FROM ranked AS r
LEFT JOIN "InvoiceItem" AS ii ON ii."invoiceId" = r.id
WHERE r.oldest_rank = 1
   OR r.newest_rank = 1
   OR r.amount_rank = 1
   OR r.status IN ('PAID', 'PENDING')
GROUP BY r.id, r."invoiceNumber", r.status, r.amount, r."createdAt",
         r.oldest_rank, r.newest_rank, r.amount_rank
ORDER BY r."createdAt", r.id;
