import { TUI_THEMES, themeIndex, type TuiThemeId } from "./theme.js";
import type { TuiModel, TuiScreen, TuiState } from "./types.js";

export const SCREEN_ORDER: TuiScreen[] = [
  "home",
  "profile",
  "quests",
  "campaigns",
  "chapters",
  "achievements",
  "progress",
  "path",
  "log",
  "share",
  "themes"
];

export const HOME_MENU: Array<{
  screen: Exclude<TuiScreen, "home">;
  command: string;
  title: string;
  description: string;
  shortcut: string;
}> = [
  { screen: "profile", command: "/profile", title: "Profile", description: "full journey card and identity", shortcut: "enter" },
  { screen: "quests", command: "/quests", title: "Quest Board", description: "active objectives and rewards", shortcut: "enter" },
  { screen: "campaigns", command: "/campaigns", title: "Campaigns", description: "tracked repositories", shortcut: "enter" },
  { screen: "chapters", command: "/chapters", title: "Chapters", description: "campaign arcs and boss encounters", shortcut: "enter" },
  { screen: "achievements", command: "/badges", title: "Achievements", description: "unlocked and hidden badges", shortcut: "enter" },
  { screen: "progress", command: "/progress", title: "Progress", description: "levels, streaks, and activity", shortcut: "enter" },
  { screen: "path", command: "/path", title: "Developer Path", description: "classes and cosmetic skills", shortcut: "enter" },
  { screen: "log", command: "/log", title: "Adventure Log", description: "recent Git rewards", shortcut: "enter" },
  { screen: "share", command: "/share", title: "Share Journey", description: "privacy-safe cards and profiles", shortcut: "enter" },
  { screen: "themes", command: "/themes", title: "Themes", description: "change the look of CommitQuest", shortcut: "T" }
];

export type TuiKey =
  | "up"
  | "down"
  | "left"
  | "right"
  | "enter"
  | "escape"
  | "tab"
  | "shift-tab"
  | "backspace"
  | "delete"
  | "refresh"
  | "themes"
  | "help"
  | "palette"
  | "new"
  | "edit"
  | "complete"
  | "abandon"
  | "scan"
  | "repair"
  | "archive"
  | "remove"
  | "motion"
  | "color"
  | "quit"
  | "unknown";

export type TuiEffect =
  | "none"
  | "refresh"
  | "apply-theme"
  | "ack-rewards"
  | "open-palette"
  | "open-detail"
  | "quest-create"
  | "quest-edit"
  | "quest-complete"
  | "quest-abandon"
  | "campaign-add"
  | "campaign-scan"
  | "campaign-repair"
  | "campaign-archive-toggle"
  | "campaign-remove"
  | "class-choose"
  | "share-export"
  | "toggle-motion"
  | "cycle-color"
  | "quit";

export interface TuiTransition {
  state: TuiState;
  effect: TuiEffect;
}

export function initialTuiState(
  activeTheme: TuiThemeId = "tokyo-night",
  modalOpen = false,
  onboardingRequired = false
): TuiState {
  return {
    screen: "home",
    homeIndex: 0,
    selected: {
      profile: 0,
      quests: 0,
      campaigns: 0,
      chapters: 0,
      achievements: 0,
      progress: 0,
      path: 0,
      log: 0,
      share: 0,
      themes: themeIndex(activeTheme)
    },
    helpOpen: false,
    modalOpen,
    overlay: onboardingRequired ? { kind: "onboarding", step: "welcome" } : null
  };
}

function wrap(value: number, count: number): number {
  if (count <= 0) return 0;
  return ((value % count) + count) % count;
}

export function itemCount(screen: TuiScreen, model: TuiModel): number {
  switch (screen) {
    case "home": return HOME_MENU.length;
    case "profile": return 1;
    case "quests": return model.quests.length + model.customQuests.length;
    case "campaigns": return model.campaigns.length;
    case "chapters": return model.chapters?.length ?? 0;
    case "achievements": return model.achievements.length;
    case "progress": return Math.max(1, model.commitTypes.length);
    case "path": return model.classes?.length ?? 0;
    case "log": return model.recentActivity.length;
    case "share": return 3;
    case "themes": return TUI_THEMES.length;
  }
}

