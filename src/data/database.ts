import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getBackupDirectory, getDataDirectory, getDatabasePath } from "./paths.js";
import type {
  BossBattleRecord,
  ChapterObjective,
  ChapterRecord,
  CustomQuestObjective,
  CustomQuestRecord,
  GitCommit,
  RepositoryRecord
} from "../core/types.js";

export type CommitQuestDatabase = DatabaseSync;

export const DATABASE_SCHEMA_VERSION = 5;

const SCHEMA = `
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
  last_scanned_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0
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

CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  chapter_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  position INTEGER NOT NULL,
  objective_type TEXT NOT NULL,
  target INTEGER NOT NULL,
  reward_xp INTEGER NOT NULL DEFAULT 0,
  baseline_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(repository_id, chapter_key)
);

CREATE INDEX IF NOT EXISTS chapters_repository_idx
  ON chapters(repository_id, position);

CREATE TABLE IF NOT EXISTS boss_battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparing',
  test_command TEXT,
  release_tag TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(repository_id, version)
);

CREATE INDEX IF NOT EXISTS boss_battles_repository_idx
  ON boss_battles(repository_id, created_at DESC);
`;

function safeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupBeforeMigration(fromVersion: number): string | null {
  const databasePath = getDatabasePath();
  if (!fs.existsSync(databasePath)) return null;
  const directory = path.join(getBackupDirectory(), `pre-migration-v${fromVersion}-to-v${DATABASE_SCHEMA_VERSION}-${safeTimestamp()}`);
  fs.mkdirSync(directory, { recursive: true });
  const files: string[] = [];
  for (const suffix of ["", "-wal", "-shm"]) {
    const source = `${databasePath}${suffix}`;
    if (fs.existsSync(source)) {
      const filename = path.basename(source);
      fs.copyFileSync(source, path.join(directory, filename));
      files.push(filename);
    }
  }
  const id = path.basename(directory);
  fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify({
    id,
    kind: "pre-migration",
    createdAt: new Date().toISOString(),
    appVersion: "unknown",
    databaseIntegrity: "not-run",
    files,
    fromVersion,
    toVersion: DATABASE_SCHEMA_VERSION
  }, null, 2)}\n`, { mode: 0o600 });
  return directory;
}

function hasColumn(db: CommitQuestDatabase, table: "repositories" | "commits" | "tags", column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

function migrateRepositoryArchive(db: CommitQuestDatabase): void {
  if (!hasColumn(db, "repositories", "archived")) {
    db.exec("ALTER TABLE repositories ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
  }
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

function validateDatabase(db: CommitQuestDatabase): void {
  const integrity = db.prepare("PRAGMA integrity_check").get() as Record<string, unknown>;
  const result = String(Object.values(integrity)[0] ?? "");
  if (result !== "ok") throw new Error(`Database integrity check failed: ${result}`);
}

export function openDatabase(): CommitQuestDatabase {
  fs.mkdirSync(getDataDirectory(), { recursive: true });
  const databasePath = getDatabasePath();
  let currentVersion = 0;
  if (fs.existsSync(databasePath)) {
    const probe = new DatabaseSync(databasePath);
    try {
      currentVersion = Number((probe.prepare("PRAGMA user_version").get() as { user_version?: number }).user_version ?? 0);
    } finally {
      probe.close();
    }
  }
  if (currentVersion < DATABASE_SCHEMA_VERSION && fs.existsSync(databasePath)) backupBeforeMigration(currentVersion);

  const db = new DatabaseSync(databasePath);
  try {
    db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
    db.exec("BEGIN IMMEDIATE");
    db.exec(SCHEMA);
    migrateRepositoryArchive(db);
    migrateQuestEligibility(db);
    reconcileQuestEligibilityPrecision(db);
    db.exec(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION}`);
    db.exec("COMMIT");
    validateDatabase(db);
    return db;
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* no active transaction */ }
    db.close();
    throw error;
  }
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

