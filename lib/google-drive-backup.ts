import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Client } from "pg";
import { ensureBackupSupportTables, generatePortableDatabaseBackup } from "@/lib/backup-service";
import { mecardeeBackupFileName } from "@/lib/database-backup";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const OIDC_SCOPES = ["openid", "email"];
const BACKUP_FOLDER_NAME = "Mecardee Backups";
const MANAGED_APP_PROPERTY_KEY = "mecardeeManaged";
const MANAGED_APP_PROPERTY_VALUE = "true";
const RETENTION_COUNT = 30;
const DRIVE_LOCK_ID = 6_412_030_907;
export const GOOGLE_BACKUP_STATE_COOKIE = "mecardee_google_backup_oauth_state";

type GoogleConnectionRow = {
  id: string;
  account_email: string;
  refresh_token_encrypted: string;
  folder_id: string;
  active: boolean;
  reconnect_required: boolean;
  connected_at: Date | string;
};

export type BackupTrigger = "Scheduled" | "Manual Drive";

export class GoogleBackupError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "GoogleBackupError";
  }
}

export class GoogleReconnectError extends GoogleBackupError {
  constructor() {
    super("Google Drive needs to be reconnected.", 409);
    this.name = "GoogleReconnectError";
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new GoogleBackupError(`${name} is not configured on the server.`, 503);
  return value;
}

export function googleDriveBackupEnabled() {
  // Optional opt-out; an unset flag must not block the normal Connect flow.
  return process.env.GOOGLE_DRIVE_BACKUP_ENABLED?.trim().toLowerCase() !== "false";
}

export function googleOAuthConfig() {
  if (!googleDriveBackupEnabled()) throw new GoogleBackupError("Google Drive backup is not enabled on this installation.", 503);
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_TOKEN_ENCRYPTION_KEY"]
    .filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new GoogleBackupError(`Google Drive needs one-time setup in Railway. Add: ${missing.join(", ")}.`, 503);
  }
  return {
    clientId: requiredEnvironment("GOOGLE_CLIENT_ID"),
    clientSecret: requiredEnvironment("GOOGLE_CLIENT_SECRET"),
    redirectUri: requiredEnvironment("GOOGLE_REDIRECT_URI"),
  };
}

export function googleBackupSettingsUrl(requestUrl: string, result: "connected" | "error", detail?: string) {
  // The registered callback supplies the public origin even behind a Railway proxy.
  let url = new URL("/", requestUrl);
  try {
    const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (configured) url = new URL("/", configured);
  } catch { /* Report invalid configuration on the requesting app's Settings page. */ }
  url.searchParams.set("view", "settings");
  url.searchParams.set("googleDrive", result);
  if (detail) url.searchParams.set("message", detail.slice(0, 500));
  return url;
}

