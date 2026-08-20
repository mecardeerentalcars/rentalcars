import { NextResponse } from "next/server";
import { createSession, findUserByUsername, verifyPassword } from "@/lib/mecardee-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "Username and password are required." }, { status: 400 });
    }

    const user = await findUserByUsername(username);
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Incorrect username or password." }, { status: 401 });
    }

    if (!["superadmin", "owner", "viewer"].includes(user.role)) {
      return NextResponse.json({ ok: false, error: "This user role is not valid." }, { status: 403 });
    }

    await createSession(user.id);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ ok: false, error: "Could not sign in." }, { status: 500 });
  }
}
