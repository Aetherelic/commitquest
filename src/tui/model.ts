import {
  databaseStats,
  getMeta,
  listRepositories,
  openDatabase,
  setMeta,
  totalXp,
  type CommitQuestDatabase
} from "../data/database.js";
import { getProfile } from "../core/profile.js";
import { calculateLevel } from "../core/levels.js";
import { calculateStreak } from "../core/streak.js";
import { isQuestRewarded, syncQuestRewards } from "../core/quests.js";
import { achievementStates, syncAchievements } from "../core/achievements.js";
import { syncCustomQuestRewards } from "../core/custom-quests.js";
import { scanRepositories, type ScanSummary } from "../core/scan.js";
import type {
  TuiActivity,
  TuiCampaign,
  TuiCommitTypeStat,
  TuiDailyXp,
  TuiModel,
  TuiRewardModal
} from "./types.js";

interface LoadOptions {
  scan?: boolean;
  now?: Date;
}

interface RewardEvent {
  kind: "commit" | "release" | "quest" | "achievement";
  title: string;
  rewardXp: number;
  occurredAt: string;
}

const REWARD_CURSOR_KEY = "tui-reward-cursor-v1";

function rewardEventsSince(db: CommitQuestDatabase, sinceIso: string): RewardEvent[] {
  return db.prepare(`
    SELECT kind, title, rewardXp, occurredAt
    FROM (
      SELECT
        'commit' AS kind,
        subject AS title,
        awarded_xp AS rewardXp,
        imported_at AS occurredAt
      FROM commits
      WHERE imported_at > ?
      UNION ALL
      SELECT
        'release' AS kind,
        'Released ' || name AS title,
        xp AS rewardXp,
        imported_at AS occurredAt
      FROM tags
      WHERE imported_at > ?
      UNION ALL
      SELECT
        'quest' AS kind,
        title,
        reward_xp AS rewardXp,
        awarded_at AS occurredAt
      FROM quest_rewards
      WHERE awarded_at > ?
      UNION ALL
      SELECT
        'achievement' AS kind,
        title,
        reward_xp AS rewardXp,
        unlocked_at AS occurredAt
      FROM achievements
      WHERE unlocked_at > ?
    )
    ORDER BY occurredAt ASC
  `).all(sinceIso, sinceIso, sinceIso, sinceIso) as unknown as RewardEvent[];
}

function rewardModal(events: RewardEvent[], seenThrough: string): TuiRewardModal | null {
  if (events.length === 0) return null;
  const lines = events.slice(-6).map((event) => {
    if (event.kind === "quest") return `Quest complete · ${event.title} · +${event.rewardXp} XP`;
    if (event.kind === "achievement") return `Badge unlocked · ${event.title} · +${event.rewardXp} XP`;
    if (event.kind === "release") return `${event.title} · +${event.rewardXp} XP`;
    return `+${event.rewardXp} XP  ${event.title}`;
  });
  if (events.length > lines.length) lines.unshift(`+${events.length - lines.length} earlier rewards`);
  const totalXp = events.reduce((sum, event) => sum + event.rewardXp, 0);
  const hasAchievement = events.some((event) => event.kind === "achievement");
  const hasQuest = events.some((event) => event.kind === "quest");
  return {
    eyebrow: hasAchievement ? "ACHIEVEMENT UNLOCKED" : hasQuest ? "QUEST COMPLETE" : "JOURNEY UPDATED",
    title: totalXp > 0 ? `+${totalXp} XP earned` : "New journey activity",
    lines,
    totalXp,
    seenThrough
  };
}

export function acknowledgeTuiRewards(seenThrough: string): void {
  const db = openDatabase();
  try {
    setMeta(db, REWARD_CURSOR_KEY, seenThrough);
  } finally {
    db.close();
  }
}

