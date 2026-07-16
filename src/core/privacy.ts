import fs from "node:fs";
import path from "node:path";
import { listRepositories, openDatabase } from "../data/database.js";
import {
  getBackupDirectory,
  getConfigDirectory,
  getCrashDirectory,
  getDataDirectory,
  getDatabasePath,
  getShareDirectory
} from "../data/paths.js";

export interface PrivacyAudit {
  dataDirectory: string;
  configDirectory: string;
  databasePath: string;
  databaseBytes: number;
  campaigns: number;
  archivedCampaigns: number;
  backups: number;
  crashReports: number;
  shares: number;
  networkAccess: "none";
  defaultShareIncludesProjects: false;
  storesCommitSubjectsLocally: true;
  storesRepositoryPathsLocally: true;
}

function fileSize(file: string): number {
  try { return fs.statSync(file).size; } catch { return 0; }
}

function countEntries(directory: string): number {
  try { return fs.readdirSync(directory).length; } catch { return 0; }
}

export function createPrivacyAudit(): PrivacyAudit {
  const db = openDatabase();
  try {
    const repositories = listRepositories(db);
    return {
      dataDirectory: getDataDirectory(),
      configDirectory: getConfigDirectory(),
      databasePath: getDatabasePath(),
      databaseBytes: fileSize(getDatabasePath()),
      campaigns: repositories.length,
      archivedCampaigns: repositories.filter((repository) => repository.archived).length,
      backups: countEntries(getBackupDirectory()),
      crashReports: countEntries(getCrashDirectory()),
      shares: countEntries(getShareDirectory()),
      networkAccess: "none",
      defaultShareIncludesProjects: false,
      storesCommitSubjectsLocally: true,
      storesRepositoryPathsLocally: true
    };
  } finally {
    db.close();
  }
}

export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

export function safePathLabel(value: string): string {
  return path.resolve(value);
}
