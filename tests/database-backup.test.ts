import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { Client } from "pg";
import { generatePortableDatabaseBackup } from "../lib/backup-service";
import {
  BackupValidationError,
  createDatabaseBackupZip,
  inspectDatabaseBackupZip,
  mecardeeBackupFileName,
  type PortableDatabaseBackup,
} from "../lib/database-backup";

const exampleBackup: PortableDatabaseBackup = {
  createdAt: "2026-09-03T05:33:00.000Z",
  createdBy: "admin",
  databaseType: "PostgreSQL source with provider-neutral JSON export",
  appVersion: "0.1.0",
  excludedTables: ["app_user_sessions"],
  securityNotes: ["Active login sessions and credential columns are excluded."],
  schemaSql: "CREATE TABLE vehicles (id uuid PRIMARY KEY, name text NOT NULL);",
  databaseSql: "INSERT INTO vehicles (id, name) VALUES ('vehicle-1', 'Swift');",
  tables: [
    {
      name: "vehicles",
      columns: [
        { name: "id", sqlType: "uuid", nullable: false, defaultExpression: null },
        { name: "name", sqlType: "text", nullable: false, defaultExpression: null },
        { name: "is_guest", sqlType: "boolean", nullable: false, defaultExpression: "false" },
      ],
      rows: [
        { id: "vehicle-1", name: "Swift", is_guest: false },
        { id: "vehicle-2", name: "Guest Brezza", is_guest: true },
      ],
    },
    {
      name: "customers",
      columns: [
        { name: "id", sqlType: "uuid", nullable: false, defaultExpression: null },
        { name: "name", sqlType: "text", nullable: false, defaultExpression: null },
      ],
      rows: [{ id: "customer-1", name: "Thomas" }],
    },
  ],
};

test("Google Drive backup ZIP contains portable SQL, metadata, and per-table JSON", () => {
  const zip = createDatabaseBackupZip(exampleBackup);
  const inspected = inspectDatabaseBackupZip(zip);
  const names = Object.keys(inspected.files);

  assert.equal(inspected.info.application, "Mecardee Rental Cars");
  assert.equal(inspected.info.timezone, "Asia/Kolkata");
  assert.equal(inspected.info.totalRows, 3);
  assert.ok(names.includes("backup-info.json"));
  assert.ok(names.includes("manifest.json"));
  assert.ok(names.includes("schema.sql"));
  assert.ok(names.includes("database.sql"));
  assert.ok(names.includes("README-RESTORE.txt"));
  assert.ok(names.includes("database/vehicles.json"));
  assert.ok(names.includes("database/guest-cars.json"));
  assert.ok(names.includes("database/customers.json"));
});

test("backup filenames use Asia/Kolkata date and HHMM", () => {
  assert.equal(mecardeeBackupFileName(exampleBackup.createdAt), "mecardee-backup-2026-09-03-1103.zip");
});

test("modified backup content fails the manifest integrity check", () => {
  const files = unzipSync(createDatabaseBackupZip(exampleBackup));
  files["database/customers.json"] = strToU8(JSON.stringify({ rows: [] }));
  assert.throws(() => inspectDatabaseBackupZip(zipSync(files)), BackupValidationError);
});