function emptySummary(): ScanSummary {
  return {
    repositories: 0,
    importedCommits: 0,
    importedCommitDetails: [],
    ignoredCommits: 0,
    importedTags: 0,
    historicalCommits: 0,
    historicalTags: 0,
    earnedXp: 0
  };
}

function mergeSummary(target: ScanSummary, next: ScanSummary): void {
  target.repositories += next.repositories;
  target.importedCommits += next.importedCommits;
  target.importedCommitDetails.push(...next.importedCommitDetails);
  target.ignoredCommits += next.ignoredCommits;
  target.importedTags += next.importedTags;
  target.historicalCommits += next.historicalCommits;
  target.historicalTags += next.historicalTags;
  target.earnedXp += next.earnedXp;
}

function runSafeScan(db: CommitQuestDatabase, profileEmail: string): {
  summary: ScanSummary;
  warnings: string[];
} {
  const summary = emptySummary();
  const warnings: string[] = [];
  const repositories = listRepositories(db, false);

  if (!profileEmail) {
    if (repositories.length > 0) warnings.push("Set a profile email before automatic scans can award XP.");
    return { summary, warnings };
  }

  for (const repository of repositories) {
    try {
      mergeSummary(summary, scanRepositories(db, [repository], profileEmail));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      warnings.push(`${repository.name}: ${reason}`);
    }
  }

  return { summary, warnings };
}

function campaigns(db: CommitQuestDatabase): TuiCampaign[] {
  const rows = db.prepare(`
    SELECT
      r.id,
      r.name,
      r.path,
      r.default_branch AS defaultBranch,
      r.added_at AS addedAt,
      r.last_scanned_at AS lastScannedAt,
      r.archived AS archived,
      (SELECT COUNT(*) FROM commits c WHERE c.repository_id = r.id) AS commits,
      (SELECT COUNT(*) FROM tags t WHERE t.repository_id = r.id) AS releases,
      (SELECT COALESCE(SUM(c.awarded_xp), 0) FROM commits c WHERE c.repository_id = r.id)
        + (SELECT COALESCE(SUM(t.xp), 0) FROM tags t WHERE t.repository_id = r.id) AS earnedXp,
      (SELECT MAX(value) FROM (
        SELECT MAX(c.authored_at) AS value FROM commits c WHERE c.repository_id = r.id
        UNION ALL
        SELECT MAX(t.tagged_at) AS value FROM tags t WHERE t.repository_id = r.id
      )) AS lastActivityAt
    FROM repositories r
    ORDER BY r.archived ASC, COALESCE(lastActivityAt, r.added_at) DESC, r.name COLLATE NOCASE
  `).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    path: String(row.path),
    defaultBranch: row.defaultBranch === null ? null : String(row.defaultBranch),
    addedAt: String(row.addedAt),
    lastScannedAt: row.lastScannedAt === null ? null : String(row.lastScannedAt),
    archived: Number(row.archived ?? 0) === 1,
    commits: Number(row.commits),
    releases: Number(row.releases),
    earnedXp: Number(row.earnedXp),
    lastActivityAt: row.lastActivityAt === null ? null : String(row.lastActivityAt)
  }));
}

function recentActivity(db: CommitQuestDatabase): TuiActivity[] {
  return db.prepare(`
    SELECT kind, repositoryName, occurredAt, subject, type, awardedXp, reference
    FROM (
      SELECT
        'commit' AS kind,
        r.name AS repositoryName,
        c.authored_at AS occurredAt,
        c.subject AS subject,
        c.type AS type,
        c.awarded_xp AS awardedXp,
        c.hash AS reference
      FROM commits c
      JOIN repositories r ON r.id = c.repository_id
      UNION ALL
      SELECT
        'release' AS kind,
        r.name AS repositoryName,
        t.tagged_at AS occurredAt,
        'Released ' || t.name AS subject,
        'release' AS type,
        t.xp AS awardedXp,
        t.name AS reference
      FROM tags t
      JOIN repositories r ON r.id = t.repository_id
    )
    ORDER BY occurredAt DESC
    LIMIT 40
  `).all() as unknown as TuiActivity[];
}