function encryptionKey() {
  const configured = requiredEnvironment("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const base64 = Buffer.from(configured, "base64");
  if (base64.length === 32 && base64.toString("base64").replace(/=+$/, "") === configured.replace(/=+$/, "")) return base64;
  if (/^[a-f0-9]{64}$/i.test(configured)) return Buffer.from(configured, "hex");
  if (configured.length < 32) throw new GoogleBackupError("GOOGLE_TOKEN_ENCRYPTION_KEY must be a strong 32-byte base64/hex key or a passphrase of at least 32 characters.", 503);
  return createHash("sha256").update(configured).digest();
}

export function encryptRefreshToken(refreshToken: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptRefreshToken(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new GoogleReconnectError();
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new GoogleReconnectError();
  }
}

export function googleAuthorizationUrl(state: string) {
  const config = googleOAuthConfig();
  // Fail before sending the admin to Google if the returned token cannot be stored safely.
  encryptionKey();
  const parameters = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: [...OIDC_SCOPES, DRIVE_SCOPE].join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`;
}

async function googleJson<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  let parsed: unknown = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { /* handled below */ }
  if (!response.ok) {
    const googleError = parsed && typeof parsed === "object" && "error" in parsed && typeof (parsed as { error?: unknown }).error === "string"
      ? String((parsed as { error?: unknown }).error)
      : "";
    const message = parsed && typeof parsed === "object" && "error_description" in parsed
      ? String((parsed as { error_description?: unknown }).error_description)
      : parsed && typeof parsed === "object" && "error" in parsed
        ? typeof (parsed as { error?: unknown }).error === "string"
          ? String((parsed as { error?: unknown }).error)
          : JSON.stringify((parsed as { error?: unknown }).error)
        : body;
    const status = googleError === "invalid_grant" || response.status === 401 || response.status === 403 ? 409 : 502;
    throw new GoogleBackupError(`${fallback}${message ? `: ${message.slice(0, 300)}` : ""}`, status);
  }
  return parsed as T;
}

export async function exchangeAuthorizationCode(code: string) {
  const config = googleOAuthConfig();
  return googleJson<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string; id_token?: string }>(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    },
    "Google authorization could not be completed",
  );
}

export async function googleAccountEmail(accessToken: string) {
  const profile = await googleJson<{ email?: string; email_verified?: boolean }>(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Could not read the connected Google account",
  );
  if (!profile.email || profile.email_verified === false) throw new GoogleBackupError("Google did not return a verified account email.", 409);
  return profile.email;
}

function escapeDriveQuery(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

async function findOrCreateBackupFolder(accessToken: string) {
  const query = [
    `name = '${escapeDriveQuery(BACKUP_FOLDER_NAME)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `appProperties has { key='${MANAGED_APP_PROPERTY_KEY}' and value='${MANAGED_APP_PROPERTY_VALUE}' }`,
  ].join(" and ");
  const parameters = new URLSearchParams({ q: query, spaces: "drive", fields: "files(id,name)", pageSize: "10" });
  const listed = await googleJson<{ files?: { id: string; name: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?${parameters}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Could not find the Mecardee Backups folder",
  );
  if (listed.files?.[0]?.id) return listed.files[0].id;

  const created = await googleJson<{ id: string }>(
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: BACKUP_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
        appProperties: { [MANAGED_APP_PROPERTY_KEY]: MANAGED_APP_PROPERTY_VALUE },
      }),
    },
    "Could not create the Mecardee Backups folder",
  );
  return created.id;
}

