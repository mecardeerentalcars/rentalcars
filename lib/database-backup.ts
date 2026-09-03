import { createHash } from "node:crypto";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export const DATABASE_BACKUP_FORMAT = "mecardee-portable-backup";
export const DATABASE_BACKUP_VERSION = 1;
export const MAX_BACKUP_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;

export type BackupColumn = {
  name: string;
  sqlType: string;
  nullable: boolean;
  defaultExpression: string | null;
};

export type BackupTable = {
  name: string;
  columns: BackupColumn[];
  rows: Record<string, unknown>[];
  excludedColumns?: string[];
};

export type PortableDatabaseBackup = {
  createdAt: string;
  createdBy: string;
  databaseType: string;
  appVersion: string;
  tables: BackupTable[];
  schemaSql: string;
  databaseSql: string;
  excludedTables: string[];
  securityNotes: string[];
};

type BackupFileEntry = {
  path: string;
  table: string | null;
  rowCount: number | null;
  sha256: string;
};

export type BackupInfo = {
  application: "Mecardee Rental Cars";
  format: typeof DATABASE_BACKUP_FORMAT;
  backupVersion: typeof DATABASE_BACKUP_VERSION;
  backupDateTime: string;
  timezone: "Asia/Kolkata";
  databaseType: string;
  appVersion: string;
  tableCount: number;
  totalRows: number;
  rowCounts: Record<string, number>;
  excludedTables: string[];
  securityNotes: string[];
};

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupValidationError";
  }
}
function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function mecardeeBackupFileName(createdAt: string | Date) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) throw new BackupValidationError("The backup creation date is invalid.");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "00";
  return `mecardee-backup-${part("year")}-${part("month")}-${part("day")}-${part("hour")}${part("minute")}.zip`;
}

function safeTableFileName(tableName: string) {
  const friendlyNames: Record<string, string> = {
    app_users: "users",
    rental_segments: "rentals",
    maintenance_records: "maintenance",
    vehicle_documents: "vehicle-documents",
    vehicle_tyres: "vehicle-tyres",
    return_settlements: "return-settlements",
    rental_extensions: "rental-extensions",
    app_number_counters: "configuration-number-counters",
    google_backup_connections: "google-backup-settings",
  };
  return friendlyNames[tableName] ?? tableName.replaceAll("_", "-");
}

function tableFiles(table: BackupTable) {
  const content = (rows: Record<string, unknown>[], logicalName = table.name) => strToU8(JSON.stringify({
    table: table.name,
    logicalName,
    columns: table.columns,
    excludedColumns: table.excludedColumns ?? [],
    rows,
  }, null, 2));

  if (table.name === "vehicles") {
    const ownVehicles = table.rows.filter((row) => row.is_guest !== true);
    const guestCars = table.rows.filter((row) => row.is_guest === true);
    return [
      { path: "database/vehicles.json", bytes: content(ownVehicles, "vehicles"), rowCount: ownVehicles.length },
      { path: "database/guest-cars.json", bytes: content(guestCars, "guest-cars"), rowCount: guestCars.length },
    ];
  }
  return [{ path: `database/${safeTableFileName(table.name)}.json`, bytes: content(table.rows), rowCount: table.rows.length }];
}

