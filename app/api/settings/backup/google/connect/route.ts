import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GOOGLE_BACKUP_STATE_COOKIE, googleAuthorizationUrl, googleBackupSettingsUrl } from "@/lib/google-drive-backup";
import { requireSuperAdminAccess } from "@/lib/mecardee-auth";

export async function GET(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;
  try {
    const state = randomBytes(32).toString("base64url");
    const authorizationUrl = googleAuthorizationUrl(state);
    const store = await cookies();
    store.set(GOOGLE_BACKUP_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error("Could not start Google Drive OAuth", error);
    return NextResponse.redirect(googleBackupSettingsUrl(request.url, "error", error instanceof Error ? error.message : "Could not start Google Drive connection."));
  }
}