export async function saveGoogleConnection(
  client: Client,
  accessToken: string,
  refreshToken: string,
  connectedBy: string,
) {
  await ensureBackupSupportTables(client);
  const [email, folderId] = await Promise.all([
    googleAccountEmail(accessToken),
    findOrCreateBackupFolder(accessToken),
  ]);
  const encryptedToken = encryptRefreshToken(refreshToken);
  await client.query("BEGIN");
  try {
    await client.query(`UPDATE google_backup_connections SET active = false, updated_at = now() WHERE active = true`);
    await client.query(`
      INSERT INTO google_backup_connections
        (account_email, refresh_token_encrypted, folder_id, active, reconnect_required, connected_by)
      VALUES ($1, $2, $3, true, false, $4)`, [email, encryptedToken, folderId, connectedBy]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return { email, folderId };
}

async function activeConnection(client: Client) {
  await ensureBackupSupportTables(client);
  const result = await client.query<GoogleConnectionRow>(`
    SELECT id, account_email, refresh_token_encrypted, folder_id, active, reconnect_required, connected_at
      FROM google_backup_connections
     WHERE active = true
     ORDER BY connected_at DESC
     LIMIT 1`);
  if (!result.rows[0]) throw new GoogleBackupError("Connect Google Drive before creating a Drive backup.", 409);
  if (result.rows[0].reconnect_required) throw new GoogleReconnectError();
  return result.rows[0];
}

async function accessTokenFromConnection(client: Client, connection: GoogleConnectionRow) {
  const config = googleOAuthConfig();
  const refreshToken = decryptRefreshToken(connection.refresh_token_encrypted);
  try {
    const token = await googleJson<{ access_token?: string }>(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      },
      "Could not refresh Google Drive access",
    );
    if (!token.access_token) throw new GoogleReconnectError();
    return token.access_token;
  } catch (error) {
    if (!(error instanceof GoogleBackupError) || error.status !== 409) throw error;
    await client.query(`
      UPDATE google_backup_connections
         SET active = false, reconnect_required = true, refresh_token_encrypted = 'RECONNECT_REQUIRED', updated_at = now()
       WHERE id = $1::uuid`, [connection.id]);
    throw new GoogleReconnectError();
  }
}

async function uploadBackup(accessToken: string, folderId: string, filename: string, bytes: Uint8Array) {
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: "application/zip",
    appProperties: {
      [MANAGED_APP_PROPERTY_KEY]: MANAGED_APP_PROPERTY_VALUE,
      mecardeeBackupVersion: "1",
    },
  };
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,parents,appProperties", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "application/zip",
      "X-Upload-Content-Length": String(bytes.byteLength),
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) throw new GoogleBackupError(`Google Drive upload could not start (${start.status}).`, start.status === 401 || start.status === 403 ? 409 : 502);
  const uploadUrl = start.headers.get("location");
  if (!uploadUrl) throw new GoogleBackupError("Google Drive did not return a resumable upload URL.", 502);
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const uploaded = await googleJson<{ id: string; name: string; size?: string }>(
    uploadUrl,
    { method: "PUT", headers: { "Content-Type": "application/zip", "Content-Length": String(bytes.byteLength) }, body },
    "Google Drive backup upload failed",
  );
  const verified = await googleJson<{ id: string; name: string; size?: string; parents?: string[]; appProperties?: Record<string, string> }>(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}?fields=id,name,size,parents,appProperties`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Google Drive backup verification failed",
  );
  if (verified.name !== filename || Number(verified.size ?? -1) !== bytes.byteLength || !verified.parents?.includes(folderId) || verified.appProperties?.[MANAGED_APP_PROPERTY_KEY] !== MANAGED_APP_PROPERTY_VALUE) {
    throw new GoogleBackupError("Google Drive uploaded the file but verification did not match the generated backup.", 502);
  }
  return verified;
}

async function enforceRetention(accessToken: string, folderId: string) {
  const query = [
    `'${escapeDriveQuery(folderId)}' in parents`,
    "trashed = false",
    `appProperties has { key='${MANAGED_APP_PROPERTY_KEY}' and value='${MANAGED_APP_PROPERTY_VALUE}' }`,
  ].join(" and ");
  const parameters = new URLSearchParams({
    q: query,
    spaces: "drive",
    orderBy: "createdTime desc",
    pageSize: "1000",
    fields: "files(id,name,createdTime,appProperties)",
  });
  const listed = await googleJson<{ files?: { id: string; name: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?${parameters}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Could not check Google Drive backup retention",
  );
  const managedBackups = (listed.files ?? []).filter((file) => /^mecardee-backup-\d{4}-\d{2}-\d{2}-\d{4}\.zip$/.test(file.name));
  for (const file of managedBackups.slice(RETENTION_COUNT)) {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new GoogleBackupError(`Could not remove expired managed backup ${file.name} (${response.status}).`, 502);
  }
  return Math.max(0, managedBackups.length - RETENTION_COUNT);
}

export async function runGoogleDriveBackup(client: Client, trigger: BackupTrigger, createdBy: string) {
  await ensureBackupSupportTables(client);
  const lock = await client.query<{ acquired: boolean }>(`SELECT pg_try_advisory_lock($1) AS acquired`, [DRIVE_LOCK_ID]);
  if (!lock.rows[0]?.acquired) throw new GoogleBackupError("Another Google Drive backup is already running.", 409);
  const createdAt = new Date();
  const fallbackFilename = mecardeeBackupFileName(createdAt);
  let historyId: string | null = null;
  try {
    const inserted = await client.query<{ id: string }>(`
      INSERT INTO backup_history (trigger_type, destination, status, filename, created_by)
      VALUES ($1, 'Google Drive', 'Running', $2, $3)
      RETURNING id`, [trigger, fallbackFilename, createdBy]);
    historyId = inserted.rows[0].id;
    const connection = await activeConnection(client);
    const generated = await generatePortableDatabaseBackup(client, createdBy, createdAt);
    const accessToken = await accessTokenFromConnection(client, connection);
    const uploaded = await uploadBackup(accessToken, connection.folder_id, generated.filename, generated.bytes);
    let cleanupWarning: string | null = null;
    try {
      await enforceRetention(accessToken, connection.folder_id);
    } catch (cleanupError) {
      cleanupWarning = cleanupError instanceof Error ? cleanupError.message.slice(0, 1_000) : "Google Drive retention cleanup failed.";
    }
    await client.query(`
      UPDATE backup_history
         SET status = 'Successful', filename = $2, file_size = $3, google_drive_file_id = $4,
             cleanup_warning = $5, completed_at = now()
       WHERE id = $1::uuid`, [historyId, generated.filename, generated.bytes.byteLength, uploaded.id, cleanupWarning]);
    return { filename: generated.filename, fileSize: generated.bytes.byteLength, driveFileId: uploaded.id, cleanupWarning };
  } catch (error) {
    if (historyId) {
      await client.query(`
        UPDATE backup_history
           SET status = 'Failed', error_message = $2, completed_at = now()
         WHERE id = $1::uuid`, [historyId, error instanceof Error ? error.message.slice(0, 1_000) : "Unknown backup error"]);
    }
    throw error;
  } finally {
    await client.query(`SELECT pg_advisory_unlock($1)`, [DRIVE_LOCK_ID]).catch(() => undefined);
  }
}

export async function googleBackupStatus(client: Client) {
  await ensureBackupSupportTables(client);
  const [connectionResult, historyResult] = await Promise.all([
    client.query<GoogleConnectionRow>(`
      SELECT id, account_email, refresh_token_encrypted, folder_id, active, reconnect_required, connected_at
        FROM google_backup_connections
       ORDER BY active DESC, connected_at DESC
       LIMIT 1`),
    client.query<{
      id: string; created_at: Date | string; trigger_type: string; destination: string; status: string; filename: string;
      file_size: number | null; google_drive_file_id: string | null; error_message: string | null; cleanup_warning: string | null;
    }>(`
      SELECT id, created_at, trigger_type, destination, status, filename, file_size,
             google_drive_file_id, error_message, cleanup_warning
        FROM backup_history
       ORDER BY created_at DESC
       LIMIT 20`),
  ]);
  const connection = connectionResult.rows[0];
  return {
    enabled: googleDriveBackupEnabled(),
    connected: Boolean(connection?.active && !connection.reconnect_required),
    reconnectRequired: Boolean(connection?.reconnect_required),
    email: connection?.account_email ?? null,
    folderName: connection ? BACKUP_FOLDER_NAME : null,
    schedule: "Every day at 7:00 PM",
    timezone: "Asia/Kolkata",
    history: historyResult.rows.map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      triggerType: row.trigger_type,
      destination: row.destination,
      status: row.status,
      filename: row.filename,
      fileSize: row.file_size,
      googleDriveFileId: row.google_drive_file_id,
      errorMessage: row.error_message,
      cleanupWarning: row.cleanup_warning,
    })),
  };
}

export async function disconnectGoogleDrive(client: Client) {
  const connection = await activeConnection(client);
  const refreshToken = decryptRefreshToken(connection.refresh_token_encrypted);
  let revokeWarning: string | null = null;
  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
    if (!response.ok) revokeWarning = `Google token revocation returned ${response.status}.`;
  } catch {
    revokeWarning = "Google token revocation could not be confirmed.";
  }
  await client.query(`DELETE FROM google_backup_connections WHERE id = $1::uuid`, [connection.id]);
  return { email: connection.account_email, revokeWarning };
}