function moveScreen(state: TuiState, direction: number): TuiState {
  const current = SCREEN_ORDER.indexOf(state.screen);
  return { ...state, screen: SCREEN_ORDER[wrap(current + direction, SCREEN_ORDER.length)] ?? "home" };
}

function moveSelection(state: TuiState, model: TuiModel, direction: number): TuiState {
  const count = itemCount(state.screen, model);
  if (state.screen === "home") return { ...state, homeIndex: wrap(state.homeIndex + direction, count) };
  return {
    ...state,
    selected: { ...state.selected, [state.screen]: wrap(state.selected[state.screen] + direction, count) }
  };
}

export function clampTuiState(state: TuiState, model: TuiModel): TuiState {
  const selected = { ...state.selected };
  for (const screen of SCREEN_ORDER) {
    if (screen === "home") continue;
    selected[screen] = Math.min(selected[screen], Math.max(0, itemCount(screen, model) - 1));
  }
  return {
    ...state,
    homeIndex: Math.min(state.homeIndex, HOME_MENU.length - 1),
    selected
  };
}

export function transitionTui(state: TuiState, key: TuiKey, model: TuiModel): TuiTransition {
  if (key === "quit") return { state, effect: "quit" };

  if (state.overlay) return { state, effect: "none" };

  if (state.modalOpen) {
    if (key === "enter" || key === "escape") return { state: { ...state, modalOpen: false }, effect: "ack-rewards" };
    return { state, effect: "none" };
  }

  if (key === "refresh") return { state, effect: "refresh" };
  if (key === "palette") return { state, effect: "open-palette" };

  if (state.helpOpen) {
    if (key === "help" || key === "escape" || key === "enter") return { state: { ...state, helpOpen: false }, effect: "none" };
    return { state, effect: "none" };
  }

  if (key === "help") return { state: { ...state, helpOpen: true }, effect: "none" };
  if (key === "themes") return { state: { ...state, screen: "themes" }, effect: "none" };
  if (key === "tab") return { state: moveScreen(state, 1), effect: "none" };
  if (key === "shift-tab") return { state: moveScreen(state, -1), effect: "none" };
  if (key === "left") return { state: moveScreen(state, -1), effect: "none" };
  if (key === "right") return { state: moveScreen(state, 1), effect: "none" };
  if (key === "up") return { state: moveSelection(state, model, -1), effect: "none" };
  if (key === "down") return { state: moveSelection(state, model, 1), effect: "none" };

  if (key === "escape") {
    return { state: state.screen === "home" ? state : { ...state, screen: "home" }, effect: "none" };
  }

  if (key === "enter" && state.screen === "home") {
    return { state: { ...state, screen: HOME_MENU[state.homeIndex]?.screen ?? "quests" }, effect: "none" };
  }
  if (key === "enter" && state.screen === "profile") return { state, effect: "none" };
  if (key === "enter" && state.screen === "themes") return { state, effect: "apply-theme" };
  if (key === "motion" && state.screen === "themes") return { state, effect: "toggle-motion" };
  if (key === "color" && state.screen === "themes") return { state, effect: "cycle-color" };
  if (key === "enter" && state.screen === "path") return { state, effect: "class-choose" };
  if (key === "enter" && state.screen === "share") return { state, effect: "share-export" };
  if (key === "enter" && state.screen !== "progress" && state.screen !== "profile") return { state, effect: "open-detail" };

  if (key === "new" && state.screen === "quests") return { state, effect: "quest-create" };
  if (key === "new" && state.screen === "campaigns") return { state, effect: "campaign-add" };
  if (key === "edit" && state.screen === "quests") return { state, effect: "quest-edit" };
  if (key === "complete" && state.screen === "quests") return { state, effect: "quest-complete" };
  if (key === "abandon" && state.screen === "quests") return { state, effect: "quest-abandon" };
  if (key === "scan" && state.screen === "campaigns") return { state, effect: "campaign-scan" };
  if (key === "repair" && state.screen === "campaigns") return { state, effect: "campaign-repair" };
  if (key === "archive" && state.screen === "campaigns") return { state, effect: "campaign-archive-toggle" };
  if (key === "remove" && state.screen === "campaigns") return { state, effect: "campaign-remove" };

  return { state, effect: "none" };
}
