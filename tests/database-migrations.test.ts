import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { getDatabasePath } from "../src/data/paths.js";
import { DATABASE_SCHEMA_VERSION, listRepositories, openDatabase } from "../src/data/database.js";
import { listBackups } from "../src/core/backup.js";

const homes: string[] = [];

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const home of homes.splice(0)) fs.rmSync(home, { recursive: true, force: true });
});

describe("database migrations", () => {
  it("adds repository archive state to databases created by earlier releases", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-migration-"));
    homes.push(home);
    process.env.COMMITQUEST_HOME = home;
    fs.mkdirSync(path.dirname(getDatabasePath()), { recursive: true });

    const legacy = new DatabaseSync(getDatabasePath());
    legacy.exec(`
      CREATE TABLE repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        default_branch TEXT,
        added_at TEXT NOT NULL,
        last_scanned_at TEXT
      );
      INSERT INTO repositories(name, path, default_branch, added_at)
      VALUES ('legacy', '/tmp/legacy', 'main', '2026-07-16T10:00:00.000Z');
    `);
    legacy.close();

    const db = openDatabase();
    const columns = db.prepare("PRAGMA table_info(repositories)").all() as Array<{ name: string }>;
    expect(columns.some((column) => column.name === "archived")).toBe(true);
    expect(listRepositories(db)[0]).toMatchObject({ name: "legacy", archived: false });
    const version = db.prepare("PRAGMA user_version").get() as { user_version: number };
    expect(version.user_version).toBe(DATABASE_SCHEMA_VERSION);
    db.close();

    const migrationBackup = listBackups().find((backup) => backup.manifest.kind === "pre-migration");
    expect(migrationBackup).toBeDefined();
    expect(migrationBackup?.manifest.files).toContain("commitquest.db");
  });
});
