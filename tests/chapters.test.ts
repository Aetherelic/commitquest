import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chapterStates, ensureDefaultChapters } from "../src/core/chapters.js";
import { addRepository, insertCommit, openDatabase, totalXp } from "../src/data/database.js";
import type { GitCommit } from "../src/core/types.js";

const directories: string[] = [];
const makeCommit = (hash: string): GitCommit => ({
  hash,
  authorName: "Chapter Tester",
  authorEmail: "chapter@example.com",
  authoredAt: "2026-07-16T12:00:00.000Z",
  subject: "feat: advance campaign",
  type: "feat",
  filesChanged: 1,
  insertions: 1,
  deletions: 0,
  baseXp: 20
});

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("campaign chapters", () => {
  it("unlocks sequential chapters and never duplicates rewards", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-chapters-"));
    directories.push(directory);
    process.env.COMMITQUEST_HOME = directory;
    const db = openDatabase();
    const repository = addRepository(db, { name: "odyssey", path: "/tmp/odyssey", defaultBranch: "main" });
    ensureDefaultChapters(db, repository);
    insertCommit(db, repository.id, makeCommit("one"), 20, true);

    const first = chapterStates(db, repository.id, new Date("2026-07-16T12:01:00.000Z"));
    expect(first[0]?.status).toBe("complete");
    expect(first[1]?.status).toBe("active");
    expect(first[2]?.status).toBe("locked");
    expect(totalXp(db)).toBe(70);

    chapterStates(db, repository.id, new Date("2026-07-16T12:02:00.000Z"));
    expect(totalXp(db)).toBe(70);
    db.close();
  });
});