export function listRepositories(db: CommitQuestDatabase, includeArchived = true): RepositoryRecord[] {
  const rows = db.prepare(`
    SELECT
      id,
      name,
      path,
      default_branch AS defaultBranch,
      added_at AS addedAt,
      last_scanned_at AS lastScannedAt,
      archived
    FROM repositories
    ${includeArchived ? "" : "WHERE archived = 0"}
    ORDER BY archived ASC, name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;
  return rows.map(mapRepository);
}

function mapRepository(row: Record<string, unknown>): RepositoryRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    path: String(row.path),
    defaultBranch: row.defaultBranch === null ? null : String(row.defaultBranch),
    addedAt: String(row.addedAt),
    lastScannedAt: row.lastScannedAt === null ? null : String(row.lastScannedAt),
    archived: Number(row.archived ?? 0) === 1
  };
}

export function findRepository(db: CommitQuestDatabase, selector: string): RepositoryRecord | null {
  const row = db.prepare(`
    SELECT
      id,
      name,
      path,
      default_branch AS defaultBranch,
      added_at AS addedAt,
      last_scanned_at AS lastScannedAt,
      archived
    FROM repositories
    WHERE name = ? COLLATE NOCASE OR path = ?
    LIMIT 1
  `).get(selector, selector) as Record<string, unknown> | undefined;
  return row ? mapRepository(row) : null;
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
      default_branch = excluded.default_branch,
      archived = 0
  `).run(input.name, input.path, input.defaultBranch, now);

  return findRepository(db, input.path)!;
}

export function updateRepository(
  db: CommitQuestDatabase,
  id: number,
  input: { name?: string; path?: string; defaultBranch?: string | null }
): RepositoryRecord {
  const existing = db.prepare("SELECT id FROM repositories WHERE id = ?").get(id);
  if (!existing) throw new Error(`Campaign #${id} was not found.`);
  if (input.name !== undefined) db.prepare("UPDATE repositories SET name = ? WHERE id = ?").run(input.name, id);
  if (input.path !== undefined) db.prepare("UPDATE repositories SET path = ? WHERE id = ?").run(input.path, id);
  if (input.defaultBranch !== undefined) db.prepare("UPDATE repositories SET default_branch = ? WHERE id = ?").run(input.defaultBranch, id);
  const row = db.prepare(`
    SELECT id, name, path, default_branch AS defaultBranch, added_at AS addedAt,
      last_scanned_at AS lastScannedAt, archived
    FROM repositories WHERE id = ?
  `).get(id) as Record<string, unknown>;
  return mapRepository(row);
}

export function setRepositoryArchived(db: CommitQuestDatabase, id: number, archived: boolean): boolean {
  const result = db.prepare("UPDATE repositories SET archived = ? WHERE id = ?")
    .run(archived ? 1 : 0, id);
  return result.changes > 0;
}