test("backup schema creates all keys and standalone unique indexes before foreign keys", async () => {
  const tableNames = ["a_children", "z_parents"];
  const constraints = [
    { table_name: "a_children", constraint_name: "child_parent_fk", constraint_type: "f", definition: "FOREIGN KEY (parent_id) REFERENCES z_parents(id)" },
    { table_name: "a_children", constraint_name: "child_code_fk", constraint_type: "f", definition: "FOREIGN KEY (code) REFERENCES z_parents(code)" },
    { table_name: "a_children", constraint_name: "child_pkey", constraint_type: "p", definition: "PRIMARY KEY (id)" },
    { table_name: "z_parents", constraint_name: "parent_pkey", constraint_type: "p", definition: "PRIMARY KEY (id)" },
    { table_name: "z_parents", constraint_name: "parent_external_unique", constraint_type: "u", definition: "UNIQUE (external_id)" },
    { table_name: "z_parents", constraint_name: "parent_self_fk", constraint_type: "f", definition: "FOREIGN KEY (parent_id) REFERENCES z_parents(id)" },
    { table_name: "z_parents", constraint_name: "parent_child_fk", constraint_type: "f", definition: "FOREIGN KEY (child_id) REFERENCES a_children(id)" },
  ];
  const client = {
    async query(sql: string) {
      let rows: unknown[] = [];
      if (sql.includes("information_schema.tables")) {
        rows = tableNames.map((table_name) => ({ table_name }));
      } else if (sql.includes("pg_catalog.pg_attribute")) {
        rows = tableNames.flatMap((table_name) => ["id", "parent_id", "child_id", "code", "external_id"].map((column_name, ordinal_position) => ({
          table_name, column_name, ordinal_position, sql_type: "text", is_nullable: column_name !== "id", default_expression: null,
        })));
      } else if (sql.includes("pg_get_constraintdef")) {
        assert.match(sql, /con\.contype <> 'n'/, "NOT NULL is already exported in CREATE TABLE");
        rows = constraints;
      } else if (sql.includes("FROM pg_indexes")) {
        assert.match(sql, /c\.conindid =/, "Exclude constraint-backed indexes by identity, not shared names");
        assert.match(sql, /c\.contype IN \('p', 'u', 'x'\)/, "Do not exclude indexes referenced by foreign keys");
        rows = [{ tablename: "z_parents", indexname: "parent_code_unique", indexdef: "CREATE UNIQUE INDEX parent_code_unique ON public.z_parents USING btree (code)" }];
      } else if (sql.includes("con.contype = 'f'")) {
        rows = [{ child_table: "a_children", parent_table: "z_parents" }];
      } else if (!/^\s*(CREATE|SELECT .* FROM "(?:a_children|z_parents)")/.test(sql)) {
        throw new Error(`Unexpected backup query: ${sql}`);
      }
      return { rows, rowCount: rows.length };
    },
  } as unknown as Client;

  const generated = await generatePortableDatabaseBackup(client, "test-admin");
  const inspected = inspectDatabaseBackupZip(generated.bytes);
  const schema = strFromU8(inspected.files["schema.sql"]);
  const statements = schema.split("\n");
  const firstForeignKey = statements.findIndex((line) => line.includes("FOREIGN KEY"));
  assert.ok(firstForeignKey > 0);
  for (const constraint of constraints) {
    const position = statements.findIndex((line) => line.includes(`ADD CONSTRAINT "${constraint.constraint_name}"`));
    assert.ok(position >= 0, `${constraint.constraint_name} must not be dropped`);
    if (constraint.constraint_type !== "f") assert.ok(position < firstForeignKey);
  }
  for (const name of tableNames) {
    assert.ok(statements.findIndex((line) => line.includes(`CREATE TABLE IF NOT EXISTS "${name}"`)) < firstForeignKey);
  }
  const uniqueIndex = statements.findIndex((line) => line.startsWith("CREATE UNIQUE INDEX IF NOT EXISTS parent_code_unique"));
  assert.ok(uniqueIndex >= 0 && uniqueIndex < firstForeignKey);
  assert.match(schema, /"id" text NOT NULL/);
});

test("backup exports SQL dates without timezone conversion", async () => {
  const client = {
    async query(sql: string) {
      let rows: unknown[] = [];
      if (sql.includes("information_schema.tables")) {
        rows = [{ table_name: "expenses" }];
      } else if (sql.includes("pg_catalog.pg_attribute")) {
        rows = [{ table_name: "expenses", column_name: "expense_date", sql_type: "date", is_nullable: false, default_expression: null, ordinal_position: 1 }];
      } else if (sql.includes('FROM "expenses"')) {
        assert.match(sql, /SELECT "expense_date"::text AS "expense_date"/);
        rows = [{ expense_date: "2026-09-04" }];
      }
      return { rows, rowCount: rows.length };
    },
  } as unknown as Client;
  const generated = await generatePortableDatabaseBackup(client, "test-admin");
  const backup = inspectDatabaseBackupZip(generated.bytes);
  assert.equal(JSON.parse(strFromU8(backup.files["database/expenses.json"])).rows[0].expense_date, "2026-09-04");
  assert.match(strFromU8(backup.files["database.sql"]), /\('2026-09-04'\)/);
});
