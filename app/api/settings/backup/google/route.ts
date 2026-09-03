import { DatabaseConfigurationError, withRequestClient } from "@/db";
import {
  GoogleBackupError,
  disconnectGoogleDrive,
  googleBackupStatus,
  runGoogleDriveBackup,
} from "@/lib/google-drive-backup";
import { requireSuperAdminAccess } from "@/lib/mecardee-auth";

function responseForError(error: unknown) {
  if (error instanceof DatabaseConfigurationError) return Response.json({ ok: false, error: error.message }, { status: 503 });
  if (error instanceof GoogleBackupError) return Response.json({ ok: false, error: error.message }, { status: error.status });
  console.error("Google Drive backup request failed", error);
  return Response.json({ ok: false, error: "Google Drive backup could not be completed." }, { status: 500 });
}
export async function GET() {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;
  try {
    const status = await withRequestClient(googleBackupStatus);
    return Response.json({ ok: true, ...status });
  } catch (error) {
    return responseForError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => null) as { action?: unknown } | null;
    if (body?.action !== "backup-now") return Response.json({ ok: false, error: "Google Drive backup action is invalid." }, { status: 400 });
    const result = await withRequestClient((client) => runGoogleDriveBackup(client, "Manual Drive", auth.user.username));
    return Response.json({ ok: true, result, message: "Backup successfully uploaded to Google Drive." });
  } catch (error) {
    return responseForError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
    if (body?.confirmation !== "DISCONNECT") return Response.json({ ok: false, error: "Disconnect confirmation is required." }, { status: 400 });
    const result = await withRequestClient(disconnectGoogleDrive);
    return Response.json({ ok: true, result, message: "Google Drive backup disconnected. Existing Drive backups were kept." });
  } catch (error) {
    return responseForError(error);
  }
}
