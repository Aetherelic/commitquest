import chalk from "chalk";
import { formatRelativeDate } from "../core/dates.js";
import { customQuestObjectiveLabel } from "../core/custom-quests.js";
import { HOME_MENU } from "./navigation.js";
import { getTuiTheme, TUI_THEMES, type TuiTheme } from "./theme.js";
import type {
  TerminalSize,
  TuiActivity,
  TuiCampaign,
  TuiCommitTypeStat,
  TuiModel,
  TuiState
} from "./types.js";

const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const FOOTER_CREDIT = "Made with <3 by Aetherelic";
const MIN_WIDTH = 68;
const MIN_HEIGHT = 20;
const APP_VERSION = "v0.1.0";

interface RenderOptions {
  color?: boolean;
  theme?: TuiTheme;
}

type Tone = "normal" | "accent" | "accentAlt" | "muted" | "success" | "warning" | "danger" | "selected" | "title";
type Background = "background" | "surface" | "surfaceAlt" | "accent";

interface Line {
  text: string;
  tone?: Tone;
  background?: Background;
}

const LOGO_FONT: Record<string, readonly string[]> = {
  C: ["█████", "█    ", "█    ", "█    ", "█████"],
  O: ["█████", "█   █", "█   █", "█   █", "█████"],
  M: ["█   █", "██ ██", "█ █ █", "█   █", "█   █"],
  I: ["█████", "  █  ", "  █  ", "  █  ", "█████"],
  T: ["█████", "  █  ", "  █  ", "  █  ", "  █  "],
  Q: ["█████", "█   █", "█   █", "█  ██", "█████"],
  U: ["█   █", "█   █", "█   █", "█   █", "█████"],
  E: ["█████", "█    ", "████ ", "█    ", "█████"],
  S: ["█████", "█    ", "█████", "    █", "█████"]
};

function logoRows(word = "COMMITQUEST"): string[] {
  return Array.from({ length: 5 }, (_, row) =>
    [...word].map((letter) => LOGO_FONT[letter]?.[row] ?? "     ").join(" ")
  );
}

function clip(value: string, width: number): string {
  if (width <= 0) return "";
  if (value.length <= width) return value;
  if (width === 1) return "…";
  return `${value.slice(0, width - 1)}…`;
}

function fit(value: string, width: number): string {
  const clipped = clip(value, width);
  return clipped + " ".repeat(Math.max(0, width - clipped.length));
}

function center(value: string, width: number): string {
  const clipped = clip(value, width);
  const left = Math.max(0, Math.floor((width - clipped.length) / 2));
  return `${" ".repeat(left)}${clipped}`;
}

function align(left: string, right: string, width: number): string {
  if (right.length >= width) return clip(right, width);
  const availableLeft = Math.max(0, width - right.length - 1);
  const clippedLeft = clip(left, availableLeft);
  return `${clippedLeft}${" ".repeat(Math.max(1, width - clippedLeft.length - right.length))}${right}`;
}

function progressBar(value: number, target: number, width: number): string {
  if (width <= 0) return "";
  const percentage = target <= 0 ? 1 : Math.max(0, Math.min(1, value / target));
  const filled = Math.round(percentage * width);
  return `${"━".repeat(filled)}${"─".repeat(Math.max(0, width - filled))}`;
}

function foreground(theme: TuiTheme, tone: Tone): string {
  switch (tone) {
    case "accent": return theme.accent;
    case "accentAlt": return theme.accentAlt;
    case "muted": return theme.muted;
    case "success": return theme.success;
    case "warning": return theme.warning;
    case "danger": return theme.danger;
    case "selected": return theme.background;
    case "title": return theme.text;
    case "normal": return theme.text;
  }
}

function background(theme: TuiTheme, value: Background): string {
  switch (value) {
    case "background": return theme.background;
    case "surface": return theme.surface;
    case "surfaceAlt": return theme.surfaceAlt;
    case "accent": return theme.accent;
  }
}

function renderLine(line: Line, width: number, theme: TuiTheme, color: boolean): string {
  const text = fit(line.text, width);
  if (!color) return text;
  const tone = line.tone ?? "normal";
  const backgroundTone = line.background ?? (tone === "selected" ? "accent" : "background");
  let styler = chalk.bgHex(background(theme, backgroundTone)).hex(foreground(theme, tone));
  if (tone === "title" || tone === "selected") styler = styler.bold;
  return styler(text);
}

