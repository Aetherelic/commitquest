import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  createBossBattle,
  findRepository,
  getBossBattle,
  updateBossBattle,
  type CommitQuestDatabase
} from "../data/database.js";
import type { BossBattleRecord, RepositoryRecord } from "./types.js";

export type BossCheckState = "pass" | "fail" | "warn" | "skip";

export interface BossCheck {
  key: string;
  title: string;
  state: BossCheckState;
  detail: string;
  required: boolean;
}

export interface BossEncounter {
  battle: BossBattleRecord;
  repository: RepositoryRecord;
  checks: BossCheck[];
  ready: boolean;
}

function git(repositoryPath: string, args: string[]): string {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

export function normalizeVersion(version: string): string {
  const trimmed = version.trim();
  if (!/^v?\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(trimmed)) {
    throw new Error("Version must look like 1.2.3 or v1.2.3.");
  }
  return trimmed.replace(/^v/, "");
}

function packageInfo(repositoryPath: string): { version: string | null; testCommand: string | null } {
  const packagePath = path.join(repositoryPath, "package.json");
  if (!fs.existsSync(packagePath)) return { version: null, testCommand: null };
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8")) as {
      version?: string;
      scripts?: Record<string, string>;
    };
    return {
      version: typeof pkg.version === "string" ? pkg.version : null,
      testCommand: pkg.scripts?.test ? "npm test" : null
    };
  } catch {
    return { version: null, testCommand: null };
  }
}

function lastTag(repositoryPath: string): string | null {
  try {
    return git(repositoryPath, ["describe", "--tags", "--abbrev=0"]);
  } catch {
    return null;
  }
}

function changedSince(repositoryPath: string, base: string | null, patterns: string[]): boolean {
  try {
    const args = base
      ? ["diff", "--name-only", `${base}..HEAD`, "--", ...patterns]
      : ["ls-files", "--", ...patterns];
    return git(repositoryPath, args).length > 0;
  } catch {
    return false;
  }
}

function runTestCommand(repositoryPath: string, command: string): { passed: boolean; detail: string } {
  const result = spawnSync("bash", ["-lc", command], {
    cwd: repositoryPath,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 10 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error) return { passed: false, detail: result.error.message };
  if (result.status === 0) return { passed: true, detail: `${command} passed` };
  const output = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim().split("\n").slice(-2).join(" · ");
  return { passed: false, detail: output || `${command} exited with ${result.status}` };
}

export function inspectBossEncounter(
  db: CommitQuestDatabase,
  selector: string,
  versionInput: string,
  options: { runTests?: boolean; testCommand?: string | null } = {}
): BossEncounter {
  const repository = findRepository(db, selector);
  if (!repository) throw new Error(`Campaign “${selector}” was not found.`);
  if (repository.archived) throw new Error("Archived campaigns cannot begin boss encounters.");
  if (!fs.existsSync(repository.path)) throw new Error(`Campaign path is missing: ${repository.path}`);
  const version = normalizeVersion(versionInput);
  const detected = packageInfo(repository.path);
  const testCommand = options.testCommand ?? detected.testCommand;
  const battle = getBossBattle(db, repository.id, version)
    ?? createBossBattle(db, { repositoryId: repository.id, version, testCommand });
  const previousTag = lastTag(repository.path);
  const tagName = `v${version}`;
  const clean = git(repository.path, ["status", "--porcelain"]).length === 0;
  let tagExists = false;
  try {
    tagExists = git(repository.path, ["tag", "--list", tagName]) === tagName;
  } catch {
    tagExists = false;
  }

  const checks: BossCheck[] = [
    {
      key: "clean",
      title: "Working tree clean",
      state: clean ? "pass" : "fail",
      detail: clean ? "No uncommitted changes" : "Commit or stash changes before release",
      required: true
    },
    {
      key: "version",
      title: "Version prepared",
      state: detected.version === null ? "warn" : detected.version === version ? "pass" : "fail",
      detail: detected.version === null ? "No package.json version detected" : `package.json: ${detected.version}`,
      required: detected.version !== null
    },
    {
      key: "docs",
      title: "Documentation updated",
      state: changedSince(repository.path, previousTag, ["README*", "docs/**"]) ? "pass" : "warn",
      detail: previousTag ? `Checked changes since ${previousTag}` : "Checked tracked documentation",
      required: false
    },
    {
      key: "changelog",
      title: "Changelog prepared",
      state: changedSince(repository.path, previousTag, ["CHANGELOG*", "CHANGES*"]) ? "pass" : "warn",
      detail: "Recommended for public releases",
      required: false
    },
    {
      key: "tag",
      title: "Release tag available",
      state: tagExists ? "pass" : "warn",
      detail: tagExists ? `${tagName} already exists` : `${tagName} will be created only when requested`,
      required: false
    }
  ];

  if (testCommand) {
    if (options.runTests) {
      const result = runTestCommand(repository.path, testCommand);
      checks.push({
        key: "tests",
        title: "Test suite passing",
        state: result.passed ? "pass" : "fail",
        detail: result.detail,
        required: true
      });
    } else {
      checks.push({
        key: "tests",
        title: "Test suite passing",
        state: "warn",
        detail: `${testCommand} configured; rerun with tests enabled`,
        required: true
      });
    }
  } else {
    checks.push({
      key: "tests",
      title: "Test suite passing",
      state: "skip",
      detail: "No test command detected",
      required: false
    });
  }

  const ready = checks.every((check) => !check.required || check.state === "pass");
  updateBossBattle(db, battle.id, { status: ready ? "ready" : "preparing" });
  return { battle: { ...battle, status: ready ? "ready" : "preparing" }, repository, checks, ready };
}

export function completeBossEncounter(
  db: CommitQuestDatabase,
  selector: string,
  versionInput: string,
  options: { createTag?: boolean; runTests?: boolean; testCommand?: string | null; now?: Date } = {}
): BossEncounter {
  const encounter = inspectBossEncounter(db, selector, versionInput, {
    runTests: options.runTests ?? true,
    ...(options.testCommand === undefined ? {} : { testCommand: options.testCommand })
  });
  if (!encounter.ready) {
    const failed = encounter.checks.filter((check) => check.required && check.state !== "pass").map((check) => check.title);
    throw new Error(`Boss encounter is not ready: ${failed.join(", ")}.`);
  }
  const tagName = `v${normalizeVersion(versionInput)}`;
  const existing = git(encounter.repository.path, ["tag", "--list", tagName]) === tagName;
  if (!existing && options.createTag) {
    execFileSync("git", ["-C", encounter.repository.path, "tag", "-a", tagName, "-m", `Release ${tagName}`], {
      stdio: ["ignore", "pipe", "pipe"]
    });
  } else if (!existing && !options.createTag) {
    throw new Error(`Create tag ${tagName} first, or pass --create-tag.`);
  }
  const completedAt = (options.now ?? new Date()).toISOString();
  updateBossBattle(db, encounter.battle.id, {
    status: "complete",
    releaseTag: tagName,
    completedAt
  });
  db.prepare(`
    INSERT OR IGNORE INTO quest_rewards(quest_key, title, reward_xp, awarded_at)
    VALUES (?, ?, ?, ?)
  `).run(`boss-${encounter.battle.id}`, `Boss defeated · ${encounter.repository.name} ${tagName}`, 300, completedAt);
  return {
    ...encounter,
    battle: { ...encounter.battle, status: "complete", releaseTag: tagName, completedAt }
  };
}
