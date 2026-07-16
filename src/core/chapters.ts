import {
  chapterActivityCount,
  createChapter,
  listChapters,
  markChapterCompleted,
  type CommitQuestDatabase
} from "../data/database.js";
import type { ChapterObjective, ChapterRecord, ChapterState, RepositoryRecord } from "./types.js";

interface ChapterTemplate {
  key: string;
  title: string;
  description: string;
  objectiveType: ChapterObjective;
  target: number;
  rewardXp: number;
}

export const DEFAULT_CHAPTERS: ChapterTemplate[] = [
  {
    key: "foundation",
    title: "The First Quest",
    description: "Begin the campaign with a rewarded commit.",
    objectiveType: "commit",
    target: 1,
    rewardXp: 50
  },
  {
    key: "momentum",
    title: "Gathering Momentum",
    description: "Build a meaningful body of work across ten commits.",
    objectiveType: "commit",
    target: 10,
    rewardXp: 100
  },
  {
    key: "questmaster",
    title: "The Questmaster's Ledger",
    description: "Complete three campaign-specific custom quests.",
    objectiveType: "quest",
    target: 3,
    rewardXp: 150
  },
  {
    key: "first-release",
    title: "Face the First Boss",
    description: "Ship the campaign's first tagged release.",
    objectiveType: "release",
    target: 1,
    rewardXp: 250
  },
  {
    key: "legacy",
    title: "A Lasting Campaign",
    description: "Reach fifty rewarded commits in one campaign.",
    objectiveType: "commit",
    target: 50,
    rewardXp: 400
  }
];

export function ensureDefaultChapters(db: CommitQuestDatabase, repository: RepositoryRecord): ChapterRecord[] {
  DEFAULT_CHAPTERS.forEach((template, index) => {
    createChapter(db, {
      repositoryId: repository.id,
      key: template.key,
      title: template.title,
      description: template.description,
      position: index + 1,
      objectiveType: template.objectiveType,
      target: template.target,
      rewardXp: template.rewardXp,
      baselineCount: 0
    });
  });
  return listChapters(db, repository.id);
}

function rewardChapter(db: CommitQuestDatabase, chapter: ChapterRecord, awardedAt: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO quest_rewards(quest_key, title, reward_xp, awarded_at)
    VALUES (?, ?, ?, ?)
  `).run(`chapter-${chapter.id}`, chapter.title, chapter.rewardXp, awardedAt);
}

export function chapterStates(
  db: CommitQuestDatabase,
  repositoryId?: number,
  now = new Date()
): ChapterState[] {
  const records = listChapters(db, repositoryId);
  const grouped = new Map<number, ChapterRecord[]>();
  for (const record of records) {
    const group = grouped.get(record.repositoryId) ?? [];
    group.push(record);
    grouped.set(record.repositoryId, group);
  }

  const result: ChapterState[] = [];
  for (const group of grouped.values()) {
    let priorComplete = true;
    for (const record of group.sort((a, b) => a.position - b.position)) {
      const count = chapterActivityCount(db, record.repositoryId, record.objectiveType);
      const progress = record.objectiveType === "manual"
        ? record.completedAt ? record.target : 0
        : Math.max(0, Math.min(record.target, count - record.baselineCount));
      const reached = record.completedAt !== null || progress >= record.target;
      if (reached && record.completedAt === null && priorComplete) {
        const completedAt = now.toISOString();
        markChapterCompleted(db, record.id, completedAt);
        rewardChapter(db, record, completedAt);
        record.completedAt = completedAt;
      }
      const complete = record.completedAt !== null;
      const status = complete ? "complete" : priorComplete ? "active" : "locked";
      result.push({ ...record, progress, status });
      priorComplete = complete;
    }
  }
  return result;
}

export function syncCampaignChapters(
  db: CommitQuestDatabase,
  repositories: RepositoryRecord[],
  now = new Date()
): ChapterState[] {
  for (const repository of repositories) ensureDefaultChapters(db, repository);
  return chapterStates(db, undefined, now);
}
