import type { CommitQuestDatabase } from "../data/database.js";
import type { Quest } from "./types.js";
import { isoWeekKey, localDateKey, startOfMonth, startOfWeek } from "./dates.js";

interface CountRow {
  count: number;
}

function countCommits(db: CommitQuestDatabase, start: Date, end: Date, type?: string): number {
  const query = type
    ? "SELECT COUNT(*) AS count FROM commits WHERE authored_at >= ? AND authored_at < ? AND type = ?"
    : "SELECT COUNT(*) AS count FROM commits WHERE authored_at >= ? AND authored_at < ?";
  const params = type ? [start.toISOString(), end.toISOString(), type] : [start.toISOString(), end.toISOString()];
  const row = db.prepare(query).get(...params) as unknown as CountRow;
  return row.count;
}

function countTags(db: CommitQuestDatabase, start: Date, end: Date): number {
  const row = db.prepare(
    "SELECT COUNT(*) AS count FROM tags WHERE tagged_at >= ? AND tagged_at < ?"
  ).get(start.toISOString(), end.toISOString()) as unknown as CountRow;
  return row.count;
}

export function buildQuests(db: CommitQuestDatabase, now = new Date()): Quest[] {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekStart = startOfWeek(now);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const monthStart = startOfMonth(now);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const todayCommits = countCommits(db, todayStart, tomorrow);
  const weekCommits = countCommits(db, weekStart, nextWeek);
  const weekDocs = countCommits(db, weekStart, nextWeek, "docs");
  const weekFixes = countCommits(db, weekStart, nextWeek, "fix");
  const monthTags = countTags(db, monthStart, nextMonth);

  const dailyKey = localDateKey(now);
  const weekKey = isoWeekKey(now);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return [
    {
      key: `daily-${dailyKey}`,
      title: "First Step",
      description: "Make one meaningful commit today.",
      progress: Math.min(todayCommits, 1),
      target: 1,
      rewardXp: 25,
      complete: todayCommits >= 1,
      periodLabel: "Daily"
    },
    {
      key: `weekly-momentum-${weekKey}`,
      title: "Build Momentum",
      description: "Make five commits this week.",
      progress: Math.min(weekCommits, 5),
      target: 5,
      rewardXp: 80,
      complete: weekCommits >= 5,
      periodLabel: "Weekly"
    },
    {
      key: `weekly-docs-${weekKey}`,
      title: "Leave a Map",
      description: "Improve project documentation this week.",
      progress: Math.min(weekDocs, 1),
      target: 1,
      rewardXp: 40,
      complete: weekDocs >= 1,
      periodLabel: "Weekly"
    },
    {
      key: `weekly-fixes-${weekKey}`,
      title: "Bug Hunt",
      description: "Land two bug-fix commits this week.",
      progress: Math.min(weekFixes, 2),
      target: 2,
      rewardXp: 60,
      complete: weekFixes >= 2,
      periodLabel: "Weekly"
    },
    {
      key: `monthly-release-${monthKey}`,
      title: "Face the Boss",
      description: "Create a tagged release this month.",
      progress: Math.min(monthTags, 1),
      target: 1,
      rewardXp: 120,
      complete: monthTags >= 1,
      periodLabel: "Monthly"
    }
  ];
}

export function syncQuestRewards(db: CommitQuestDatabase, now = new Date()): Quest[] {
  const quests = buildQuests(db, now);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO quest_rewards(quest_key, title, reward_xp, awarded_at)
    VALUES (?, ?, ?, ?)
  `);

  for (const quest of quests) {
    if (quest.complete) {
      insert.run(quest.key, quest.title, quest.rewardXp, now.toISOString());
    }
  }

  return quests;
}

export function isQuestRewarded(db: CommitQuestDatabase, questKey: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM quest_rewards WHERE quest_key = ?").get(questKey));
}