function panel(title: string, lines: string[], width: number): string[] {
  if (width < 12) return lines.map((line) => clip(line, width));
  const inner = width - 2;
  const label = ` ${title} `;
  const labelWidth = Math.min(label.length, Math.max(0, width - 4));
  return [
    `╭─${clip(label, labelWidth)}${"─".repeat(Math.max(0, width - 3 - labelWidth))}╮`,
    ...lines.map((line) => `│${fit(line, inner)}│`),
    `╰${"─".repeat(inner)}╯`
  ];
}

function columns(left: string[], right: string[], leftWidth: number, rightWidth: number, gap = 2): string[] {
  const height = Math.max(left.length, right.length);
  const output: string[] = [];
  for (let index = 0; index < height; index += 1) {
    output.push(`${fit(left[index] ?? "", leftWidth)}${" ".repeat(gap)}${fit(right[index] ?? "", rightWidth)}`);
  }
  return output;
}

function selectedWindow<T>(items: T[], selected: number, capacity: number): { items: T[]; offset: number } {
  if (capacity <= 0 || items.length <= capacity) return { items: items.slice(0, Math.max(0, capacity)), offset: 0 };
  const half = Math.floor(capacity / 2);
  const offset = Math.max(0, Math.min(items.length - capacity, selected - half));
  return { items: items.slice(offset, offset + capacity), offset };
}

function questRows(model: TuiModel): Array<{
  title: string;
  subtitle: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  state: string;
}> {
  const builtIn = model.quests.map((quest) => ({
    title: quest.title,
    subtitle: `${quest.periodLabel} quest`,
    description: quest.description,
    progress: quest.progress,
    target: quest.target,
    reward: quest.rewardXp,
    state: model.rewardedQuestKeys.has(quest.key) ? "claimed" : quest.complete ? "complete" : "active"
  }));
  const custom = model.customQuests.map((quest) => ({
    title: `#${quest.id} ${quest.title}`,
    subtitle: `${quest.repositoryName ?? "All campaigns"} · ${customQuestObjectiveLabel(quest.objectiveType)}`,
    description: quest.description,
    progress: quest.progress,
    target: quest.target,
    reward: quest.rewardXp,
    state: quest.status
  }));
  return [...builtIn, ...custom];
}

function homeBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const activeQuest = questRows(model).find((quest) => quest.state === "active") ?? null;
  const logo = logoRows();
  const menuWidth = Math.min(78, Math.max(58, width - 12));
  const menuLines = HOME_MENU.map((item, index): Line => {
    const marker = index === state.homeIndex ? ">" : " ";
    const commandWidth = 15;
    const shortcutWidth = 8;
    const descriptionWidth = Math.max(16, menuWidth - commandWidth - shortcutWidth - 5);
    const row = `${marker} ${item.command.padEnd(commandWidth)} ${clip(item.description, descriptionWidth).padEnd(descriptionWidth)} ${item.shortcut.padStart(shortcutWidth)}`;
    return {
      text: center(row, width),
      tone: index === state.homeIndex ? "accent" : "normal"
    };
  });

  const status = `Level ${model.level.level} · ${model.level.title}     ${model.level.xpIntoLevel}/${model.level.xpNeeded} XP     ${model.streak.current} day streak`;
  const objective = activeQuest
    ? `${activeQuest.title}  ${progressBar(activeQuest.progress, activeQuest.target, 14)}  ${activeQuest.progress}/${activeQuest.target}  +${activeQuest.reward} XP`
    : `${model.stats.commits} commits · ${model.stats.repositories} campaigns · no active objective`;
  const notification = model.notice
    ?? (model.warnings[0] ? `Warning · ${model.warnings[0]}` : "Choose a path and continue your journey.");

  const content: Line[] = [
    ...logo.map((text) => ({ text: center(text, width), tone: "accent" as const })),
    { text: center(`COMMITQUEST ${APP_VERSION}  ·  level up by shipping real work`, width), tone: "muted" },
    { text: "" },
    { text: center(status, width), tone: "accentAlt" },
    { text: "" },
    ...menuLines,
    { text: "" },
    { text: center("CURRENT OBJECTIVE", width), tone: "muted" },
    { text: center(objective, width), tone: activeQuest ? "success" : "muted" },
    { text: center(notification, width), tone: model.warnings.length > 0 ? "warning" : "muted" }
  ];

  const topPadding = Math.max(0, Math.floor((height - content.length) / 2));
  return [
    ...Array.from({ length: topPadding }, () => ({ text: "" })),
    ...content
  ];
}

