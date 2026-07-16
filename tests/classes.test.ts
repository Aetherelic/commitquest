import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { choosePlayerClass, playerClassStates } from "../src/core/classes.js";
import { addRepository, insertCommit, openDatabase } from "../src/data/database.js";
import type { GitCommit } from "../src/core/types.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("developer classes", () => {
  it("tracks affinity XP without changing global rewards", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-classes-"));
    directories.push(directory);
    process.env.COMMITQUEST_HOME = directory;
    const db = openDatabase();
    const repository = addRepository(db, { name: "classes", path: "/tmp/classes", defaultBranch: "main" });
    const commit: GitCommit = {
      hash: "feature",
      authorName: "Class Tester",
      authorEmail: "class@example.com",
      authoredAt: "2026-07-16T12:00:00.000Z",
      subject: "feat: craft interface",
      type: "feat",
      filesChanged: 2,
      insertions: 20,
      deletions: 2,
      baseXp: 40
    };
    insertCommit(db, repository.id, commit, 55, true);
    choosePlayerClass(db, "artificer");
    const states = playerClassStates(db);
    expect(states.find((state) => state.id === "artificer")?.classXp).toBe(55);
    expect(states.find((state) => state.selected)?.id).toBe("artificer");
    expect(states.find((state) => state.id === "sentinel")?.classXp).toBe(0);
    db.close();
  });
});
