import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { addRepository, databaseStats, openDatabase, totalXp } from "../src/data/database.js";
import { getDefaultBranch, getRepositoryName, readCommits, resolveRepositoryPath } from "../src/git/git.js";
import { scanRepositories } from "../src/core/scan.js";

const temporaryDirectories: string[] = [];

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  execFileSync("git", args, {
    cwd,
    stdio: "ignore",
    env: { ...process.env, ...env }
  });
}

function createFixtureRepository(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-test-"));
  temporaryDirectories.push(root);
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.name", "Quest Tester"]);
  git(root, ["config", "user.email", "quest@example.com"]);

  fs.writeFileSync(path.join(root, "README.md"), "# Quest\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-m", "docs: begin the adventure"], {
    GIT_AUTHOR_DATE: "2026-07-14T10:00:00+01:00",
    GIT_COMMITTER_DATE: "2026-07-14T10:00:00+01:00"
  });

  fs.writeFileSync(path.join(root, "index.ts"), "export const quest = true;\n");
  git(root, ["add", "index.ts"]);
  git(root, ["commit", "-m", "feat: add quest engine"], {
    GIT_AUTHOR_DATE: "2026-07-15T10:00:00+01:00",
    GIT_COMMITTER_DATE: "2026-07-15T10:00:00+01:00"
  });

  git(root, ["tag", "v0.1.0"]);
  return root;
}

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("repository scanning", () => {
  it("imports Git data and never rewards duplicates", () => {
    const repositoryPath = createFixtureRepository();
    const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-data-"));
    temporaryDirectories.push(dataDirectory);
    process.env.COMMITQUEST_HOME = dataDirectory;

    const resolved = resolveRepositoryPath(repositoryPath);
    const db = openDatabase();
    const repository = addRepository(db, {
      name: getRepositoryName(resolved),
      path: resolved,
      defaultBranch: getDefaultBranch(resolved)
    });

    expect(readCommits(resolved)).toHaveLength(2);

    const first = scanRepositories(db, [repository], "quest@example.com");
    const firstXp = totalXp(db);
    expect(first.importedCommits).toBe(2);
    expect(first.importedTags).toBe(1);
    expect(first.historicalCommits).toBe(2);
    expect(first.historicalTags).toBe(1);
    expect(databaseStats(db).commits).toBe(2);
    expect(firstXp).toBeGreaterThanOrEqual(205);

    const second = scanRepositories(db, [repository], "quest@example.com");
    expect(second.importedCommits).toBe(0);
    expect(second.importedTags).toBe(0);
    expect(totalXp(db)).toBe(firstXp);
    db.close();
  });
});
