import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { addRepository, insertCommit, openDatabase } from "../src/data/database.js";
import { buildPublicJourney, journeyMarkdown, journeySvg, writeJourneyShare } from "../src/core/share.js";
import type { GitCommit } from "../src/core/types.js";

const directories: string[] = [];

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("privacy-safe sharing", () => {
  it("excludes repository names, paths, email, and commit subjects by default", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-share-"));
    directories.push(directory);
    process.env.COMMITQUEST_HOME = directory;
    const db = openDatabase();
    const repository = addRepository(db, {
      name: "private-secret-project",
      path: "/home/test/private-secret-project",
      defaultBranch: "main"
    });
    const commit: GitCommit = {
      hash: "secret",
      authorName: "Tester",
      authorEmail: "private@example.com",
      authoredAt: "2026-07-16T12:00:00.000Z",
      subject: "feat: secret unreleased product",
      type: "feat",
      filesChanged: 1,
      insertions: 1,
      deletions: 0,
      baseXp: 20
    };
    insertCommit(db, repository.id, commit, 40, true);
    const journey = buildPublicJourney(db, { publicName: "Public Alias" });
    const markdown = journeyMarkdown(journey);
    const svg = journeySvg(journey);
    for (const output of [markdown, svg]) {
      expect(output).not.toContain("private-secret-project");
      expect(output).not.toContain("/home/test");
      expect(output).not.toContain("private@example.com");
      expect(output).not.toContain("secret unreleased product");
      expect(output).toContain("Public Alias");
    }
    const destination = writeJourneyShare(db, "svg", { publicName: "Public Alias" });
    expect(fs.existsSync(destination)).toBe(true);
    db.close();
  });
});
