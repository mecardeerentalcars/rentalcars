import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, unzipSync, zipSync } from "fflate";
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
