import type { AchievementState, BossBattleRecord, ChapterState, CustomQuestObjective, CustomQuestState, PlayerClassState, Quest, RepositoryRecord } from "../core/types.js";
import type { LevelProgress } from "../core/levels.js";
import type { Profile } from "../core/profile.js";
import type { StreakResult } from "../core/streak.js";

export type TuiScreen = "home" | "profile" | "quests" | "campaigns" | "chapters" | "achievements" | "progress" | "path" | "log" | "share" | "themes";

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

export interface TuiRewardModal {
  title: string;
  eyebrow: string;
  lines: string[];
  totalXp: number;
  seenThrough: string;
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
  chapters: ChapterState[];
  bossBattles: BossBattleRecord[];
  classes: PlayerClassState[];
  sharePreview: string[];
  rewardModal: TuiRewardModal | null;
  notice: string | null;
  warnings: string[];
  refreshedAt: string;
  onboardingRequired: boolean;
}

export type TuiActionId =
  | "open-home"
  | "open-profile"
  | "open-quests"
  | "open-campaigns"
  | "open-chapters"
  | "open-achievements"
  | "open-progress"
  | "open-path"
  | "open-log"
  | "open-share"
  | "open-themes"
  | "show-detail"
  | "refresh-all"
  | "quest-create"
  | "quest-edit"
  | "quest-complete"
  | "quest-abandon"
  | "campaign-add"
  | "campaign-scan"
  | "campaign-repair"
  | "campaign-archive"
  | "campaign-restore"
  | "campaign-remove"
  | "class-choose"
  | "share-export"
  | "onboarding-begin"
  | "onboarding-skip-campaign";

export type TuiFieldKind = "text" | "number" | "choice" | "boolean";

export interface TuiFormField {
  key: string;
  label: string;
  kind: TuiFieldKind;
  value: string;
  placeholder?: string;
  choices?: Array<{ label: string; value: string }>;
  required?: boolean;
  secret?: boolean;
}

export interface TuiFormOverlay {
  kind: "form";
  title: string;
  action: TuiActionId | "onboarding-profile" | "onboarding-campaign" | "onboarding-theme";
  fields: TuiFormField[];
  fieldIndex: number;
  error: string | null;
  submitLabel: string;
  cancelLabel: string;
  allowSkip?: boolean;
}

export interface TuiPaletteEntry {
  id: TuiActionId;
  label: string;
  description: string;
  shortcut?: string;
  enabled: boolean;
}

export interface TuiPaletteOverlay {
  kind: "palette";
  query: string;
  selected: number;
}

export interface TuiDetailOverlay {
  kind: "detail";
  screen: Exclude<TuiScreen, "home" | "profile" | "themes">;
}

export interface TuiConfirmOverlay {
  kind: "confirm";
  title: string;
  message: string[];
  action: TuiActionId;
  confirmLabel: string;
  dangerous?: boolean;
  verification?: string;
  typed: string;
  error: string | null;
}

export interface TuiOnboardingOverlay {
  kind: "onboarding";
  step: "welcome" | "complete";
}

export interface TuiNoticeOverlay {
  kind: "notice";
  title: string;
  lines: string[];
  tone: "success" | "warning" | "danger" | "normal";
}

export type TuiOverlay =
  | TuiFormOverlay
  | TuiPaletteOverlay
  | TuiDetailOverlay
  | TuiConfirmOverlay
  | TuiOnboardingOverlay
  | TuiNoticeOverlay;

export interface TuiState {
  screen: TuiScreen;
  homeIndex: number;
  selected: Record<Exclude<TuiScreen, "home">, number>;
  helpOpen: boolean;
  modalOpen: boolean;
  overlay: TuiOverlay | null;
}

export interface TerminalSize {
  width: number;
  height: number;
}

export interface QuestFormValues {
  title: string;
  repositoryId: number | null;
  objectiveType: CustomQuestObjective;
  target: number;
  rewardXp: number;
  deadlineAt: string | null;
}
