import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { completeBossEncounter, inspectBossEncounter } from "../src/core/boss.js";
import { addRepository, openDatabase, totalXp } from "../src/data/database.js";

const directories: string[] = [];

function git(directory: string, args: string[]): void {
  execFileSync("git", ["-C", directory, ...args], { stdio: "ignore" });
}

afterEach(() => {
  delete process.env.COMMITQUEST_HOME;
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

describe("release boss encounters", () => {
  it("verifies a release and creates only a local annotated tag when explicitly requested", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-boss-home-"));
    const repositoryPath = fs.mkdtempSync(path.join(os.tmpdir(), "commitquest-boss-repo-"));
    directories.push(home, repositoryPath);
    process.env.COMMITQUEST_HOME = home;
    git(repositoryPath, ["init", "-b", "main"]);
    git(repositoryPath, ["config", "user.name", "Boss Tester"]);
    git(repositoryPath, ["config", "user.email", "boss@example.com"]);
    fs.writeFileSync(path.join(repositoryPath, "package.json"), JSON.stringify({
      name: "boss-test",
      version: "0.5.0",
      scripts: { test: "node -e \"process.exit(0)\"" }
    }, null, 2));
    fs.writeFileSync(path.join(repositoryPath, "README.md"), "# Boss Test\n");
    fs.writeFileSync(path.join(repositoryPath, "CHANGELOG.md"), "# 0.5.0\n");
    git(repositoryPath, ["add", "."]);
    git(repositoryPath, ["commit", "-m", "feat: prepare release"]);

    const db = openDatabase();
    addRepository(db, { name: "boss-test", path: repositoryPath, defaultBranch: "main" });
    const status = inspectBossEncounter(db, "boss-test", "0.5.0", { runTests: true });
    expect(status.ready).toBe(true);

    const completed = completeBossEncounter(db, "boss-test", "0.5.0", { createTag: true, runTests: true });
    expect(completed.battle.status).toBe("complete");
    expect(execFileSync("git", ["-C", repositoryPath, "tag", "--list", "v0.5.0"], { encoding: "utf8" }).trim()).toBe("v0.5.0");
    expect(totalXp(db)).toBe(300);
    db.close();
  });
});
