import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { getDataDirectory, getDatabasePath } from "./paths.js";
import type { CustomQuestObjective, CustomQuestRecord, GitCommit, RepositoryRecord } from "../core/types.js";

export type CommitQuestDatabase = DatabaseSync;

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  default_branch TEXT,
  added_at TEXT NOT NULL,
  last_scanned_at TEXT
);

CREATE TABLE IF NOT EXISTS commits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
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
  quest_eligible INTEGER NOT NULL DEFAULT 1,
  UNIQUE(repository_id, hash)
);

CREATE INDEX IF NOT EXISTS commits_authored_at_idx ON commits(authored_at);
CREATE INDEX IF NOT EXISTS commits_type_idx ON commits(type);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  tagged_at TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 150,
  imported_at TEXT NOT NULL,
  quest_eligible INTEGER NOT NULL DEFAULT 1,
  UNIQUE(repository_id, name)
);

CREATE TABLE IF NOT EXISTS quest_rewards (
  quest_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  reward_xp INTEGER NOT NULL,
  awarded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  achievement_key TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  reward_xp INTEGER NOT NULL,
  unlocked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_quests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  repository_id INTEGER REFERENCES repositories(id) ON DELETE SET NULL,
  objective_type TEXT NOT NULL,
  target INTEGER NOT NULL,
  reward_xp INTEGER NOT NULL,
  baseline_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  deadline_at TEXT,
  completed_at TEXT,
  abandoned_at TEXT
);

CREATE INDEX IF NOT EXISTS custom_quests_status_idx
  ON custom_quests(completed_at, abandoned_at, deadline_at);
