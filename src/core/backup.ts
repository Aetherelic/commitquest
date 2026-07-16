import fs from "node:fs";
import path from "node:path";
import {
  checkpointDatabase,
  databaseIntegrity,
  openDatabase
} from "../data/database.js";
import {
  getBackupDirectory,
  getDatabasePath,
  getSettingsPath
} from "../data/paths.js";

export interface BackupManifest {
  id: string;
  kind: "manual" | "pre-restore" | "pre-migration";
  createdAt: string;
  appVersion: string;
  databaseIntegrity: string;
  files: string[];
}

export interface BackupRecord {
  id: string;
  path: string;
  manifest: BackupManifest;
}

function safeTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function copyIfPresent(source: string, destinationDirectory: string): string | null {
  if (!fs.existsSync(source)) return null;
  const filename = path.basename(source);
  fs.copyFileSync(source, path.join(destinationDirectory, filename));
  return filename;
}

export function createBackup(
  options: { kind?: BackupManifest["kind"]; appVersion?: string; now?: Date } = {}
): BackupRecord {
  const now = options.now ?? new Date();
  const kind = options.kind ?? "manual";
  const appVersion = options.appVersion ?? "unknown";
  const db = openDatabase();
  let integrity = "unknown";
  try {
    integrity = databaseIntegrity(db);
    if (integrity !== "ok") throw new Error(`Cannot back up a damaged database: ${integrity}`);
    checkpointDatabase(db);
  } finally {
    db.close();
  }

  const id = `${kind}-${safeTimestamp(now)}`;
  const directory = path.join(getBackupDirectory(), id);
  fs.mkdirSync(getBackupDirectory(), { recursive: true, mode: 0o700 });
  fs.mkdirSync(directory, { recursive: false, mode: 0o700 });
  const databasePath = getDatabasePath();
  const files = [
    copyIfPresent(databasePath, directory),
    copyIfPresent(`${databasePath}-wal`, directory),
    copyIfPresent(`${databasePath}-shm`, directory),
    copyIfPresent(getSettingsPath(), directory)
  ].filter((value): value is string => value !== null);

  const manifest: BackupManifest = {
    id,
    kind,
    createdAt: now.toISOString(),
    appVersion,
    databaseIntegrity: integrity,
    files
  };
  fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return { id, path: directory, manifest };
}

function readBackup(directory: string): BackupRecord | null {
  const manifestPath = path.join(directory, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackupManifest;
    if (!manifest.id || !manifest.createdAt || !Array.isArray(manifest.files)) return null;
    return { id: manifest.id, path: directory, manifest };
  } catch {
    return null;
  }
}

export function listBackups(): BackupRecord[] {
  const root = getBackupDirectory();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readBackup(path.join(root, entry.name)))
    .filter((entry): entry is BackupRecord => entry !== null)
    .sort((a, b) => b.manifest.createdAt.localeCompare(a.manifest.createdAt));
}

export function restoreBackup(
  selector: string,
  options: { appVersion?: string; skipSafetyBackup?: boolean } = {}
): BackupRecord {
  const backups = listBackups();
  const selected = selector === "latest"
    ? backups[0]
    : backups.find((backup) => backup.id === selector || backup.path === path.resolve(selector));
  if (!selected) throw new Error(`Backup “${selector}” was not found.`);

  const databaseFilename = path.basename(getDatabasePath());
  const sourceDatabase = path.join(selected.path, databaseFilename);
  if (!fs.existsSync(sourceDatabase)) throw new Error("Selected backup does not contain a database.");

  if (!options.skipSafetyBackup && fs.existsSync(getDatabasePath())) {
    createBackup({ kind: "pre-restore", appVersion: options.appVersion ?? "unknown" });
  }

  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${databasePath}${suffix}`;
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
    const source = path.join(selected.path, `${databaseFilename}${suffix}`);
    if (fs.existsSync(source)) fs.copyFileSync(source, target);
  }

  const settingsSource = path.join(selected.path, path.basename(getSettingsPath()));
  if (fs.existsSync(settingsSource)) {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.copyFileSync(settingsSource, getSettingsPath());
  }

  const db = openDatabase();
  try {
    const integrity = databaseIntegrity(db);
    if (integrity !== "ok") throw new Error(`Restored database failed integrity check: ${integrity}`);
  } finally {
    db.close();
  }
  return selected;
}
