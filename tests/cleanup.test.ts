import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyCleanupPlan, createCleanupPlan } from "../src/core/cleanup.js";
import { getBackupDirectory, getCrashDirectory } from "../src/data/paths.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function createEntry(directory: string, name: string, age: number): string {
  fs.mkdirSync(directory, { recursive: true });
  const entry = path.join(directory, name);
  fs.mkdirSync(entry, { recursive: true });
  const time = new Date(Date.now() - age * 1000);
  fs.utimesSync(entry, time, time);
  return entry;
}

describe("cleanup planning", () => {
  it("keeps the newest files and only removes candidates after apply", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-cleanup-"));
    directories.push(directory);
    process.env.COMMITQUEST_HOME = directory;

    const newestBackup = createEntry(getBackupDirectory(), "newest", 1);
    const oldBackup = createEntry(getBackupDirectory(), "old", 20);
    const newestCrash = createEntry(getCrashDirectory(), "newest", 1);
    const oldCrash = createEntry(getCrashDirectory(), "old", 20);

    const plan = createCleanupPlan({ keepBackups: 1, keepCrashReports: 1 });
    expect(plan.candidates.map((candidate) => path.basename(candidate.path)).sort()).toEqual(["old", "old"]);
    expect(fs.existsSync(oldBackup)).toBe(true);
    expect(fs.existsSync(oldCrash)).toBe(true);

    applyCleanupPlan(plan);
    expect(fs.existsSync(newestBackup)).toBe(true);
    expect(fs.existsSync(newestCrash)).toBe(true);
    expect(fs.existsSync(oldBackup)).toBe(false);
    expect(fs.existsSync(oldCrash)).toBe(false);
  });

  it("rejects negative retention values", () => {
    expect(() => createCleanupPlan({ keepBackups: -1 })).toThrow("non-negative integer");
  });
});