`;

function hasColumn(db: CommitQuestDatabase, table: "commits" | "tags", column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function migrateQuestEligibility(db: CommitQuestDatabase): void {
  if (!hasColumn(db, "commits", "quest_eligible")) {
    db.exec("ALTER TABLE commits ADD COLUMN quest_eligible INTEGER NOT NULL DEFAULT 1");
    db.exec(`
      UPDATE commits
      SET quest_eligible = CASE
        WHEN julianday(authored_at) >= julianday((
          SELECT added_at FROM repositories WHERE repositories.id = commits.repository_id
        )) THEN 1
        ELSE 0
      END
    `);
  }

  if (!hasColumn(db, "tags", "quest_eligible")) {
    db.exec("ALTER TABLE tags ADD COLUMN quest_eligible INTEGER NOT NULL DEFAULT 1");
    db.exec(`
      UPDATE tags
      SET quest_eligible = CASE
        WHEN julianday(tagged_at) >= julianday((
          SELECT added_at FROM repositories WHERE repositories.id = tags.repository_id
        )) THEN 1
        ELSE 0
      END
    `);
  }
}

function reconcileQuestEligibilityPrecision(db: CommitQuestDatabase): void {
  const migrationKey = "quest-eligibility-second-precision-v1";
  const applied = db.prepare("SELECT 1 AS found FROM meta WHERE key = ?").get(migrationKey);
  if (applied) return;

  db.exec(`
    UPDATE commits
    SET quest_eligible = CASE
      WHEN CAST(strftime('%s', authored_at) AS INTEGER) >= CAST(strftime('%s', (
        SELECT added_at FROM repositories WHERE repositories.id = commits.repository_id
      )) AS INTEGER) THEN 1
      ELSE 0
    END;

    UPDATE tags
    SET quest_eligible = CASE
      WHEN CAST(strftime('%s', tagged_at) AS INTEGER) >= CAST(strftime('%s', (
        SELECT added_at FROM repositories WHERE repositories.id = tags.repository_id
      )) AS INTEGER) THEN 1
      ELSE 0
    END;
  `);

  db.prepare("INSERT INTO meta(key, value) VALUES (?, ?)")
    .run(migrationKey, new Date().toISOString());
}

export function openDatabase(): CommitQuestDatabase {
  fs.mkdirSync(getDataDirectory(), { recursive: true });
  const db = new DatabaseSync(getDatabasePath());
  db.exec(SCHEMA);
  migrateQuestEligibility(db);
  reconcileQuestEligibilityPrecision(db);
  return db;
}

export function getMeta(db: CommitQuestDatabase, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(db: CommitQuestDatabase, key: string, value: string): void {
  db.prepare(`
    INSERT INTO meta(key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

export function listRepositories(db: CommitQuestDatabase): RepositoryRecord[] {
  return db.prepare(`
    SELECT
      id,
      name,
      path,
      default_branch AS defaultBranch,
      added_at AS addedAt,
      last_scanned_at AS lastScannedAt
    FROM repositories
    ORDER BY name COLLATE NOCASE
  `).all() as unknown as RepositoryRecord[];
}

export function findRepository(db: CommitQuestDatabase, selector: string): RepositoryRecord | null {
  const row = db.prepare(`
    SELECT
      id,
      name,
      path,
      default_branch AS defaultBranch,
      added_at AS addedAt,
      last_scanned_at AS lastScannedAt
    FROM repositories
    WHERE name = ? COLLATE NOCASE OR path = ?
    LIMIT 1
  `).get(selector, selector) as RepositoryRecord | undefined;
  return row ?? null;
}

export function addRepository(
  db: CommitQuestDatabase,
  input: { name: string; path: string; defaultBranch: string | null }
): RepositoryRecord {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO repositories(name, path, default_branch, added_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      name = excluded.name,
      default_branch = excluded.default_branch
  `).run(input.name, input.path, input.defaultBranch, now);

  return findRepository(db, input.path)!;
}

export function commitExists(db: CommitQuestDatabase, repositoryId: number, hash: string): boolean {
  const row = db.prepare("SELECT 1 AS found FROM commits WHERE repository_id = ? AND hash = ?").get(repositoryId, hash);
  return Boolean(row);
}

export function insertCommit(
  db: CommitQuestDatabase,
  repositoryId: number,
  commit: GitCommit,
  awardedXp: number,
  questEligible: boolean
): void {
  db.prepare(`
    INSERT OR IGNORE INTO commits(
      repository_id, hash, author_name, author_email, authored_at, subject,
      type, files_changed, insertions, deletions, base_xp, awarded_xp, imported_at, quest_eligible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    repositoryId,
    commit.hash,
    commit.authorName,
    commit.authorEmail,
    commit.authoredAt,
    commit.subject,
    commit.type,
    commit.filesChanged,
    commit.insertions,
    commit.deletions,
    commit.baseXp,
    awardedXp,
    new Date().toISOString(),
    questEligible ? 1 : 0
  );
}

export function markRepositoryScanned(db: CommitQuestDatabase, repositoryId: number): void {
  db.prepare("UPDATE repositories SET last_scanned_at = ? WHERE id = ?")
    .run(new Date().toISOString(), repositoryId);
}

export function getDailyCommitRewardStats(
  db: CommitQuestDatabase,
  startIso: string,
  endIso: string
): { count: number; xp: number } {
  const row = db.prepare(`
    SELECT COUNT(*) AS count, COALESCE(SUM(awarded_xp), 0) AS xp
    FROM commits
    WHERE authored_at >= ? AND authored_at < ?
  `).get(startIso, endIso) as { count: number; xp: number };
  return row;
}

export function totalXp(db: CommitQuestDatabase): number {
  const row = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(awarded_xp), 0) FROM commits) +
      (SELECT COALESCE(SUM(xp), 0) FROM tags) +
      (SELECT COALESCE(SUM(reward_xp), 0) FROM quest_rewards) +
      (SELECT COALESCE(SUM(reward_xp), 0) FROM achievements) AS total
  `).get() as { total: number };
  return row.total;
}

export function databaseStats(db: CommitQuestDatabase): {
  commits: number;
  repositories: number;
  tags: number;
  questRewards: number;
  achievements: number;
} {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM commits) AS commits,
      (SELECT COUNT(*) FROM repositories) AS repositories,
      (SELECT COUNT(*) FROM tags) AS tags,
      (SELECT COUNT(*) FROM quest_rewards) AS questRewards,
      (SELECT COUNT(*) FROM achievements) AS achievements
  `).get() as {
    commits: number;
    repositories: number;
    tags: number;
    questRewards: number;
    achievements: number;
  };
}


