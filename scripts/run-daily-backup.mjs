const appUrl = process.env.MECARDEE_APP_URL?.trim().replace(/\/$/, "");
const secret = process.env.BACKUP_CRON_SECRET?.trim();

if (!appUrl || !secret) {
  console.error("MECARDEE_APP_URL and BACKUP_CRON_SECRET are required for the Railway backup cron service.");
  process.exit(1);
}

const response = await fetch(`${appUrl}/api/internal/backups/daily`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(10 * 60 * 1_000),
});
const body = await response.text();
if (!response.ok) {
  console.error(`Scheduled backup failed (${response.status}): ${body.slice(0, 1_000)}`);
  process.exit(1);
}
console.log(body);
