import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { type TestContext } from "node:test";
import type { Client } from "pg";
import {
  decryptRefreshToken,
  encryptRefreshToken,
  exchangeAuthorizationCode,
  googleAuthorizationUrl,
  googleBackupSettingsUrl,
  googleDriveBackupEnabled,
  saveGoogleConnection,
} from "../lib/google-drive-backup";

function configureGoogle(t: TestContext) {
  const original = {
    enabled: process.env.GOOGLE_DRIVE_BACKUP_ENABLED,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    encryptionKey: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
  };

  process.env.GOOGLE_DRIVE_BACKUP_ENABLED = "true";
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "https://example.com/api/settings/backup/google/callback";
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  t.after(() => {
    if (original.enabled === undefined) delete process.env.GOOGLE_DRIVE_BACKUP_ENABLED; else process.env.GOOGLE_DRIVE_BACKUP_ENABLED = original.enabled;
    if (original.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = original.clientId;
    if (original.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = original.clientSecret;
    if (original.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI; else process.env.GOOGLE_REDIRECT_URI = original.redirectUri;
    if (original.encryptionKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY; else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = original.encryptionKey;
  });
}

test("Google OAuth requests offline drive.file access and tokens are encrypted", (t) => {
  configureGoogle(t);
  const authorization = new URL(googleAuthorizationUrl("state-value"));
  const scopes = authorization.searchParams.get("scope")?.split(" ") ?? [];
  assert.ok(scopes.includes("https://www.googleapis.com/auth/drive.file"));
  assert.ok(!scopes.includes("https://www.googleapis.com/auth/drive"));
  assert.equal(authorization.searchParams.get("access_type"), "offline");
  assert.equal(authorization.searchParams.get("state"), "state-value");

  const encrypted = encryptRefreshToken("refresh-token-value");
  assert.notEqual(encrypted, "refresh-token-value");
  assert.equal(decryptRefreshToken(encrypted), "refresh-token-value");
});

test("a missing enable flag does not block Google authorization", (t) => {
  configureGoogle(t);
  delete process.env.GOOGLE_DRIVE_BACKUP_ENABLED;
  assert.equal(googleDriveBackupEnabled(), true);
  assert.equal(new URL(googleAuthorizationUrl("state")).origin, "https://accounts.google.com");
  process.env.GOOGLE_DRIVE_BACKUP_ENABLED = "false";
  assert.equal(googleDriveBackupEnabled(), false);
  assert.throws(() => googleAuthorizationUrl("state"), /not enabled/);
});

test("missing OAuth setup is reported before redirecting the admin to Google", (t) => {
  configureGoogle(t);
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.throws(() => googleAuthorizationUrl("state"), /one-time setup in Railway.*GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET/);
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  assert.throws(() => googleAuthorizationUrl("state"), /GOOGLE_TOKEN_ENCRYPTION_KEY/);
});

test("success and failure return to Settings on the configured public app origin", (t) => {
  configureGoogle(t);
  const success = googleBackupSettingsUrl("http://internal:3000/api/settings/backup/google/callback", "connected");
  assert.equal(success.origin, "https://example.com");
  assert.equal(success.pathname, "/");
  assert.equal(success.searchParams.get("view"), "settings");
  assert.equal(success.searchParams.get("googleDrive"), "connected");
  const failure = googleBackupSettingsUrl("http://internal:3000/", "error", "Missing server configuration");
  assert.equal(failure.searchParams.get("view"), "settings");
  assert.equal(failure.searchParams.get("message"), "Missing server configuration");
});

test("authorization code exchange saves the selected account with an encrypted refresh token", async (t) => {
  configureGoogle(t);
  const calls: { url: string; method: string }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    if (url === "https://oauth2.googleapis.com/token") {
      const form = init?.body as URLSearchParams;
      assert.equal(form.get("code"), "google-authorization-code");
      assert.equal(form.get("redirect_uri"), process.env.GOOGLE_REDIRECT_URI);
      return Response.json({ access_token: "access-token", refresh_token: "refresh-token" });
    }
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
      return Response.json({ email: "selected-account@example.com", email_verified: true });
    }
    if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      return Response.json({ files: [{ id: "existing-folder", name: "Mecardee Backups" }] });
    }
    throw new Error(`Unexpected Google request: ${url}`);
  });
  const queries: { sql: string; values?: unknown[] }[] = [];
  const client = {
    async query(sql: string, values?: unknown[]) {
      queries.push({ sql, values });
      return { rows: [] };
    },
  } as unknown as Client;

  const tokens = await exchangeAuthorizationCode("google-authorization-code");
  const connection = await saveGoogleConnection(client, tokens.access_token, tokens.refresh_token!, "admin");
  assert.deepEqual(connection, { email: "selected-account@example.com", folderId: "existing-folder" });
  const saved = queries.find((query) => query.sql.includes("INSERT INTO google_backup_connections"));
  assert.equal(saved?.values?.[0], connection.email);
  assert.equal(decryptRefreshToken(String(saved?.values?.[1])), "refresh-token");
  assert.equal(queries.at(-1)?.sql, "COMMIT");
  assert.equal(calls.filter((call) => call.url.includes("drive/v3/files") && call.method === "POST").length, 0);
});

test("Connect stays clickable and both OAuth routes return the admin to Settings", async () => {
  const [page, connect, callback] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settings/backup/google/connect/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/settings/backup/google/callback/route.ts", import.meta.url), "utf8"),
  ]);
  const button = page.match(/<button[^>]*onClick=\{\(\) => window\.location\.assign\("\/api\/settings\/backup\/google\/connect"\)\} disabled=\{googleBackupBusy\}/);
  assert.ok(button, "Connect must navigate to OAuth without being disabled by the server flag");
  assert.doesNotMatch(page, /disabled=\{[^}]*googleBackup\?\.enabled/);
  assert.match(connect, /requireSuperAdminAccess/);
  assert.match(connect, /NextResponse\.redirect\(authorizationUrl\)/);
  assert.match(connect, /googleBackupSettingsUrl\(request\.url, "error"/);
  assert.match(callback, /state !== expectedState/);
  assert.match(callback, /saveGoogleConnection/);
  assert.match(callback, /settingsRedirect\(request, "connected"\)/);
});
