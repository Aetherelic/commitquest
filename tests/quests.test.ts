import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  addRepository,
  getMeta,
  insertCommit,
  openDatabase
} from "../src/data/database.js";
import { buildQuests, isQuestRewarded, syncQuestRewards } from "../src/core/quests.js";
import type { GitCommit } from "../src/core/types.js";

const temporaryDirectories: string[] = [];

function createDataDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-quests-"));
  temporaryDirectories.push(directory);
  process.env.COMMITQUEST_HOME = directory;
  return directory;
}

function commit(hash: string, authoredAt: string, type: GitCommit["type"] = "commit"): GitCommit {
  return {
    hash,
    authorName: "Quest Tester",
    authorEmail: "quest@example.com",
    authoredAt,
    subject: `${type}: test activity`,
    type,
    filesChanged: 1,
    insertions: 1,
    deletions: 0,
    baseXp: 20
  };
}

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("quest eligibility", () => {
  it("awards historical XP without advancing active quests", () => {
    createDataDirectory();
    const db = openDatabase();
    const repository = addRepository(db, {
      name: "fixture",
      path: "/tmp/fixture",
      defaultBranch: "main"
    });

    db.prepare("UPDATE repositories SET added_at = ? WHERE id = ?")
      .run("2026-07-15T12:00:00.000Z", repository.id);

    insertCommit(db, repository.id, commit("old", "2026-07-15T10:00:00.000Z", "docs"), 15, false);

    let quests = buildQuests(db, new Date("2026-07-15T18:00:00.000Z"));
    expect(quests.find((quest) => quest.title === "First Step")?.progress).toBe(0);
    expect(quests.find((quest) => quest.title === "Leave a Map")?.progress).toBe(0);

    insertCommit(db, repository.id, commit("new", "2026-07-15T14:00:00.000Z", "docs"), 15, true);

    quests = buildQuests(db, new Date("2026-07-15T18:00:00.000Z"));
    expect(quests.find((quest) => quest.title === "First Step")?.complete).toBe(true);
    expect(quests.find((quest) => quest.title === "Leave a Map")?.complete).toBe(true);
    db.close();
  });

  it("revokes current quest rewards that were granted from imported history", () => {
    createDataDirectory();
    const db = openDatabase();
    const repository = addRepository(db, {
      name: "fixture",
      path: "/tmp/fixture",
      defaultBranch: "main"
    });

    insertCommit(db, repository.id, commit("old", "2026-07-15T10:00:00.000Z"), 20, false);
    db.prepare(`
      INSERT INTO quest_rewards(quest_key, title, reward_xp, awarded_at)
      VALUES (?, ?, ?, ?)
    `).run("daily-2026-07-15", "First Step", 25, "2026-07-15T10:01:00.000Z");

    syncQuestRewards(db, new Date("2026-07-15T18:00:00.000Z"));

    expect(isQuestRewarded(db, "daily-2026-07-15")).toBe(false);
    expect(getMeta(db, "quest-eligibility-v1-reconciled")).not.toBeNull();
    db.close();
  });

  it("migrates an existing database and marks pre-campaign activity as historical", () => {
    const dataDirectory = createDataDirectory();
    const databasePath = path.join(dataDirectory, "commitquest.db");
    const legacy = new DatabaseSync(databasePath);

    legacy.exec(`
      CREATE TABLE repositories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        default_branch TEXT,
        added_at TEXT NOT NULL,
        last_scanned_at TEXT
      );
      CREATE TABLE commits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER NOT NULL,
        hash TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_email TEXT NOT NULL,
        authored_at TEXT NOT NULL,
        subject TEXT NOT NULL,
        type TEXT NOT NULL,
        files_changed INTEGER NOT NULL,
        insertions INTEGER NOT NULL,
        deletions INTEGER NOT NULL,
        base_xp INTEGER NOT NULL,
        awarded_xp INTEGER NOT NULL,
        imported_at TEXT NOT NULL,
        UNIQUE(repository_id, hash)
      );
      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repository_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        tagged_at TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 150,
        imported_at TEXT NOT NULL,
        UNIQUE(repository_id, name)
      );
      INSERT INTO repositories(name, path, default_branch, added_at)
      VALUES ('fixture', '/tmp/fixture', 'main', '2026-07-15T12:00:00.000Z');
      INSERT INTO commits(
        repository_id, hash, author_name, author_email, authored_at, subject,
        type, files_changed, insertions, deletions, base_xp, awarded_xp, imported_at
      ) VALUES (
        1, 'old', 'Quest Tester', 'quest@example.com', '2026-07-15T10:00:00.000Z',
        'docs: old work', 'docs', 1, 1, 0, 20, 20, '2026-07-15T13:00:00.000Z'
      );
    `);
    legacy.close();

    const db = openDatabase();
    const row = db.prepare("SELECT quest_eligible AS questEligible FROM commits WHERE hash = 'old'")
      .get() as { questEligible: number };

    expect(row.questEligible).toBe(0);
    expect(buildQuests(db, new Date("2026-07-15T18:00:00.000Z"))[0]?.progress).toBe(0);
    db.close();
  });
});
