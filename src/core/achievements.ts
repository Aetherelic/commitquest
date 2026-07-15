import type { CommitQuestDatabase } from "../data/database.js";
import type { AchievementDefinition, AchievementState } from "./types.js";
import { calculateStreak } from "./streak.js";

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "first-commit",
    title: "The Quest Begins",
    description: "Import your first commit.",
    rewardXp: 50
  },
  {
    key: "bug-hunter",
    title: "Bug Hunter",
    description: "Land ten fix commits.",
    rewardXp: 100
  },
  {
    key: "documentation-matters",
    title: "Documentation Matters",
    description: "Land ten documentation commits.",
    rewardXp: 100
  },
  {
    key: "test-warden",
    title: "Test Warden",
    description: "Land ten test commits.",
    rewardXp: 100
  },
  {
    key: "ship-it",
    title: "Ship It",
    description: "Create your first tagged release.",
    rewardXp: 150
  },
  {
    key: "on-a-roll",
    title: "On a Roll",
    description: "Maintain a seven-day coding streak.",
    rewardXp: 200
  },
  {
    key: "night-coder",
    title: "Night Coder",
    description: "Commit between midnight and 5 a.m.",
    rewardXp: 75
  },
  {
    key: "back-from-the-dead",
    title: "Back From the Dead",
    description: "Return to a repository after at least 90 days.",
    rewardXp: 150
  }
];

function scalar(db: CommitQuestDatabase, query: string, ...params: Array<string | number | bigint | null>): number {
  const row = db.prepare(query).get(...params) as { value: number };
  return row.value;
}

function hasNightCommit(db: CommitQuestDatabase): boolean {
  const rows = db.prepare("SELECT authored_at AS authoredAt FROM commits").all() as Array<{ authoredAt: string }>;
  return rows.some(({ authoredAt }) => {
    const match = authoredAt.match(/T(\d{2}):/);
    const hour = match ? Number(match[1]) : 12;
    return hour >= 0 && hour < 5;
  });
}

function hasRevivedRepository(db: CommitQuestDatabase): boolean {
  const rows = db.prepare(`
    SELECT repository_id AS repositoryId, authored_at AS authoredAt
    FROM commits
    ORDER BY repository_id, authored_at
  `).all() as Array<{ repositoryId: number; authoredAt: string }>;

  const previousByRepository = new Map<number, Date>();
  for (const row of rows) {
    const current = new Date(row.authoredAt);
    const previous = previousByRepository.get(row.repositoryId);
    if (previous && current.getTime() - previous.getTime() >= 90 * 86400000) return true;
    previousByRepository.set(row.repositoryId, current);
  }
  return false;
}

function achievementConditions(db: CommitQuestDatabase): Record<string, boolean> {
  const commitDates = db.prepare("SELECT authored_at AS authoredAt FROM commits").all() as Array<{ authoredAt: string }>;
  const streak = calculateStreak(commitDates.map((row) => row.authoredAt));

  return {
    "first-commit": scalar(db, "SELECT COUNT(*) AS value FROM commits") >= 1,
    "bug-hunter": scalar(db, "SELECT COUNT(*) AS value FROM commits WHERE type = ?", "fix") >= 10,
    "documentation-matters": scalar(db, "SELECT COUNT(*) AS value FROM commits WHERE type = ?", "docs") >= 10,
    "test-warden": scalar(db, "SELECT COUNT(*) AS value FROM commits WHERE type = ?", "test") >= 10,
    "ship-it": scalar(db, "SELECT COUNT(*) AS value FROM tags") >= 1,
    "on-a-roll": streak.longest >= 7,
    "night-coder": hasNightCommit(db),
    "back-from-the-dead": hasRevivedRepository(db)
  };
}

export function syncAchievements(db: CommitQuestDatabase, now = new Date()): AchievementDefinition[] {
  const conditions = achievementConditions(db);
  const unlocked: AchievementDefinition[] = [];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO achievements(achievement_key, title, reward_xp, unlocked_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const achievement of ACHIEVEMENTS) {
    if (!conditions[achievement.key]) continue;
    const result = insert.run(achievement.key, achievement.title, achievement.rewardXp, now.toISOString());
    if (result.changes > 0) unlocked.push(achievement);
  }

  return unlocked;
}

export function achievementStates(db: CommitQuestDatabase): AchievementState[] {
  const rows = db.prepare(`
    SELECT achievement_key AS achievementKey, unlocked_at AS unlockedAt
    FROM achievements
  `).all() as Array<{ achievementKey: string; unlockedAt: string }>;
  const unlocked = new Map(rows.map((row) => [row.achievementKey, row.unlockedAt]));

  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    unlocked: unlocked.has(achievement.key),
    unlockedAt: unlocked.get(achievement.key) ?? null
  }));
}