function listDetailBody(
  items: Array<{ label: string; meta: string; detail: string[]; complete?: boolean }>,
  selected: number,
  width: number,
  height: number,
  emptyMessage: string
): Line[] {
  if (items.length === 0) {
    return [
      { text: "" },
      { text: emptyMessage, tone: "muted" }
    ];
  }

  const safeSelected = Math.max(0, Math.min(selected, items.length - 1));
  const current = items[safeSelected]!;
  const listCapacity = Math.max(3, height - 5);
  const window = selectedWindow(items, safeSelected, listCapacity);
  const listLines = window.items.map((item, index) => {
    const absolute = window.offset + index;
    const marker = absolute === safeSelected ? ">" : item.complete ? "◆" : "◇";
    return `${marker} ${clip(item.label, 26)}  ${clip(item.meta, 16)}`;
  });

  if (width >= 92) {
    const leftWidth = Math.min(48, Math.floor(width * 0.46));
    const rightWidth = width - leftWidth - 2;
    const joined = columns(
      panel("Select", listLines, leftWidth),
      panel("Details", current.detail, rightWidth),
      leftWidth,
      rightWidth
    );
    return joined.map((text, index) => ({
      text,
      tone: index === safeSelected - window.offset + 1 ? "accent" : "normal"
    }));
  }

  return [
    ...panel("Select", listLines, width).map((text, index) => ({
      text,
      tone: index === safeSelected - window.offset + 1 ? "accent" as const : "normal" as const
    })),
    { text: "" },
    ...panel("Details", current.detail, width).map((text) => ({ text }))
  ];
}

function questsBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const items = questRows(model).map((quest) => ({
    label: quest.title,
    meta: `${quest.progress}/${quest.target} · +${quest.reward} XP`,
    complete: quest.state === "claimed" || quest.state === "complete",
    detail: [
      quest.title,
      quest.subtitle,
      "",
      quest.description,
      "",
      `${progressBar(quest.progress, quest.target, Math.max(10, Math.min(28, width - 12)))}  ${quest.progress}/${quest.target}`,
      `Reward: +${quest.reward} XP`,
      `Status: ${quest.state}`
    ]
  }));
  return listDetailBody(items, state.selected.quests, width, height, "No quests are available yet.");
}

function campaignDetail(campaign: TuiCampaign): string[] {
  return [
    campaign.name,
    campaign.defaultBranch ? `Branch: ${campaign.defaultBranch}` : "Branch: detached",
    "",
    `${campaign.commits} commits · ${campaign.releases} releases`,
    `${campaign.earnedXp.toLocaleString()} activity XP`,
    campaign.lastActivityAt ? `Last activity: ${formatRelativeDate(campaign.lastActivityAt)}` : "Last activity: none",
    campaign.lastScannedAt ? `Last scan: ${formatRelativeDate(campaign.lastScannedAt)}` : "Last scan: never",
    "",
    campaign.path
  ];
}

function campaignsBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const items = model.campaigns.map((campaign) => ({
    label: campaign.name,
    meta: `${campaign.commits} commits`,
    detail: campaignDetail(campaign)
  }));
  return listDetailBody(items, state.selected.campaigns, width, height, "No campaigns tracked. Run cq add . to begin one.");
}

function achievementsBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const items = model.achievements.map((achievement) => ({
    label: achievement.title,
    meta: achievement.unlocked ? "UNLOCKED" : "LOCKED",
    complete: achievement.unlocked,
    detail: [
      achievement.unlocked ? "◆ BADGE UNLOCKED" : "◇ BADGE LOCKED",
      achievement.title,
      "",
      achievement.description,
      "",
      `Reward: +${achievement.rewardXp} XP`,
      achievement.unlockedAt ? `Unlocked: ${formatRelativeDate(achievement.unlockedAt)}` : "Keep adventuring to unlock this badge."
    ]
  }));
  return listDetailBody(items, state.selected.achievements, width, height, "No achievement definitions found.");
}

