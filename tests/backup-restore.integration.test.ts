import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { strFromU8 } from "fflate";
import pg from "pg";
import { generatePortableDatabaseBackup } from "../lib/backup-service";
import { inspectDatabaseBackupZip } from "../lib/database-backup";

// Opt-in only: use a disposable local PostgreSQL cluster owned by backup_audit.
// This test deliberately never reads DATABASE_URL or connects to Railway.
const port = process.env.MECARDEE_BACKUP_TEST_PORT;

test("generated backup restores schema, data, and enforced foreign keys into an empty PostgreSQL database", {
  skip: !port && "Set MECARDEE_BACKUP_TEST_PORT to a disposable local PostgreSQL port",
}, async (t) => {
  assert.match(port!, /^\d+$/);
  assert.ok(Number(port) > 0 && Number(port) <= 65535);
  const originalTimezone = process.env.TZ;
  process.env.TZ = "Asia/Kolkata";
  t.after(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });
  const config = { host: "127.0.0.1", port: Number(port), user: "backup_audit", password: "", connectionTimeoutMillis: 5000 };
  const admin = new pg.Client({ ...config, database: "postgres" });
  const suffix = randomUUID().replaceAll("-", "");
  const sourceName = `backup_source_${suffix}`;
  const targetName = `backup_target_${suffix}`;
  const clients: pg.Client[] = [];
  const databases: string[] = [];
  await admin.connect();
  t.after(async () => {
    try {
      await Promise.all(clients.map((client) => client.end()));
      for (const name of databases) await admin.query(`DROP DATABASE "${name}"`);
    } finally {
      await admin.end();
    }
  });
  for (const name of [sourceName, targetName]) {
    await admin.query(`CREATE DATABASE "${name}"`);
    databases.push(name);
  }
  const source = new pg.Client({ ...config, database: sourceName });
  const target = new pg.Client({ ...config, database: targetName });
  clients.push(source, target);
  await Promise.all([source.connect(), target.connect()]);
  await source.query(`
    CREATE TABLE z_parents (
      id integer PRIMARY KEY,
      code text NOT NULL,
      external_id text UNIQUE
    );
    CREATE UNIQUE INDEX parent_code_unique ON z_parents(code);
    CREATE TABLE a_children (
      id integer PRIMARY KEY,
      parent_id integer NOT NULL REFERENCES z_parents(id),
      parent_code text NOT NULL REFERENCES z_parents(code),
      parent_external_id text REFERENCES z_parents(external_id),
      amount numeric(12, 2) NOT NULL CHECK (amount > 0),
      expense_date date NOT NULL
    );
    CREATE INDEX child_parent_idx ON a_children(parent_id);
    CREATE TABLE app_users (id integer PRIMARY KEY, username text NOT NULL, password_hash text NOT NULL);
    CREATE TABLE app_user_sessions (id integer PRIMARY KEY, user_id integer NOT NULL REFERENCES app_users(id), token text NOT NULL);
    INSERT INTO z_parents VALUES (1, 'parent-code', 'external-code');
    INSERT INTO a_children VALUES (2, 1, 'parent-code', 'external-code', 125.50, '2026-09-04');
    INSERT INTO app_users VALUES (3, 'backup-test-user', 'test-only-placeholder');
    INSERT INTO app_user_sessions VALUES (4, 3, 'test-only-session');
  `);

  const generated = await generatePortableDatabaseBackup(source, "test-admin");
  const backup = inspectDatabaseBackupZip(generated.bytes);
  assert.equal(JSON.parse(strFromU8(backup.files["database/a-children.json"])).rows[0].expense_date, "2026-09-04");
  await target.query(strFromU8(backup.files["schema.sql"]));
  await target.query(strFromU8(backup.files["database.sql"]));

  for (const name of ["a_children", "z_parents"]) {
    assert.deepEqual((await target.query(`SELECT * FROM "${name}" ORDER BY id`)).rows,
      (await source.query(`SELECT * FROM "${name}" ORDER BY id`)).rows);
  }
  const constraintsSql = `SELECT c.relname, con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
    FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND con.contype <> 'n'
    ORDER BY c.relname, con.conname`;
  assert.deepEqual((await target.query(constraintsSql)).rows, (await source.query(constraintsSql)).rows);
  const indexesSql = "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname";
  assert.deepEqual((await target.query(indexesSql)).rows, (await source.query(indexesSql)).rows);
  await assert.rejects(target.query("INSERT INTO a_children VALUES (5, 999, 'parent-code', 'external-code', 10, '2026-09-04')"), { code: "23503" });
  await assert.rejects(target.query("INSERT INTO a_children VALUES (5, 1, 'missing-code', 'external-code', 10, '2026-09-04')"), { code: "23503" });
  await assert.rejects(target.query("INSERT INTO z_parents VALUES (6, 'parent-code', 'another-code')"), { code: "23505" });

  // The user's existing credential exclusions remain unchanged.
  assert.ok(backup.info.excludedTables.includes("app_user_sessions"));
  assert.equal(backup.files["database/app-user-sessions.json"], undefined);
  const users = JSON.parse(strFromU8(backup.files["database/users.json"]));
  assert.equal(users.rows.length, 1);
  assert.equal(users.rows[0].password_hash, undefined);
  assert.deepEqual(users.excludedColumns, ["password_hash"]);
  assert.equal((await target.query("SELECT * FROM app_users")).rowCount, 0);
});
