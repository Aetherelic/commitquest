import fs from "node:fs";
import path from "node:path";
import { getBackupDirectory, getCrashDirectory } from "../data/paths.js";

export interface CleanupCandidate {
  kind: "backup" | "crash-report";
  path: string;
  modifiedAt: string;
}

export interface CleanupPlan {
  keepBackups: number;
  keepCrashReports: number;
  candidates: CleanupCandidate[];
}

function sortedEntries(directory: string): Array<{ path: string; mtimeMs: number }> {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return { path: entryPath, mtimeMs: fs.statSync(entryPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function positiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

export function createCleanupPlan(options: { keepBackups?: number; keepCrashReports?: number } = {}): CleanupPlan {
  const keepBackups = positiveInteger(options.keepBackups ?? 10, "keepBackups");
  const keepCrashReports = positiveInteger(options.keepCrashReports ?? 20, "keepCrashReports");
  const backupCandidates = sortedEntries(getBackupDirectory()).slice(keepBackups).map((entry): CleanupCandidate => ({
    kind: "backup",
    path: entry.path,
    modifiedAt: new Date(entry.mtimeMs).toISOString()
  }));
  const crashCandidates = sortedEntries(getCrashDirectory()).slice(keepCrashReports).map((entry): CleanupCandidate => ({
    kind: "crash-report",
    path: entry.path,
    modifiedAt: new Date(entry.mtimeMs).toISOString()
  }));
  return { keepBackups, keepCrashReports, candidates: [...backupCandidates, ...crashCandidates] };
}

export function applyCleanupPlan(plan: CleanupPlan): void {
  for (const candidate of plan.candidates) {
    fs.rmSync(candidate.path, { recursive: true, force: true });
  }
}
