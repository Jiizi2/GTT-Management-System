# GTT Invoice Module Operations Runbook & Recovery Guide

This operations guide outlines the standard operating procedures (SOP), troubleshooting steps, and recovery commands for the GTT Invoice Module (Phase 3 Evolution) in production.

---

## 1. Shadow Read Mismatch Action Plan

When the telemetry metric `invoice_shadow_mismatch` is triggered or logged, it indicates that the legacy JSON `items` column and the new relational `InvoiceItem` records for a specific invoice do not match.

### Diagnosis Steps
1. Identify the affected Invoice ID from the telemetry details:
   ```json
   { "event": "invoice_shadow_mismatch", "id": "uuid-here", "legacyCount": 3, "relationalCount": 2 }
   ```
2. Query both datasets to inspect the difference:
   ```sql
   -- Query legacy JSON representation
   SELECT "id", "items" FROM "Invoice" WHERE "id" = 'uuid-here';

   -- Query relational records
   SELECT * FROM "InvoiceItem" WHERE "invoiceId" = 'uuid-here';
   ```

### Resolution / Data Correction
If the relational items are missing or outdated, run the manual reconciliation query to synchronize relational items from the legacy JSON payload:
```bash
# Execute the manual backfill task via the CLI runner (if available)
npm run db:backfill -- --invoiceId=uuid-here
```
Alternatively, run the SQL script to rebuild relational items for the single invoice:
```sql
BEGIN;
-- Delete current relational records
DELETE FROM "InvoiceItem" WHERE "invoiceId" = 'uuid-here';

-- Insert records parsed from the JSON field (example values)
INSERT INTO "InvoiceItem" ("id", "invoiceId", "description", "pax", "currency", "unitPrice", "totalPrice", "totalPriceIdr")
VALUES 
  (gen_random_uuid(), 'uuid-here', 'Umrah Package', 2, 'USD', 1500, 3000, 48000000);

COMMIT;
```

---

## 2. Backfill Migration Failure Recovery

If the cursor-based backfill command fails or halts midway, use this recovery plan to resume.

### Diagnosis
Check backend error logs for:
- Database connection timeouts.
- Lock contention errors.
- Out of memory (OOM) errors.

### Recovery Command
The backfill script is designed to be idempotent and supports resume offsets.
1. Find the last successfully processed Invoice ID or date from the logs.
2. Restart the backfill with the cursor flag:
   ```bash
   # Resume backfilling starting from a specific date or UUID cursor
   npm run db:backfill -- --startAfterId="uuid-of-last-processed-invoice" --batchSize=100
   ```

---

## 3. Spikes in Version Conflict Exception (`ConflictException`)

A surge in the `invoice_version_conflict` event indicates concurrency conflicts (multiple users modifying the same invoice at the same time).

### Action Plan
1. Check the event details to find the active IDs:
   ```json
   { "event": "invoice_version_conflict", "id": "uuid-here", "expected": 3, "actual": 4 }
   ```
2. **Determine Root Cause**:
   - **User Collaboration**: Multiple administrators editing the same invoice simultaneously.
   - **Frontend Bug**: Double-submitting forms (verify button throttling / disabled state on submission).
   - **Retry Loops**: Frontend retry policy triggering multiple requests due to slow response times.
3. **Database Performance Checks**:
   - Check if database queries are bottlenecked. Review `invoice_db_query_ms` and `invoice_transaction_ms` metrics in Grafana/Prometheus.
   - If database transaction times exceed 1000ms, investigate table locks:
     ```sql
     SELECT pid, query, state, age(clock_timestamp(), query_start) 
     FROM pg_stat_activity 
     WHERE state != 'idle';
     ```

---

## 4. Rollback & Reversibility Guide

If high latencies or shadow read mismatch errors occur after deploying Phase 3, you can perform a zero-downtime rollback.

### Step 4.1: Revert Feature Flag
Change the environment variable or feature flag in your environment configuration:
```env
# Disable reading from the relational table, fallback to legacy JSON reads
ENABLE_NEW_ITEM_READ=false
```
Deploy the configuration change. This instantly switches all reads back to the legacy JSON column without code changes.

### Step 4.2: Drop Relational Table (Only after contract cleanup)
Once the dual-write database phase is fully deprecated and we enter contract cleanup, to drop the legacy items column safely:
1. Generate the migration:
   ```bash
   npx prisma migrate dev --name drop_legacy_items_column
   ```
2. Verify the migration SQL file is simply:
   ```sql
   ALTER TABLE "Invoice" DROP COLUMN "items";
   ```
