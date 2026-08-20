import "server-only";

import crypto from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { withRequestDb } from "@/db";
import { appUsers, appUserSessions } from "@/db/schema";

export type MecardeeRole = "superadmin" | "owner" | "viewer";
export type MecardeeSessionUser = {
  id: string;
  username: string;
  role: MecardeeRole;
};

const COOKIE_NAME = "mecardee_session_v1";
const SESSION_DAYS = 30;
const INITIAL_ADMIN_HASH = "scrypt$bef4fd0b040fae2c00a850b355c53b28$32ea620aed10ca98e788473c16706b5f6a0d05b2004e29ef4fd64abb595541ce0cbaf32696c5f7adbe2f03fff3255e473952522c2d9e2d167df5f6da5f790910";

let authSchemaPromise: Promise<void> | null = null;

function authSchemaStatements() {
  return [
    `CREATE TABLE IF NOT EXISTS app_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username varchar(80) NOT NULL,
      password_hash text NOT NULL,
      role varchar(24) NOT NULL DEFAULT 'viewer',
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT app_users_role_check CHECK (role IN ('superadmin', 'owner', 'viewer'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_unique ON app_users (lower(username))`,
    `CREATE INDEX IF NOT EXISTS app_users_role_idx ON app_users (role)`,
    `CREATE TABLE IF NOT EXISTS app_user_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS app_user_sessions_token_unique ON app_user_sessions (token_hash)`,
    `CREATE INDEX IF NOT EXISTS app_user_sessions_user_idx ON app_user_sessions (user_id)`,
    `CREATE INDEX IF NOT EXISTS app_user_sessions_expiry_idx ON app_user_sessions (expires_at)`,
  ];
}

export async function ensureAuthSchema() {
  if (authSchemaPromise) return authSchemaPromise;

  authSchemaPromise = (async () => {
    await withRequestDb(async (db) => {
      for (const statement of authSchemaStatements()) {
        await db.execute(sql.raw(statement));
      }

      await db.execute(sql`
        INSERT INTO app_users (username, password_hash, role, active)
        VALUES ('admin', ${INITIAL_ADMIN_HASH}, 'superadmin', true)
        ON CONFLICT ((lower(username))) DO NOTHING
      `);
    });
  })().catch((error) => {
    authSchemaPromise = null;
    throw error;
  });

  return authSchemaPromise;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${key}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, salt, expectedHex] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;

  try {
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function tokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function findUserByUsername(username: string) {
  await ensureAuthSchema();
  return withRequestDb(async (db) => {
    const [user] = await db
      .select()
      .from(appUsers)
      .where(sql`lower(${appUsers.username}) = ${username.trim().toLowerCase()}`)
      .limit(1);
    return user ?? null;
  });
}

export async function createSession(userId: string) {
  await ensureAuthSchema();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await withRequestDb(async (db) => {
    await db.delete(appUserSessions).where(sql`${appUserSessions.expiresAt} <= now()`);
    await db.insert(appUserSessions).values({
      userId,
      tokenHash: tokenHash(token),
      expiresAt,
    });
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  await ensureAuthSchema();
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await withRequestDb(async (db) => {
      await db.delete(appUserSessions).where(eq(appUserSessions.tokenHash, tokenHash(token)));
    });
  }

  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });
}

export async function getCurrentUser(): Promise<MecardeeSessionUser | null> {
  await ensureAuthSchema();
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  return withRequestDb(async (db) => {
    const rows = await db
      .select({
        id: appUsers.id,
        username: appUsers.username,
        role: appUsers.role,
      })
      .from(appUserSessions)
      .innerJoin(appUsers, eq(appUserSessions.userId, appUsers.id))
      .where(and(
        eq(appUserSessions.tokenHash, tokenHash(token)),
        gt(appUserSessions.expiresAt, new Date()),
        eq(appUsers.active, true),
      ))
      .limit(1);

    const user = rows[0];
    if (!user) return null;
    if (!["superadmin", "owner", "viewer"].includes(user.role)) return null;

    return {
      id: user.id,
      username: user.username,
      role: user.role as MecardeeRole,
    };
  });
}

type AccessResult =
  | { ok: true; user: MecardeeSessionUser }
  | { ok: false; response: NextResponse };

async function access(
  allowed: MecardeeRole[],
  forbiddenMessage: string,
): Promise<AccessResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 }),
      };
    }

    if (!allowed.includes(user.role)) {
      return {
        ok: false,
        response: NextResponse.json({ ok: false, error: forbiddenMessage }, { status: 403 }),
      };
    }

    return { ok: true, user };
  } catch (error) {
    console.error("Mecardee auth check failed", error);
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Authentication service is unavailable." }, { status: 503 }),
    };
  }
}

export function requireReadAccess() {
  return access(["superadmin", "owner", "viewer"], "You do not have permission to view this data.");
}

export function requireWriteAccess() {
  return access(["superadmin", "owner"], "Viewer access is read-only.");
}

export function requireSuperAdminAccess() {
  return access(["superadmin"], "Super Admin access is required.");
}
