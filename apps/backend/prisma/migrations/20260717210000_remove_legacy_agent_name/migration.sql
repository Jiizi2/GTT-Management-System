-- Keep agentName for one compatibility release so Operations can reconcile the
-- raw legacy value against the relational Agent backfill. A later contract
-- migration may remove it after the production verification window.
SELECT 1;
