import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptRefreshToken,
  encryptRefreshToken,
  googleAuthorizationUrl,
} from "../lib/google-drive-backup";

test("Google OAuth requests offline drive.file access and tokens are encrypted", () => {
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

  try {
    const authorization = new URL(googleAuthorizationUrl("state-value"));
    const scopes = authorization.searchParams.get("scope")?.split(" ") ?? [];
    assert.ok(scopes.includes("https://www.googleapis.com/auth/drive.file"));
    assert.ok(!scopes.includes("https://www.googleapis.com/auth/drive"));
    assert.equal(authorization.searchParams.get("access_type"), "offline");
    assert.equal(authorization.searchParams.get("state"), "state-value");

    const encrypted = encryptRefreshToken("refresh-token-value");
    assert.notEqual(encrypted, "refresh-token-value");
    assert.equal(decryptRefreshToken(encrypted), "refresh-token-value");
  } finally {
    if (original.enabled === undefined) delete process.env.GOOGLE_DRIVE_BACKUP_ENABLED; else process.env.GOOGLE_DRIVE_BACKUP_ENABLED = original.enabled;
    if (original.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = original.clientId;
    if (original.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET; else process.env.GOOGLE_CLIENT_SECRET = original.clientSecret;
    if (original.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI; else process.env.GOOGLE_REDIRECT_URI = original.redirectUri;
    if (original.encryptionKey === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY; else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = original.encryptionKey;
  }
});