function commitTypeStats(db: CommitQuestDatabase): TuiCommitTypeStat[] {
  return db.prepare(`
    SELECT type, COUNT(*) AS count, COALESCE(SUM(awarded_xp), 0) AS xp
    FROM commits
    GROUP BY type
    ORDER BY count DESC, type ASC
  `).all() as unknown as TuiCommitTypeStat[];
}

function dailyXp(db: CommitQuestDatabase): TuiDailyXp[] {
  return db.prepare(`
    SELECT date, SUM(xp) AS xp
    FROM (
      SELECT substr(authored_at, 1, 10) AS date, awarded_xp AS xp FROM commits
      UNION ALL
      SELECT substr(tagged_at, 1, 10) AS date, xp FROM tags
      UNION ALL
      SELECT substr(awarded_at, 1, 10) AS date, reward_xp AS xp FROM quest_rewards
      UNION ALL
      SELECT substr(unlocked_at, 1, 10) AS date, reward_xp AS xp FROM achievements
    )
    GROUP BY date
    ORDER BY date DESC
    LIMIT 14
  `).all() as unknown as TuiDailyXp[];
}

function scanNotice(summary: ScanSummary): string | null {
  if (summary.importedCommits === 0 && summary.importedTags === 0) return null;
  const pieces = [
    `${summary.importedCommits} new commit${summary.importedCommits === 1 ? "" : "s"}`,
    `${summary.importedTags} new release${summary.importedTags === 1 ? "" : "s"}`,
    `+${summary.earnedXp} activity XP`
  ];
  return `Journey refreshed · ${pieces.join(" · ")}`;
}

export function loadTuiModel(options: LoadOptions = {}): TuiModel {
  const now = options.now ?? new Date();
  const db = openDatabase();

  try {
    const profile = getProfile(db);
    const existingCursor = getMeta(db, REWARD_CURSOR_KEY);
    const baseline = existingCursor ?? new Date(now.getTime() - 1).toISOString();
    const scanResult = options.scan ? runSafeScan(db, profile.email) : { summary: emptySummary(), warnings: [] };
    const quests = syncQuestRewards(db, now);
    const customQuests = syncCustomQuestRewards(db, now);
    syncAchievements(db, now);
    const seenThrough = now.toISOString();
    const pendingRewardModal = rewardModal(rewardEventsSince(db, baseline), seenThrough);
    if (!existingCursor && !pendingRewardModal) setMeta(db, REWARD_CURSOR_KEY, seenThrough);

    const stats = databaseStats(db);
    const xp = totalXp(db);
    const commitDates = db.prepare("SELECT authored_at AS authoredAt FROM commits").all() as Array<{ authoredAt: string }>;

    return {
      profile,
      level: calculateLevel(xp),
      totalXp: xp,
      streak: calculateStreak(commitDates.map((row) => row.authoredAt), now),
      stats: {
        commits: stats.commits,
        repositories: stats.repositories,
        releases: stats.tags,
        questRewards: stats.questRewards,
        achievements: stats.achievements
      },
      quests,
      rewardedQuestKeys: new Set(
        quests.filter((quest) => isQuestRewarded(db, quest.key)).map((quest) => quest.key)
      ),
      customQuests,
      achievements: achievementStates(db),
      campaigns: campaigns(db),
      recentActivity: recentActivity(db),
      commitTypes: commitTypeStats(db),
      dailyXp: dailyXp(db),
      rewardModal: pendingRewardModal,
      notice: scanNotice(scanResult.summary),
      warnings: scanResult.warnings,
      refreshedAt: now.toISOString(),
      onboardingRequired: getMeta(db, "tui.onboarding-complete-v1") !== "true"
        && (!profile.email || stats.repositories === 0)
    };
  } finally {
    db.close();
  }
}