function barRow(stat: TuiCommitTypeStat, max: number, width: number): string {
  const barWidth = Math.max(8, width - 25);
  return `${stat.type.padEnd(10)} ${progressBar(stat.count, max, barWidth)} ${String(stat.count).padStart(3)}  +${stat.xp} XP`;
}

function progressBody(model: TuiModel, width: number): Line[] {
  const maxCount = Math.max(1, ...model.commitTypes.map((stat) => stat.count));
  const typeLines = model.commitTypes.length > 0
    ? model.commitTypes.slice(0, 10).map((stat) => barRow(stat, maxCount, width))
    : ["No commit activity yet."];
  const historyLines = model.dailyXp.length > 0
    ? model.dailyXp.slice(0, 7).map((day) => `${day.date}  ${String(day.xp).padStart(5)} XP`)
    : ["No XP history yet."];

  if (width >= 92) {
    const leftWidth = Math.floor((width - 2) * 0.6);
    const rightWidth = width - leftWidth - 2;
    return columns(
      panel("Commit Types", typeLines, leftWidth),
      panel("Recent XP", historyLines, rightWidth),
      leftWidth,
      rightWidth
    ).map((text) => ({ text }));
  }

  return [
    ...panel("Commit Types", typeLines, width).map((text) => ({ text })),
    { text: "" },
    ...panel("Recent XP", historyLines, width).map((text) => ({ text }))
  ];
}

function activityDetail(activity: TuiActivity): string[] {
  return [
    activity.kind === "release" ? "◆ RELEASE" : `◆ ${activity.type.toUpperCase()} COMMIT`,
    activity.subject,
    "",
    `Campaign: ${activity.repositoryName}`,
    `Reward: +${activity.awardedXp} XP`,
    `When: ${formatRelativeDate(activity.occurredAt)}`,
    `Reference: ${activity.reference.slice(0, 12)}`
  ];
}

function logBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const items = model.recentActivity.map((activity) => ({
    label: activity.subject,
    meta: `+${activity.awardedXp} XP`,
    detail: activityDetail(activity),
    complete: activity.kind === "release"
  }));
  return listDetailBody(items, state.selected.log, width, height, "Your adventure log is empty.");
}

function themesBody(state: TuiState, width: number, height: number, activeTheme: TuiTheme): Line[] {
  const items = TUI_THEMES.map((theme) => ({
    label: theme.name,
    meta: theme.id === activeTheme.id ? "ACTIVE" : "PREVIEW",
    complete: theme.id === activeTheme.id,
    detail: [
      theme.name,
      theme.description,
      "",
      `Background  ${theme.background}`,
      `Surface     ${theme.surface}`,
      `Accent      ${theme.accent}`,
      `Highlight   ${theme.accentAlt}`,
      `Success     ${theme.success}`,
      "",
      theme.id === activeTheme.id ? "This theme is currently saved." : "Live preview · press Enter to save.",
      "Saved themes return when CommitQuest reopens."
    ]
  }));
  return listDetailBody(items, state.selected.themes, width, height, "No themes are installed.");
}

function helpBody(width: number): Line[] {
  return panel("Controls", [
    "↑ / ↓ or J / K     Move through items",
    "← / → or H / L     Change screen",
    "Enter              Open menu / save selected theme",
    "Esc                Return home / cancel theme preview",
    "Tab / Shift+Tab    Cycle screens",
    "R                  Refresh and scan campaigns",
    "T                  Open the theme gallery",
    "?                  Toggle this help",
    "Q or Ctrl+C        Quit safely",
    "",
    "Existing commands such as cq add, cq doctor, and cq quest",
    "remain available for scripting and advanced use."
  ], width).map((text) => ({ text }));
}

function screenTitle(state: TuiState): string {
  if (state.helpOpen) return "Help";
  switch (state.screen) {
    case "home": return "Home";
    case "quests": return "Quest Board";
    case "campaigns": return "Campaigns";
    case "achievements": return "Achievements";
    case "progress": return "Progress";
    case "log": return "Adventure Log";
    case "themes": return "Themes";
  }
}

function screenTabs(state: TuiState, width: number): string {
  const entries: Array<[TuiState["screen"], string]> = [
    ["home", "HOME"],
    ["quests", "QUESTS"],
    ["campaigns", "CAMPAIGNS"],
    ["achievements", "BADGES"],
    ["progress", "PROGRESS"],
    ["log", "LOG"],
    ["themes", "THEMES"]
  ];
  const value = entries.map(([screen, label]) => screen === state.screen ? `[ ${label} ]` : `  ${label}  `).join(" ");
  return center(value, width);
}