export function createDatabaseBackupZip(backup: PortableDatabaseBackup) {
  const rowCounts = Object.fromEntries(backup.tables.map((table) => [table.name, table.rows.length]));
  const backupInfo: BackupInfo = {
    application: "Mecardee Rental Cars",
    format: DATABASE_BACKUP_FORMAT,
    backupVersion: DATABASE_BACKUP_VERSION,
    backupDateTime: backup.createdAt,
    timezone: "Asia/Kolkata",
    databaseType: backup.databaseType,
    appVersion: backup.appVersion,
    tableCount: backup.tables.length,
    totalRows: backup.tables.reduce((total, table) => total + table.rows.length, 0),
    rowCounts,
    excludedTables: backup.excludedTables,
    securityNotes: backup.securityNotes,
  };
  const files: Record<string, Uint8Array> = {
    "backup-info.json": strToU8(JSON.stringify(backupInfo, null, 2)),
    "schema.sql": strToU8(backup.schemaSql),
    "database.sql": strToU8(backup.databaseSql),
  };

  for (const table of backup.tables) {
    for (const file of tableFiles(table)) files[file.path] = file.bytes;
  }

  const manifestFiles: BackupFileEntry[] = Object.entries(files).map(([path, bytes]) => {
    const sourceTable = backup.tables.find((table) => tableFiles(table).some((file) => file.path === path));
    const tableFile = sourceTable ? tableFiles(sourceTable).find((file) => file.path === path) : undefined;
    return { path, table: sourceTable?.name ?? null, rowCount: tableFile?.rowCount ?? null, sha256: sha256(bytes) };
  });
  const manifest = {
    format: DATABASE_BACKUP_FORMAT,
    backupVersion: DATABASE_BACKUP_VERSION,
    createdAt: backup.createdAt,
    files: manifestFiles,
  };
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  files["README-RESTORE.txt"] = strToU8([
    "Mecardee Rental Cars — Portable Backup",
    "",
    `Created: ${backup.createdAt}`,
    "Timezone: Asia/Kolkata",
    "",
    "This ZIP is an application-level backup and is not tied to Railway or PostgreSQL.",
    "The database/*.json files are the portable source of truth for migration and future restore tooling.",
    "schema.sql contains PostgreSQL-compatible table structure where available.",
    "database.sql contains PostgreSQL-compatible data inserts where practical.",
    "backup-info.json summarizes the backup; manifest.json lists and checksums every payload file.",
    "",
    "Security exclusions:",
    ...backup.securityNotes.map((note) => `- ${note}`),
    "",
    "Keep this ZIP private because it contains customer, rental, vehicle, and financial data.",
    "Use only Mecardee restore/migration tooling that validates the manifest and relationship conflicts.",
  ].join("\n"));

  // Add the README to the final manifest without creating a circular checksum for manifest.json itself.
  const readmeBytes = files["README-RESTORE.txt"];
  manifest.files.push({ path: "README-RESTORE.txt", table: null, rowCount: null, sha256: sha256(readmeBytes) });
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 6 });
}

export function inspectDatabaseBackupZip(bytes: Uint8Array) {
  if (!bytes.length) throw new BackupValidationError("The selected backup file is empty.");
  if (bytes.length > MAX_BACKUP_UPLOAD_BYTES) throw new BackupValidationError("The backup ZIP is larger than 50 MB.");

  let declaredSize = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter(file) {
        declaredSize += file.originalSize;
        if (declaredSize > MAX_BACKUP_UNCOMPRESSED_BYTES) throw new BackupValidationError("The uncompressed backup is larger than 200 MB.");
        return true;
      },
    });
  } catch (error) {
    if (error instanceof BackupValidationError) throw error;
    throw new BackupValidationError("The selected file is not a readable ZIP backup.");
  }

  for (const path of ["backup-info.json", "manifest.json", "schema.sql", "database.sql", "README-RESTORE.txt"]) {
    if (!files[path]) throw new BackupValidationError(`The backup is missing ${path}.`);
  }

  let info: BackupInfo;
  let manifest: { format?: unknown; backupVersion?: unknown; files?: BackupFileEntry[] };
  try {
    info = JSON.parse(strFromU8(files["backup-info.json"])) as BackupInfo;
    manifest = JSON.parse(strFromU8(files["manifest.json"])) as typeof manifest;
  } catch {
    throw new BackupValidationError("The backup metadata is not valid JSON.");
  }
  if (info.format !== DATABASE_BACKUP_FORMAT || info.backupVersion !== DATABASE_BACKUP_VERSION || manifest.format !== DATABASE_BACKUP_FORMAT || manifest.backupVersion !== DATABASE_BACKUP_VERSION) {
    throw new BackupValidationError("This Mecardee backup version is invalid or unsupported.");
  }
  if (!Array.isArray(manifest.files)) throw new BackupValidationError("The backup manifest file list is invalid.");
  for (const entry of manifest.files) {
    const file = files[entry.path];
    if (!file || sha256(file) !== entry.sha256) throw new BackupValidationError(`Backup integrity check failed for ${entry.path}.`);
  }
  if (!Object.keys(files).some((path) => path.startsWith("database/") && path.endsWith(".json"))) {
    throw new BackupValidationError("The backup contains no portable database JSON files.");
  }
  return { info, manifest, files };
}
