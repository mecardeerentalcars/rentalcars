import { createHash, timingSafeEqual } from "node:crypto";
import { withRequestClient } from "@/db";
import { runGoogleDriveBackup } from "@/lib/google-drive-backup";

function equalSecret(actual: string, expected: string) {
  const actualHash = createHash("sha256").update(actual).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

export async function POST(request: Request) {
  const expected = process.env.BACKUP_CRON_SECRET?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const actual = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expected || !actual || !equalSecret(actual, expected)) {
    return Response.json({ ok: false, error: "Unauthorized scheduled backup request." }, { status: 401 });
  }

  try {
    const result = await withRequestClient((client) => runGoogleDriveBackup(client, "Scheduled", "Railway scheduler"));
    return Response.json({ ok: true, result });
  } catch (error) {
    console.error("Scheduled Mecardee backup failed", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Scheduled backup failed." }, { status: 500 });
  }
}