export function countQuestActivity(
  db: CommitQuestDatabase,
  objectiveType: CustomQuestObjective,
  repositoryId: number | null,
  beforeIso: string | null = null
): number {
  if (objectiveType === "manual") return 0;

  const conditions = ["quest_eligible = 1"];
  const params: Array<string | number> = [];

  if (repositoryId !== null) {
    conditions.push("repository_id = ?");
    params.push(repositoryId);
  }

  if (objectiveType === "release") {
    if (beforeIso !== null) {
      conditions.push("tagged_at <= ?");
      params.push(beforeIso);
    }
    const row = db.prepare(`
      SELECT COUNT(*) AS count
      FROM tags
      WHERE ${conditions.join(" AND ")}
    `).get(...params) as { count: number };
    return row.count;
  }

  if (objectiveType !== "commit") {
    conditions.push("type = ?");
    params.push(objectiveType);
  }
  if (beforeIso !== null) {
    conditions.push("authored_at <= ?");
    params.push(beforeIso);
  }

  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM commits
    WHERE ${conditions.join(" AND ")}
  `).get(...params) as { count: number };
  return row.count;
}

function mapCustomQuest(row: Record<string, unknown>): CustomQuestRecord {
  return {
    id: Number(row.id),
    title: String(row.title),
    repositoryId: row.repositoryId === null ? null : Number(row.repositoryId),
    repositoryName: row.repositoryName === null ? null : String(row.repositoryName),
    objectiveType: String(row.objectiveType) as CustomQuestObjective,
    target: Number(row.target),
    rewardXp: Number(row.rewardXp),
    baselineCount: Number(row.baselineCount),
    createdAt: String(row.createdAt),
    deadlineAt: row.deadlineAt === null ? null : String(row.deadlineAt),
    completedAt: row.completedAt === null ? null : String(row.completedAt),
    abandonedAt: row.abandonedAt === null ? null : String(row.abandonedAt)
  };
}

const CUSTOM_QUEST_SELECT = `
  SELECT
    q.id,
    q.title,
    q.repository_id AS repositoryId,
    r.name AS repositoryName,
    q.objective_type AS objectiveType,
    q.target,
    q.reward_xp AS rewardXp,
    q.baseline_count AS baselineCount,
    q.created_at AS createdAt,
    q.deadline_at AS deadlineAt,
    q.completed_at AS completedAt,
    q.abandoned_at AS abandonedAt
  FROM custom_quests q
  LEFT JOIN repositories r ON r.id = q.repository_id
`;

export function createCustomQuest(
  db: CommitQuestDatabase,
  input: {
    title: string;
    repositoryId: number | null;
    objectiveType: CustomQuestObjective;
    target: number;
    rewardXp: number;
    deadlineAt: string | null;
  }
): CustomQuestRecord {
  const baselineCount = countQuestActivity(db, input.objectiveType, input.repositoryId);
  const result = db.prepare(`
    INSERT INTO custom_quests(
      title, repository_id, objective_type, target, reward_xp,
      baseline_count, created_at, deadline_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.title,
    input.repositoryId,
    input.objectiveType,
    input.target,
    input.rewardXp,
    baselineCount,
    new Date().toISOString(),
    input.deadlineAt
  );

  return getCustomQuest(db, Number(result.lastInsertRowid))!;
}

export function getCustomQuest(db: CommitQuestDatabase, id: number): CustomQuestRecord | null {
  const row = db.prepare(`${CUSTOM_QUEST_SELECT} WHERE q.id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapCustomQuest(row) : null;
}

export function listCustomQuests(db: CommitQuestDatabase): CustomQuestRecord[] {
  const rows = db.prepare(`${CUSTOM_QUEST_SELECT} ORDER BY q.created_at DESC, q.id DESC`).all() as Array<Record<string, unknown>>;
  return rows.map(mapCustomQuest);
}

export function markCustomQuestCompleted(db: CommitQuestDatabase, id: number, completedAt: string): boolean {
  const result = db.prepare(`
    UPDATE custom_quests
    SET completed_at = ?
    WHERE id = ? AND completed_at IS NULL AND abandoned_at IS NULL
  `).run(completedAt, id);
  return result.changes > 0;
}

export function abandonCustomQuest(db: CommitQuestDatabase, id: number, abandonedAt: string): boolean {
  const result = db.prepare(`
    UPDATE custom_quests
    SET abandoned_at = ?
    WHERE id = ? AND completed_at IS NULL AND abandoned_at IS NULL
  `).run(abandonedAt, id);
  return result.changes > 0;
}
