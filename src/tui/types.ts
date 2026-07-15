import type { AchievementState, CustomQuestState, Quest, RepositoryRecord } from "../core/types.js";
import type { LevelProgress } from "../core/levels.js";
import type { Profile } from "../core/profile.js";
import type { StreakResult } from "../core/streak.js";

export type TuiScreen = "home" | "quests" | "campaigns" | "achievements" | "progress" | "log";

export interface TuiCampaign extends RepositoryRecord {
  commits: number;
  releases: number;
  earnedXp: number;
  lastActivityAt: string | null;
}

export interface TuiActivity {
  kind: "commit" | "release";
  repositoryName: string;
  occurredAt: string;
  subject: string;
  type: string;
  awardedXp: number;
  reference: string;
}

export interface TuiCommitTypeStat {
  type: string;
  count: number;
  xp: number;
}

export interface TuiDailyXp {
  date: string;
  xp: number;
}

export interface TuiModel {
  profile: Profile;
  level: LevelProgress;
  totalXp: number;
  streak: StreakResult;
  stats: {
    commits: number;
    repositories: number;
    releases: number;
    questRewards: number;
    achievements: number;
  };
  quests: Quest[];
  rewardedQuestKeys: Set<string>;
  customQuests: CustomQuestState[];
  achievements: AchievementState[];
  campaigns: TuiCampaign[];
  recentActivity: TuiActivity[];
  commitTypes: TuiCommitTypeStat[];
  dailyXp: TuiDailyXp[];
  notice: string | null;
  warnings: string[];
  refreshedAt: string;
}

export interface TuiState {
  screen: TuiScreen;
  homeIndex: number;
  selected: Record<Exclude<TuiScreen, "home">, number>;
  helpOpen: boolean;
}

export interface TerminalSize {
  width: number;
  height: number;
}
