export type CommitType =
  | "feat"
  | "fix"
  | "docs"
  | "test"
  | "refactor"
  | "perf"
  | "build"
  | "ci"
  | "chore"
  | "style"
  | "revert"
  | "merge"
  | "commit";

export interface GitCommit {
  hash: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  subject: string;
  type: CommitType;
  filesChanged: number;
  insertions: number;
  deletions: number;
  baseXp: number;
}

export interface RepositoryRecord {
  id: number;
  name: string;
  path: string;
  defaultBranch: string | null;
  addedAt: string;
  lastScannedAt: string | null;
  archived: boolean;
}

export interface Quest {
  key: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  complete: boolean;
  periodLabel: string;
}


export type CustomQuestObjective =
  | "commit"
  | "feat"
  | "fix"
  | "docs"
  | "test"
  | "refactor"
  | "perf"
  | "build"
  | "ci"
  | "chore"
  | "style"
  | "revert"
  | "release"
  | "manual";

export type CustomQuestStatus = "active" | "complete" | "abandoned" | "expired";

export interface CustomQuestRecord {
  id: number;
  title: string;
  repositoryId: number | null;
  repositoryName: string | null;
  objectiveType: CustomQuestObjective;
  target: number;
  rewardXp: number;
  baselineCount: number;
  createdAt: string;
  deadlineAt: string | null;
  completedAt: string | null;
  abandonedAt: string | null;
}

export interface CustomQuestState extends CustomQuestRecord {
  progress: number;
  complete: boolean;
  status: CustomQuestStatus;
  description: string;
}

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  rewardXp: number;
}

export interface AchievementState extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt: string | null;
}

export type ChapterObjective = "commit" | "quest" | "release" | "manual";
export type ChapterStatus = "active" | "complete" | "locked";

export interface ChapterRecord {
  id: number;
  repositoryId: number;
  repositoryName: string;
  key: string;
  title: string;
  description: string;
  position: number;
  objectiveType: ChapterObjective;
  target: number;
  rewardXp: number;
  baselineCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface ChapterState extends ChapterRecord {
  progress: number;
  status: ChapterStatus;
}

export type BossBattleStatus = "preparing" | "ready" | "complete" | "abandoned";

export interface BossBattleRecord {
  id: number;
  repositoryId: number;
  repositoryName: string;
  version: string;
  status: BossBattleStatus;
  testCommand: string | null;
  releaseTag: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type PlayerClassId = "architect" | "artificer" | "sentinel" | "maintainer" | "explorer";

export interface PlayerClassDefinition {
  id: PlayerClassId;
  title: string;
  description: string;
  affinityTypes: CommitType[];
  skillTitles: Array<{ level: number; title: string; description: string }>;
}

export interface PlayerClassState extends PlayerClassDefinition {
  selected: boolean;
  classXp: number;
  classLevel: number;
  nextSkillAt: number | null;
  unlockedSkills: Array<{ level: number; title: string; description: string }>;
}
