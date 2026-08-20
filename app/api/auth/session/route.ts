import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/mecardee-auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, user: null }, { status: 401 });
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error("Session lookup failed", error);
    return NextResponse.json({ ok: false, user: null, error: "Could not restore session." }, { status: 500 });
  }
}
