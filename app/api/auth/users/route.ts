// MECARDEE_RENTAL_EXPENSES_PAYMENTS_HUB_V8_9_81
import { asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withRequestDb } from "@/db";
import { appUsers, appUserSessions } from "@/db/schema";
import { hashPassword, requireReadAccess, requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { userDeletionPolicy } from "@/lib/user-access";

export async function GET() {
  const auth = await requireReadAccess();
  if (!auth.ok) return auth.response;

  try {
    return withRequestDb(async (db) => {
      const rows = await db.select({ id: appUsers.id, username: appUsers.username, role: appUsers.role, active: appUsers.active }).from(appUsers).orderBy(asc(appUsers.username));
      const visibleRoles = auth.user.role === "superadmin" ? ["superadmin", "owner", "viewer"] : auth.user.role === "owner" ? ["superadmin", "owner"] : [];
      const users = rows.filter((row) => row.active && visibleRoles.includes(row.role)).map(({ id, username, role }) => ({ id, username, role }));
      return NextResponse.json({ ok: true, users });
    });
  } catch (error) {
    console.error("User list failed", error);
    return NextResponse.json({ ok: false, error: "Could not load users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { username?: unknown; password?: unknown; role?: unknown };
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const role = typeof body.role === "string" ? body.role : "";

    if (!/^[a-z0-9._-]{3,80}$/.test(username)) {
      return NextResponse.json({ ok: false, error: "Username must be 3-80 characters using letters, numbers, dot, dash or underscore." }, { status: 400 });
    }
    if (password.length < 4) {
      return NextResponse.json({ ok: false, error: "Password must contain at least 4 characters." }, { status: 400 });
    }
    if (!["owner", "viewer"].includes(role)) {
      return NextResponse.json({ ok: false, error: "Only Owner or Viewer users can be created here." }, { status: 400 });
    }

    return withRequestDb(async (db) => {
      const [existing] = await db.select({ id: appUsers.id }).from(appUsers)
        .where(sql`lower(${appUsers.username}) = ${username}`)
        .limit(1);

      if (existing) {
        return NextResponse.json({ ok: false, error: "That username already exists." }, { status: 409 });
      }

      const [created] = await db.insert(appUsers).values({
        username,
        passwordHash: hashPassword(password),
        role,
        active: true,
      }).returning({ id: appUsers.id, username: appUsers.username, role: appUsers.role });

      return NextResponse.json({ ok: true, user: created });
    });
  } catch (error) {
    console.error("User creation failed", error);
    return NextResponse.json({ ok: false, error: "Could not create user." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { userId?: unknown; newPassword?: unknown };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json({ ok: false, error: "Select a user whose password should be changed." }, { status: 400 });
    }
    if (newPassword.length < 4 || newPassword.length > 200) {
      return NextResponse.json({ ok: false, error: "Password must contain 4-200 characters." }, { status: 400 });
    }

    return withRequestDb(async (db) => db.transaction(async (tx) => {
      const [target] = await tx.select({ id: appUsers.id, username: appUsers.username })
        .from(appUsers)
        .where(eq(appUsers.id, userId))
        .limit(1);

      if (!target) {
        return NextResponse.json({ ok: false, error: "That user no longer exists." }, { status: 404 });
      }

      await tx.update(appUsers)
        .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
        .where(eq(appUsers.id, target.id));
      await tx.delete(appUserSessions).where(eq(appUserSessions.userId, target.id));

      return NextResponse.json({
        ok: true,
        message: `${target.username}'s password was changed. All active sessions for this user were signed out.`,
        user: target,
        currentUserSignedOut: target.id === auth.user.id,
      });
    }));
  } catch (error) {
    console.error("User password reset failed", error);
    return NextResponse.json({ ok: false, error: "Could not change the user password." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { userId?: unknown; confirmationUsername?: unknown };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const confirmationUsername = typeof body.confirmationUsername === "string" ? body.confirmationUsername.trim().toLowerCase() : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return NextResponse.json({ ok: false, error: "Select a user to delete." }, { status: 400 });
    }

    return withRequestDb(async (db) => {
      const [target] = await db.select({ id: appUsers.id, username: appUsers.username, role: appUsers.role })
        .from(appUsers)
        .where(eq(appUsers.id, userId))
        .limit(1);

      if (!target) {
        return NextResponse.json({ ok: false, error: "That user no longer exists." }, { status: 404 });
      }

      const policy = userDeletionPolicy(target, auth.user.id);
      if (!policy.allowed) {
        return NextResponse.json({ ok: false, error: policy.error }, { status: 403 });
      }
      if (confirmationUsername !== target.username.trim().toLowerCase()) {
        return NextResponse.json({ ok: false, error: `Type ${target.username} exactly to confirm deletion.` }, { status: 400 });
      }

      await db.delete(appUsers).where(eq(appUsers.id, target.id));
      return NextResponse.json({ ok: true, message: `${target.username} deleted successfully.`, user: target });
    });
  } catch (error) {
    console.error("User deletion failed", error);
    return NextResponse.json({ ok: false, error: "Could not delete user." }, { status: 500 });
  }
}
