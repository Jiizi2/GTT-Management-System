const webhookUrl = process.env.BACKUP_ALERT_WEBHOOK_URL?.trim();
const sourceUnit = process.argv[2] || "gtt-backup";

try {
  if (!webhookUrl) throw new Error("BACKUP_ALERT_WEBHOOK_URL wajib di-set.");
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "gtt_production_backup_alert",
      sourceUnit,
      host: process.env.HOSTNAME || "unknown",
      timestampUtc: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`webhook merespons HTTP ${response.status}.`);
} catch (error) {
  console.error(`BACKUP_ALERT_FAILED: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
