import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addRepository,
  createCustomQuest,
  openDatabase
} from "../src/data/database.js";
import { updateProfile } from "../src/core/profile.js";
import {
  analyzeCustomQuestCommit,
  customQuestStates,
  suggestedConventionalSubject
} from "../src/core/custom-quests.js";
import {
  addCustomQuestCommand,
  checkCustomQuestCommand
} from "../src/commands/custom-quests.js";
import { scanCommand } from "../src/commands/scan.js";
import { getDefaultBranch, getRepositoryName, resolveRepositoryPath } from "../src/git/git.js";

const temporaryDirectories: string[] = [];

function createDirectory(prefix: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function git(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  execFileSync("git", args, {
    cwd,
    stdio: "ignore",
    env: { ...process.env, ...env }
  });
}

function createRepository(): string {
  const root = createDirectory("commitquest-guidance-repo-");
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.name", "Quest Tester"]);
  git(root, ["config", "user.email", "quest@example.com"]);

  fs.writeFileSync(path.join(root, "README.md"), "# Guidance\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-m", "docs: create fixture"], {
    GIT_AUTHOR_DATE: "2026-07-14T10:00:00+01:00",
    GIT_COMMITTER_DATE: "2026-07-14T10:00:00+01:00"
  });
  return root;
}

function captureLogs(run: () => void): string {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...values: unknown[]) => {
    lines.push(values.map(String).join(" "));
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return lines.join("\n");
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.COMMITQUEST_HOME;
  process.exitCode = undefined;
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("custom quest commit guidance", () => {
  it("matches scoped quests and suggests conventional messages for generic commits", () => {
    process.env.COMMITQUEST_HOME = createDirectory("commitquest-guidance-data-");
    const db = openDatabase();
    const first = addRepository(db, {
      name: "first",
      path: "/tmp/guidance-first",
      defaultBranch: "main"
    });
    const second = addRepository(db, {
      name: "second",
      path: "/tmp/guidance-second",
      defaultBranch: "main"
    });

    createCustomQuest(db, {
      title: "Ship a feature",
      repositoryId: null,
      objectiveType: "feat",
      target: 1,
      rewardXp: 50,
      deadlineAt: null
    });
    createCustomQuest(db, {
      title: "Repair the first campaign",
      repositoryId: first.id,
      objectiveType: "fix",
      target: 1,
      rewardXp: 50,
      deadlineAt: null
    });
    createCustomQuest(db, {
      title: "Document the second campaign",
      repositoryId: second.id,
      objectiveType: "docs",
      target: 1,
      rewardXp: 50,
      deadlineAt: null
    });
    createCustomQuest(db, {
      title: "Make any progress",
      repositoryId: first.id,
      objectiveType: "commit",
      target: 1,
      rewardXp: 25,
      deadlineAt: null
    });

    const analysis = analyzeCustomQuestCommit(customQuestStates(db), {
      repositoryId: first.id,
      type: "commit",
      subject: "add custom campaign quests"
    });

    expect(analysis.matching.map((item) => item.quest.title)).toEqual(["Make any progress"]);
    expect(analysis.missed.map((item) => item.quest.title).sort()).toEqual([
      "Repair the first campaign",
      "Ship a feature"
    ]);
    expect(analysis.missed.map((item) => item.suggestedSubject).sort()).toEqual([
      "feat: add custom campaign quests",
      "fix: add custom campaign quests"
    ]);
    db.close();
  });

  it("normalises near-miss prefixes into valid conventional subjects", () => {
    expect(suggestedConventionalSubject("feat", "Feature - Add quest guidance")).toBe(
      "feat: add quest guidance"
    );
    expect(suggestedConventionalSubject("fix", "bugfix missing reward output")).toBe(
      "fix: missing reward output"
    );
    expect(suggestedConventionalSubject("feat", "build quest dashboard")).toBe(
      "feat: build quest dashboard"
    );
    expect(suggestedConventionalSubject("release", "Ship v0.2")).toBeNull();
  });

  it("previews classification and missed quests with cq quest check", () => {
    process.env.COMMITQUEST_HOME = createDirectory("commitquest-check-data-");
    const db = openDatabase();
    const repository = addRepository(db, {
      name: "commitquest",
      path: "/tmp/commitquest-check",
      defaultBranch: "main"
    });
    createCustomQuest(db, {
      title: "Add quest guidance",
      repositoryId: repository.id,
      objectiveType: "feat",
      target: 1,
      rewardXp: 100,
      deadlineAt: null
    });
    db.close();

    const output = captureLogs(() => {
      checkCustomQuestCommand("add quest guidance", { repo: "commitquest" });
    });

    expect(output).toContain("COMMIT CHECK");
    expect(output).toContain("Classification: generic commit");
    expect(output).toContain("TYPED QUESTS THIS MESSAGE WOULD MISS");
    expect(output).toContain("Use: feat: add quest guidance");

    const matchingOutput = captureLogs(() => {
      checkCustomQuestCommand("feat: add quest guidance", { repo: "commitquest" });
    });
    expect(matchingOutput).toContain("Classification: feat commit");
    expect(matchingOutput).toContain("WOULD ADVANCE");
    expect(matchingOutput).toContain("#1 Add quest guidance");
  });

  it("prints an example conventional subject when a typed quest is created", () => {
    process.env.COMMITQUEST_HOME = createDirectory("commitquest-add-guidance-data-");
    const db = openDatabase();
    addRepository(db, {
      name: "commitquest",
      path: "/tmp/commitquest-add-guidance",
      defaultBranch: "main"
    });
    db.close();

    const output = captureLogs(() => {
      addCustomQuestCommand("Improve the installation guide", {
        repo: "commitquest",
        type: "docs",
        target: "1",
        xp: "75"
      });
    });

    expect(output).toContain("Suggested commit: docs: improve the installation guide");
  });

  it("prints a live mismatch explanation after a generic tracked commit", () => {
    const repositoryPath = createRepository();
    process.env.COMMITQUEST_HOME = createDirectory("commitquest-live-guidance-data-");
    const resolvedPath = resolveRepositoryPath(repositoryPath);
    const db = openDatabase();
    updateProfile(db, { name: "Quest Tester", email: "quest@example.com" });
    const repository = addRepository(db, {
      name: getRepositoryName(resolvedPath),
      path: resolvedPath,
      defaultBranch: getDefaultBranch(resolvedPath)
    });
    createCustomQuest(db, {
      title: "Add custom campaign quests",
      repositoryId: repository.id,
      objectiveType: "feat",
      target: 1,
      rewardXp: 150,
      deadlineAt: null
    });
    db.close();

    fs.writeFileSync(path.join(repositoryPath, "quest.ts"), "export const quest = true;\n");
    git(repositoryPath, ["add", "quest.ts"]);
    git(repositoryPath, ["commit", "-m", "add custom campaign quests"]);

    const output = captureLogs(() => {
      scanCommand({ repo: resolvedPath, hook: true });
    });

    expect(output).toContain("QUEST TYPE MISMATCH");
    expect(output).toContain("expects feat commit");
    expect(output).toContain("Try next time: feat: add custom campaign quests");
    expect(output).toContain("cq quest check <message>");
  });
});
