import type { Client } from "pg";
import {
  createDatabaseBackupZip,
  mecardeeBackupFileName,
  type BackupColumn,
  type BackupTable,
  type PortableDatabaseBackup,
} from "@/lib/database-backup";

const EXCLUDED_DATA_TABLES = new Set(["app_user_sessions"]);
const SENSITIVE_COLUMN = /(password|secret|token|api[_-]?key|connection[_-]?(url|string)|credential)/i;

type ColumnRow = {
  table_name: string;
  column_name: string;
  sql_type: string;
  is_nullable: boolean;
  default_expression: string | null;
  ordinal_position: number;
};

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlLiteral(value: unknown, sqlType: string) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (value instanceof Uint8Array) return `'\\x${Buffer.from(value).toString("hex")}'`;
  if (typeof value === "object") {
    const json = JSON.stringify(value).replaceAll("'", "''");
    return sqlType === "json" || sqlType === "jsonb" ? `'${json}'::${sqlType}` : `'${json}'`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

async function ensureBackupSupportTables(client: Client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS backup_history (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,
      trigger_type varchar(32) NOT NULL,
      destination varchar(32) NOT NULL,
      status varchar(24) NOT NULL,
      filename varchar(220) NOT NULL,
      file_size integer,
      google_drive_file_id varchar(180),
      error_message text,
      cleanup_warning text,
      created_by varchar(120) NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS backup_history_created_at_idx ON backup_history(created_at DESC)`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS google_backup_connections (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      account_email varchar(320) NOT NULL,
      refresh_token_encrypted text NOT NULL,
      folder_id varchar(180) NOT NULL,
      active boolean NOT NULL DEFAULT true,
      reconnect_required boolean NOT NULL DEFAULT false,
      connected_by varchar(120) NOT NULL,
      connected_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS google_backup_connections_active_idx ON google_backup_connections(active)`);
}

async function applicationTables(client: Client) {
  const result = await client.query<{ table_name: string }>(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);
  return result.rows.map((row) => row.table_name).filter((name) => /^[a-z][a-z0-9_]*$/.test(name));
}

async function columnsForTables(client: Client, tableNames: string[]) {
  const result = await client.query<ColumnRow>(`
    SELECT c.relname AS table_name,
           a.attname AS column_name,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS sql_type,
           NOT a.attnotnull AS is_nullable,
           pg_get_expr(ad.adbin, ad.adrelid) AS default_expression,
           a.attnum AS ordinal_position
      FROM pg_catalog.pg_attribute a
      JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND a.attnum > 0
       AND NOT a.attisdropped
       AND c.relname = ANY($1::text[])
     ORDER BY c.relname, a.attnum`, [tableNames]);
  return result.rows;
}

function backupColumns(rows: ColumnRow[]): BackupColumn[] {
  return rows.map((column) => ({
    name: column.column_name,
    sqlType: column.sql_type,
    nullable: column.is_nullable,
    defaultExpression: column.default_expression,
  }));
}

async function schemaSql(client: Client, tableNames: string[], allColumns: ColumnRow[]) {
  const constraints = await client.query<{ table_name: string; constraint_name: string; definition: string }>(`
    SELECT c.relname AS table_name, con.conname AS constraint_name, pg_get_constraintdef(con.oid, true) AS definition
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])
     ORDER BY c.relname, con.conname`, [tableNames]);
  const indexes = await client.query<{ tablename: string; indexname: string; indexdef: string }>(`
    SELECT i.tablename, i.indexname, i.indexdef
      FROM pg_indexes i
     WHERE i.schemaname = 'public'
       AND i.tablename = ANY($1::text[])
       AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conname = i.indexname)
     ORDER BY i.tablename, i.indexname`, [tableNames]);

  const lines = [
    "-- Mecardee PostgreSQL-compatible schema",
    "-- Portable JSON files in database/ remain the provider-neutral source of truth.",
    "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
    "",
  ];
  for (const tableName of tableNames) {
    const columns = allColumns.filter((column) => column.table_name === tableName);
    lines.push(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (`);
    lines.push(columns.map((column) => {
      const defaultSql = column.default_expression ? ` DEFAULT ${column.default_expression}` : "";
      const nullableSql = column.is_nullable ? "" : " NOT NULL";
      return `  ${quoteIdentifier(column.column_name)} ${column.sql_type}${defaultSql}${nullableSql}`;
    }).join(",\n"));
    lines.push(");", "");
  }
  for (const constraint of constraints.rows) {
    lines.push(`ALTER TABLE ${quoteIdentifier(constraint.table_name)} ADD CONSTRAINT ${quoteIdentifier(constraint.constraint_name)} ${constraint.definition};`);
  }
  if (constraints.rowCount) lines.push("");
  for (const index of indexes.rows) lines.push(`${index.indexdef.replace(/^CREATE INDEX /, "CREATE INDEX IF NOT EXISTS ")};`);
  lines.push("");
  return lines.join("\n");
}

async function dependencyOrder(client: Client, tableNames: string[]) {
  const result = await client.query<{ child_table: string; parent_table: string }>(`
    SELECT child.relname AS child_table, parent.relname AS parent_table
      FROM pg_constraint con
      JOIN pg_class child ON child.oid = con.conrelid
      JOIN pg_class parent ON parent.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = child.relnamespace
     WHERE con.contype = 'f' AND n.nspname = 'public'
       AND child.relname = ANY($1::text[]) AND parent.relname = ANY($1::text[])`, [tableNames]);
  const remaining = new Set(tableNames);
  const ordered: string[] = [];
  while (remaining.size) {
    const ready = [...remaining].filter((table) => !result.rows.some((edge) => edge.child_table === table && remaining.has(edge.parent_table))).sort();
    if (!ready.length) {
      ordered.push(...[...remaining].sort());
      break;
    }
    for (const table of ready) {
      ordered.push(table);
      remaining.delete(table);
    }
  }
  return ordered;
}

async function databaseSql(client: Client, tables: BackupTable[]) {
  const orderedNames = await dependencyOrder(client, tables.map((table) => table.name));
  const byName = new Map(tables.map((table) => [table.name, table]));
  const lines = [
    "-- Mecardee PostgreSQL-compatible data backup",
    "-- Generated from the same live records as the portable database/*.json files.",
    "BEGIN;",
    "",
  ];
  for (const tableName of orderedNames) {
    const table = byName.get(tableName);
    if (!table || !table.rows.length) continue;
    if (table.excludedColumns?.length) {
      lines.push(`-- ${tableName}: data insert omitted because sensitive credential columns were excluded.`, "");
      continue;
    }
    const columns = table.columns.map((column) => column.name);
    const typeByColumn = new Map(table.columns.map((column) => [column.name, column.sqlType]));
    for (let start = 0; start < table.rows.length; start += 100) {
      const batch = table.rows.slice(start, start + 100);
      const valueRows = batch.map((row) => `(${columns.map((column) => sqlLiteral(row[column], typeByColumn.get(column) ?? "text")).join(", ")})`);
      lines.push(`INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) VALUES`, `${valueRows.join(",\n")}\nON CONFLICT DO NOTHING;`, "");
    }
  }
  lines.push("COMMIT;", "");
  return lines.join("\n");
}

export type GeneratedBackup = {
  bytes: Uint8Array;
  filename: string;
  createdAt: string;
  tableCount: number;
  rowCounts: Record<string, number>;
};

export async function generatePortableDatabaseBackup(client: Client, createdBy: string, createdAt = new Date()): Promise<GeneratedBackup> {
  await ensureBackupSupportTables(client);
  const tableNames = await applicationTables(client);
  const allColumns = await columnsForTables(client, tableNames);
  const exportedTables: BackupTable[] = [];
  const excludedTables: string[] = [];

  for (const tableName of tableNames) {
    if (EXCLUDED_DATA_TABLES.has(tableName)) {
      excludedTables.push(tableName);
      continue;
    }
    const columns = allColumns.filter((column) => column.table_name === tableName);
    const excludedColumns = columns.filter((column) => SENSITIVE_COLUMN.test(column.column_name)).map((column) => column.column_name);
    const safeColumns = columns.filter((column) => !excludedColumns.includes(column.column_name));
    if (!safeColumns.length) {
      excludedTables.push(tableName);
      continue;
    }
    const orderColumn = safeColumns.some((column) => column.column_name === "id") ? "id" : safeColumns[0].column_name;
    const result = await client.query<Record<string, unknown>>(
      `SELECT ${safeColumns.map((column) => quoteIdentifier(column.column_name)).join(", ")} FROM ${quoteIdentifier(tableName)} ORDER BY ${quoteIdentifier(orderColumn)}`,
    );
    exportedTables.push({
      name: tableName,
      columns: backupColumns(safeColumns),
      rows: result.rows,
      excludedColumns: excludedColumns.length ? excludedColumns : undefined,
    });
  }

  const createdAtIso = createdAt.toISOString();
  const portable: PortableDatabaseBackup = {
    createdAt: createdAtIso,
    createdBy,
    databaseType: "PostgreSQL source with provider-neutral JSON export",
    appVersion: process.env.APP_VERSION ?? process.env.npm_package_version ?? "0.1.0",
    tables: exportedTables,
    schemaSql: await schemaSql(client, tableNames, allColumns),
    databaseSql: await databaseSql(client, exportedTables),
    excludedTables,
    securityNotes: [
      "Active login sessions are excluded.",
      "Password hashes, OAuth tokens, API keys, connection URLs, and similarly named credential columns are excluded.",
      "Google Drive connection identity may be present, but its refresh token is never exported.",
    ],
  };
  const bytes = createDatabaseBackupZip(portable);
  return {
    bytes,
    filename: mecardeeBackupFileName(createdAt),
    createdAt: createdAtIso,
    tableCount: exportedTables.length,
    rowCounts: Object.fromEntries(exportedTables.map((table) => [table.name, table.rows.length])),
  };
}

export { ensureBackupSupportTables };
