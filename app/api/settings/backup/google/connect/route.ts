import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleAuthorizationUrl } from "@/lib/google-drive-backup";
import { requireSuperAdminAccess } from "@/lib/mecardee-auth";

export const GOOGLE_BACKUP_STATE_COOKIE = "mecardee_google_backup_oauth_state";

export async function GET() {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;
  try {
    const state = randomBytes(32).toString("base64url");
    const store = await cookies();
    store.set(GOOGLE_BACKUP_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return NextResponse.redirect(googleAuthorizationUrl(state));
  } catch (error) {
    console.error("Could not start Google Drive OAuth", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not start Google Drive connection." }, { status: 503 });
  }
}
