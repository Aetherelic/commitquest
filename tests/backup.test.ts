import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBackup, listBackups, restoreBackup } from "../src/core/backup.js";
import { getMeta, openDatabase, setMeta } from "../src/data/database.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("backup and restore", () => {
  it("creates an integrity-checked backup and restores data safely", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-backup-"));
    directories.push(directory);
    process.env.COMMITQUEST_HOME = directory;
    let db = openDatabase();
    setMeta(db, "test.value", "before");
    db.close();

    const backup = createBackup({ appVersion: "0.5.0", now: new Date("2026-07-16T12:00:00.000Z") });
    expect(backup.manifest.databaseIntegrity).toBe("ok");
    expect(listBackups().map((entry) => entry.id)).toContain(backup.id);

    db = openDatabase();
    setMeta(db, "test.value", "after");
    db.close();

    restoreBackup(backup.id, { appVersion: "0.5.0" });
    db = openDatabase();
    expect(getMeta(db, "test.value")).toBe("before");
    db.close();
    expect(listBackups().some((entry) => entry.manifest.kind === "pre-restore")).toBe(true);
  });
});