function bodyLines(model: TuiModel, state: TuiState, width: number, height: number, activeTheme: TuiTheme): Line[] {
  if (state.helpOpen) return helpBody(width);
  switch (state.screen) {
    case "home": return homeBody(model, state, width, height);
    case "quests": return questsBody(model, state, width, height);
    case "campaigns": return campaignsBody(model, state, width, height);
    case "achievements": return achievementsBody(model, state, width, height);
    case "progress": return progressBody(model, width);
    case "log": return logBody(model, state, width, height);
    case "themes": return themesBody(state, width, height, activeTheme);
  }
}

function compactScreen(size: TerminalSize, theme: TuiTheme, color: boolean): string {
  const width = Math.max(30, size.width);
  const height = Math.max(8, size.height);
  const lines: Line[] = [
    { text: center("COMMITQUEST", width), tone: "accent", background: "surface" },
    { text: "" },
    { text: center(`Terminal too small: ${size.width}×${size.height}`, width), tone: "warning" },
    { text: center(`Minimum recommended size: ${MIN_WIDTH}×${MIN_HEIGHT}`, width), tone: "muted" },
    { text: "" },
    { text: center("Resize the terminal or press Q to quit.", width) }
  ];
  while (lines.length < height - 1) lines.push({ text: "" });
  lines.push({ text: align("", FOOTER_CREDIT, width), tone: "muted", background: "surface" });
  return lines.slice(0, height).map((line) => renderLine(line, width, theme, color)).join("\n");
}

export function renderTui(
  model: TuiModel,
  state: TuiState,
  size: TerminalSize,
  options: RenderOptions = {}
): string {
  const color = options.color ?? true;
  const activeTheme = options.theme ?? getTuiTheme(null);
  const previewTheme = state.screen === "themes" && !state.helpOpen
    ? TUI_THEMES[state.selected.themes] ?? activeTheme
    : activeTheme;
  const width = Math.max(30, size.width);
  const height = Math.max(8, size.height);
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return compactScreen({ width, height }, previewTheme, color);

  const footerLeft = state.screen === "themes"
    ? "↑↓ Preview  Enter Save  Esc Cancel  T Themes  ? Help  Q Quit"
    : "↑↓ Move  ←→ Screens  Enter Open  R Refresh  T Themes  ? Help  Q Quit";
  const footer: Line = {
    text: align(footerLeft, FOOTER_CREDIT, width),
    tone: "muted",
    background: "surface"
  };

  let lines: Line[];
  if (state.screen === "home" && !state.helpOpen) {
    const body = bodyLines(model, state, width, height - 1, activeTheme).slice(0, height - 1);
    while (body.length < height - 1) body.push({ text: "" });
    lines = [...body, footer];
  } else {
    const headerLeft = ` COMMITQUEST  ${APP_VERSION}`;
    const headerRight = `${model.profile.name}  ·  Level ${model.level.level} ${model.level.title} `;
    const xpWidth = Math.max(12, Math.min(28, width - 46));
    const xpLeft = ` ${progressBar(model.level.xpIntoLevel, model.level.xpNeeded, xpWidth)}  ${model.level.xpIntoLevel}/${model.level.xpNeeded} XP`;
    const xpRight = `${model.streak.current} day streak  ·  ${model.totalXp.toLocaleString()} total XP `;
    const fixedLines = 5;
    const bodyHeight = height - fixedLines;
    const body = bodyLines(model, state, width, bodyHeight, activeTheme).slice(0, bodyHeight);
    while (body.length < bodyHeight) body.push({ text: "" });

    lines = [
      { text: align(headerLeft, headerRight, width), tone: "title", background: "surface" },
      { text: align(xpLeft, xpRight, width), tone: "muted", background: "surface" },
      { text: screenTabs(state, width), tone: "accent", background: "surfaceAlt" },
      { text: ` ${screenTitle(state).toUpperCase()}`, tone: "accentAlt" },
      ...body,
      footer
    ];
  }

  return lines.slice(0, height).map((line) => renderLine(line, width, previewTheme, color)).join("\n");
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export const TUI_MINIMUM_SIZE = { width: MIN_WIDTH, height: MIN_HEIGHT } as const;
export { FOOTER_CREDIT };
