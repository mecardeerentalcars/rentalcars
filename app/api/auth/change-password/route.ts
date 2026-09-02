import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withRequestDb } from "@/db";
import { appUsers, appUserSessions } from "@/db/schema";
import { hashPassword, requireSuperAdminAccess, verifyPassword } from "@/lib/mecardee-auth";

export async function POST(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { currentPassword?: unknown; newPassword?: unknown };
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword) {
      return NextResponse.json({ ok: false, error: "Current password is required." }, { status: 400 });
    }
    if (newPassword.length < 4 || newPassword.length > 200) {
      return NextResponse.json({ ok: false, error: "New password must contain 4-200 characters." }, { status: 400 });
    }

    return withRequestDb(async (db) => db.transaction(async (tx) => {
      const [user] = await tx.select().from(appUsers).where(eq(appUsers.id, auth.user.id)).limit(1);
      if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
        return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 400 });
      }

      await tx.update(appUsers)
        .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
        .where(eq(appUsers.id, auth.user.id));
      await tx.delete(appUserSessions).where(eq(appUserSessions.userId, auth.user.id));

      return NextResponse.json({ ok: true, message: "Password changed successfully. All active sessions were signed out." });
    }));
  } catch (error) {
    console.error("Password change failed", error);
    return NextResponse.json({ ok: false, error: "Could not change password." }, { status: 500 });
  }
}