export function removeRepository(db: CommitQuestDatabase, id: number): boolean {
  const result = db.prepare("DELETE FROM repositories WHERE id = ?").run(id);
  return result.changes > 0;
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

export function updateCustomQuest(
  db: CommitQuestDatabase,
  id: number,
  input: {
    title: string;
    repositoryId: number | null;
    objectiveType: CustomQuestObjective;
    target: number;
    rewardXp: number;
    deadlineAt: string | null;
  }
): CustomQuestRecord {
  const current = getCustomQuest(db, id);
  if (!current) throw new Error(`Custom quest #${id} was not found.`);
  if (current.completedAt || current.abandonedAt) {
    throw new Error("Only active custom quests can be edited.");
  }
  const changedObjective = current.repositoryId !== input.repositoryId || current.objectiveType !== input.objectiveType;
  const baseline = changedObjective
    ? countQuestActivity(db, input.objectiveType, input.repositoryId)
    : current.baselineCount;
  db.prepare(`
    UPDATE custom_quests
    SET title = ?, repository_id = ?, objective_type = ?, target = ?, reward_xp = ?,
        deadline_at = ?, baseline_count = ?
    WHERE id = ?
  `).run(
    input.title,
    input.repositoryId,
    input.objectiveType,
    input.target,
    input.rewardXp,
    input.deadlineAt,
    baseline,
    id
  );
  return getCustomQuest(db, id)!;
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

function mapChapter(row: Record<string, unknown>): ChapterRecord {
  return {
    id: Number(row.id),
    repositoryId: Number(row.repositoryId),
    repositoryName: String(row.repositoryName),
    key: String(row.key),
    title: String(row.title),
    description: String(row.description),
    position: Number(row.position),
    objectiveType: String(row.objectiveType) as ChapterObjective,
    target: Number(row.target),
    rewardXp: Number(row.rewardXp),
    baselineCount: Number(row.baselineCount),
    createdAt: String(row.createdAt),
    completedAt: row.completedAt === null ? null : String(row.completedAt)
  };
}

const CHAPTER_SELECT = `
  SELECT
    c.id,
    c.repository_id AS repositoryId,
    r.name AS repositoryName,
    c.chapter_key AS key,
    c.title,
    c.description,
    c.position,
    c.objective_type AS objectiveType,
    c.target,
    c.reward_xp AS rewardXp,
    c.baseline_count AS baselineCount,
    c.created_at AS createdAt,
    c.completed_at AS completedAt
  FROM chapters c
  JOIN repositories r ON r.id = c.repository_id
`;

export function listChapters(db: CommitQuestDatabase, repositoryId?: number): ChapterRecord[] {
  const rows = repositoryId === undefined
    ? db.prepare(`${CHAPTER_SELECT} ORDER BY r.name COLLATE NOCASE, c.position`).all()
    : db.prepare(`${CHAPTER_SELECT} WHERE c.repository_id = ? ORDER BY c.position`).all(repositoryId);
  return (rows as Array<Record<string, unknown>>).map(mapChapter);
}

export function getChapter(db: CommitQuestDatabase, id: number): ChapterRecord | null {
  const row = db.prepare(`${CHAPTER_SELECT} WHERE c.id = ?`).get(id) as Record<string, unknown> | undefined;
  return row ? mapChapter(row) : null;
}

export function createChapter(
  db: CommitQuestDatabase,
  input: {
    repositoryId: number;
    key: string;
    title: string;
    description: string;
    position: number;
    objectiveType: ChapterObjective;
    target: number;
    rewardXp: number;
    baselineCount: number;
  }
): ChapterRecord {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO chapters(
      repository_id, chapter_key, title, description, position,
      objective_type, target, reward_xp, baseline_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(repository_id, chapter_key) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      position = excluded.position,
      objective_type = excluded.objective_type,
      target = excluded.target,
      reward_xp = excluded.reward_xp
  `).run(
    input.repositoryId,
    input.key,
    input.title,
    input.description,
    input.position,
    input.objectiveType,
    input.target,
    input.rewardXp,
    input.baselineCount,
    now
  );
  const row = db.prepare(`${CHAPTER_SELECT} WHERE c.repository_id = ? AND c.chapter_key = ?`)
    .get(input.repositoryId, input.key) as Record<string, unknown>;
  return mapChapter(row);
}

export function markChapterCompleted(db: CommitQuestDatabase, id: number, completedAt: string): boolean {
  const result = db.prepare(`
    UPDATE chapters SET completed_at = ?
    WHERE id = ? AND completed_at IS NULL
  `).run(completedAt, id);
  return result.changes > 0;
}

export function chapterActivityCount(
  db: CommitQuestDatabase,
  repositoryId: number,
  objectiveType: ChapterObjective
): number {
  if (objectiveType === "manual") return 0;
  if (objectiveType === "commit") {
    return Number((db.prepare("SELECT COUNT(*) AS count FROM commits WHERE repository_id = ?").get(repositoryId) as { count: number }).count);
  }
  if (objectiveType === "release") {
    return Number((db.prepare("SELECT COUNT(*) AS count FROM tags WHERE repository_id = ?").get(repositoryId) as { count: number }).count);
  }
  const row = db.prepare(`
    SELECT COUNT(*) AS count
    FROM custom_quests q
    WHERE q.repository_id = ? AND q.completed_at IS NOT NULL
  `).get(repositoryId) as { count: number };
  return Number(row.count);
}

function mapBossBattle(row: Record<string, unknown>): BossBattleRecord {
  return {
    id: Number(row.id),
    repositoryId: Number(row.repositoryId),
    repositoryName: String(row.repositoryName),
    version: String(row.version),
    status: String(row.status) as BossBattleRecord["status"],
    testCommand: row.testCommand === null ? null : String(row.testCommand),
    releaseTag: row.releaseTag === null ? null : String(row.releaseTag),
    createdAt: String(row.createdAt),
    completedAt: row.completedAt === null ? null : String(row.completedAt)
  };
}

const BOSS_SELECT = `
  SELECT
    b.id,
    b.repository_id AS repositoryId,
    r.name AS repositoryName,
    b.version,
    b.status,
    b.test_command AS testCommand,
    b.release_tag AS releaseTag,
    b.created_at AS createdAt,
    b.completed_at AS completedAt
  FROM boss_battles b
  JOIN repositories r ON r.id = b.repository_id
`;

export function listBossBattles(db: CommitQuestDatabase, repositoryId?: number): BossBattleRecord[] {
  const rows = repositoryId === undefined
    ? db.prepare(`${BOSS_SELECT} ORDER BY b.created_at DESC`).all()
    : db.prepare(`${BOSS_SELECT} WHERE b.repository_id = ? ORDER BY b.created_at DESC`).all(repositoryId);
  return (rows as Array<Record<string, unknown>>).map(mapBossBattle);
}

export function getBossBattle(db: CommitQuestDatabase, repositoryId: number, version: string): BossBattleRecord | null {
  const row = db.prepare(`${BOSS_SELECT} WHERE b.repository_id = ? AND b.version = ?`)
    .get(repositoryId, version) as Record<string, unknown> | undefined;
  return row ? mapBossBattle(row) : null;
}

export function createBossBattle(
  db: CommitQuestDatabase,
  input: { repositoryId: number; version: string; testCommand: string | null }
): BossBattleRecord {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO boss_battles(repository_id, version, status, test_command, created_at)
    VALUES (?, ?, 'preparing', ?, ?)
    ON CONFLICT(repository_id, version) DO UPDATE SET
      test_command = COALESCE(excluded.test_command, boss_battles.test_command)
  `).run(input.repositoryId, input.version, input.testCommand, now);
  return getBossBattle(db, input.repositoryId, input.version)!;
}

export function updateBossBattle(
  db: CommitQuestDatabase,
  id: number,
  input: { status?: BossBattleRecord["status"]; releaseTag?: string | null; completedAt?: string | null }
): void {
  if (input.status !== undefined) db.prepare("UPDATE boss_battles SET status = ? WHERE id = ?").run(input.status, id);
  if (input.releaseTag !== undefined) db.prepare("UPDATE boss_battles SET release_tag = ? WHERE id = ?").run(input.releaseTag, id);
  if (input.completedAt !== undefined) db.prepare("UPDATE boss_battles SET completed_at = ? WHERE id = ?").run(input.completedAt, id);
}

export function databaseIntegrity(db: CommitQuestDatabase): string {
  const row = db.prepare("PRAGMA integrity_check").get() as Record<string, unknown>;
  return String(Object.values(row)[0] ?? "unknown");
}

export function checkpointDatabase(db: CommitQuestDatabase): void {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
}
