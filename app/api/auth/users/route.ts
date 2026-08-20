import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withRequestDb } from "@/db";
import { appUsers } from "@/db/schema";
import { hashPassword, requireSuperAdminAccess } from "@/lib/mecardee-auth";

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
