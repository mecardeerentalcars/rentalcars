import { NextResponse } from "next/server";
import { clearSession } from "@/lib/mecardee-auth";

export async function POST() {
  try {
    await clearSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Logout failed", error);
    return NextResponse.json({ ok: false, error: "Could not log out." }, { status: 500 });
  }
}
