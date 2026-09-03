import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withRequestClient } from "@/db";
import { exchangeAuthorizationCode, saveGoogleConnection } from "@/lib/google-drive-backup";
import { requireSuperAdminAccess } from "@/lib/mecardee-auth";
import { GOOGLE_BACKUP_STATE_COOKIE } from "../connect/route";

function settingsRedirect(request: Request, result: "connected" | "error", detail?: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("view", "settings");
  url.searchParams.set("googleDrive", result);
  if (detail) url.searchParams.set("message", detail.slice(0, 180));
  return NextResponse.redirect(url);
}
export async function GET(request: Request) {
  const auth = await requireSuperAdminAccess();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const store = await cookies();
  const expectedState = store.get(GOOGLE_BACKUP_STATE_COOKIE)?.value;
  store.delete(GOOGLE_BACKUP_STATE_COOKIE);

  try {
    const error = url.searchParams.get("error");
    if (error) return settingsRedirect(request, "error", error === "access_denied" ? "Google Drive connection was cancelled." : `Google authorization failed: ${error}`);
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    if (!expectedState || !state || state !== expectedState) return settingsRedirect(request, "error", "Google authorization state check failed. Please try connecting again.");
    if (!code) return settingsRedirect(request, "error", "Google did not return an authorization code.");

    const tokens = await exchangeAuthorizationCode(code);
    if (!tokens.access_token || !tokens.refresh_token) {
      return settingsRedirect(request, "error", "Google did not provide offline access. Reconnect and approve the requested access.");
    }
    await withRequestClient((client) => saveGoogleConnection(client, tokens.access_token, tokens.refresh_token!, auth.user.username));
    return settingsRedirect(request, "connected");
  } catch (error) {
    console.error("Could not complete Google Drive OAuth", error);
    return settingsRedirect(request, "error", error instanceof Error ? error.message : "Could not connect Google Drive.");
  }
}
