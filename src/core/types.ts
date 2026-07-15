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
