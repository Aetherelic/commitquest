import {
  countQuestActivity,
  getCustomQuest,
  listCustomQuests,
  markCustomQuestCompleted,
  type CommitQuestDatabase
} from "../data/database.js";
import type {
  CustomQuestObjective,
  CustomQuestRecord,
  CustomQuestState
} from "./types.js";

function plural(value: number, singular: string, pluralForm = `${singular}s`): string {
  return value === 1 ? singular : pluralForm;
}

export function customQuestDescription(
  objectiveType: CustomQuestObjective,
  target: number,
  repositoryName: string | null
): string {
  const scope = repositoryName ? ` in ${repositoryName}` : " across all campaigns";

  switch (objectiveType) {
    case "commit":
      return `Land ${target} ${plural(target, "commit")}${scope}.`;
    case "release":
      return `Create ${target} tagged ${plural(target, "release")}${scope}.`;
    case "manual":
      return "Complete this milestone manually when the work is genuinely finished.";
    default:
      return `Land ${target} ${objectiveType} ${plural(target, "commit")}${scope}.`;
  }
}

export function buildCustomQuestState(
  db: CommitQuestDatabase,
  quest: CustomQuestRecord,
  now = new Date()
): CustomQuestState {
  const currentCount = countQuestActivity(
    db,
    quest.objectiveType,
    quest.repositoryId,
    quest.deadlineAt
  );
  const automaticProgress = Math.max(0, currentCount - quest.baselineCount);
  const progress = quest.objectiveType === "manual"
    ? quest.completedAt ? 1 : 0
    : Math.min(automaticProgress, quest.target);

  const reachedTarget = quest.objectiveType !== "manual" && automaticProgress >= quest.target;
  const complete = quest.completedAt !== null || reachedTarget;
  const expired = quest.deadlineAt !== null
    && now.getTime() > new Date(quest.deadlineAt).getTime()
    && !complete;

  const status = quest.abandonedAt !== null
    ? "abandoned"
    : complete
      ? "complete"
      : expired
        ? "expired"
        : "active";

  return {
    ...quest,
    progress,
    complete,
    status,
    description: customQuestDescription(quest.objectiveType, quest.target, quest.repositoryName)
  };
}

function insertReward(db: CommitQuestDatabase, quest: CustomQuestRecord, awardedAt: string): void {
  db.prepare(`
    INSERT OR IGNORE INTO quest_rewards(quest_key, title, reward_xp, awarded_at)
    VALUES (?, ?, ?, ?)
  `).run(`custom-${quest.id}`, quest.title, quest.rewardXp, awardedAt);
}

export function syncCustomQuestRewards(
  db: CommitQuestDatabase,
  now = new Date()
): CustomQuestState[] {
  const awardedAt = now.toISOString();
  const records = listCustomQuests(db);

  for (const record of records) {
    if (record.abandonedAt !== null) continue;
    const state = buildCustomQuestState(db, record, now);
    if (!state.complete) continue;

    if (record.completedAt === null) {
      markCustomQuestCompleted(db, record.id, awardedAt);
    }
    insertReward(db, record, record.completedAt ?? awardedAt);
  }

  return listCustomQuests(db).map((quest) => buildCustomQuestState(db, quest, now));
}

export function customQuestStates(
  db: CommitQuestDatabase,
  now = new Date()
): CustomQuestState[] {
  return listCustomQuests(db).map((quest) => buildCustomQuestState(db, quest, now));
}

export function completeManualCustomQuest(
  db: CommitQuestDatabase,
  id: number,
  now = new Date()
): CustomQuestState {
  const quest = getCustomQuest(db, id);
  if (!quest) throw new Error(`Custom quest #${id} was not found.`);
  if (quest.objectiveType !== "manual") {
    throw new Error("Only manual quests can be completed manually. Automatic quests advance through Git activity.");
  }
  if (quest.abandonedAt !== null) throw new Error(`Custom quest #${id} has been abandoned.`);
  if (quest.completedAt !== null) return buildCustomQuestState(db, quest, now);
  if (quest.deadlineAt !== null && now.getTime() > new Date(quest.deadlineAt).getTime()) {
    throw new Error(`Custom quest #${id} has expired.`);
  }

  const completedAt = now.toISOString();
  markCustomQuestCompleted(db, id, completedAt);
  insertReward(db, quest, completedAt);
  return buildCustomQuestState(db, getCustomQuest(db, id)!, now);
}

export function customQuestRewarded(db: CommitQuestDatabase, id: number): boolean {
  return Boolean(db.prepare("SELECT 1 FROM quest_rewards WHERE quest_key = ?").get(`custom-${id}`));
}
