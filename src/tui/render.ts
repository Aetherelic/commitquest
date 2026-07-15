import chalk from "chalk";
import { formatRelativeDate } from "../core/dates.js";
import { customQuestObjectiveLabel } from "../core/custom-quests.js";
import { HOME_MENU } from "./navigation.js";
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

interface RenderOptions {
  color?: boolean;
}

type Tone = "normal" | "accent" | "dim" | "success" | "warning" | "selected" | "danger";

interface Line {
  text: string;
  tone?: Tone;
}

function visibleLength(value: string): number {
  return value.replace(ANSI_PATTERN, "").length;
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
  return `${"█".repeat(filled)}${"░".repeat(Math.max(0, width - filled))}`;
}

function topBorder(width: number): string {
  const label = " COMMITQUEST ";
  const remaining = Math.max(0, width - label.length - 2);
  return `╭─${label}${"─".repeat(Math.max(0, remaining - 1))}╮`;
}

function divider(width: number, title?: string): string {
  if (!title) return `├${"─".repeat(Math.max(0, width - 2))}┤`;
  const label = ` ${title.toUpperCase()} `;
  const remaining = Math.max(0, width - label.length - 2);
  return `├─${label}${"─".repeat(Math.max(0, remaining - 1))}┤`;
}

function bottomBorder(width: number): string {
  return `╰${"─".repeat(Math.max(0, width - 2))}╯`;
}

function paint(value: string, tone: Tone, color: boolean): string {
  if (!color) return value;
  switch (tone) {
    case "accent":
      return chalk.magenta(value);
    case "dim":
      return chalk.dim(value);
    case "success":
      return chalk.green(value);
    case "warning":
      return chalk.yellow(value);
    case "selected":
      return chalk.black.bgMagenta.bold(value);
    case "danger":
      return chalk.red(value);
    case "normal":
      return value;
  }
}

function framedLine(line: Line, innerWidth: number, color: boolean): string {
  const body = fit(line.text, innerWidth);
  return `${paint("│", "accent", color)}${paint(body, line.tone ?? "normal", color)}${paint("│", "accent", color)}`;
}

function panel(title: string, lines: string[], width: number): string[] {
  if (width < 12) return lines.map((line) => clip(line, width));
  const inner = width - 2;
  const label = ` ${title} `;
  const top = `╭─${clip(label, Math.max(0, width - 4))}${"─".repeat(Math.max(0, width - 3 - Math.min(label.length, width - 4)))}╮`;
  return [
    top,
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
  const selected = HOME_MENU[state.homeIndex] ?? HOME_MENU[0]!;
  const activeQuest = questRows(model).find((quest) => quest.state === "active") ?? null;
  const menuLines = HOME_MENU.map((item, index) => `${index === state.homeIndex ? "▶" : " "} ${item.title}`);
  const detailLines = [
    selected.title,
    "",
    selected.description,
    "",
    activeQuest ? "CURRENT OBJECTIVE" : "JOURNEY STATUS",
    activeQuest ? activeQuest.title : "No active objectives",
    activeQuest ? `${progressBar(activeQuest.progress, activeQuest.target, 18)}  ${activeQuest.progress}/${activeQuest.target}` : "Create a custom quest or keep shipping.",
    activeQuest ? `Reward: +${activeQuest.reward} XP` : `${model.stats.commits} commits across ${model.stats.repositories} campaigns`
  ];

  const lines: Line[] = [
    { text: "TODAY'S JOURNEY", tone: "accent" },
    { text: model.notice ?? (model.warnings[0] ? `Warning: ${model.warnings[0]}` : "Your campaigns are ready."), tone: model.warnings.length > 0 ? "warning" : "dim" },
    { text: "" }
  ];

  if (width >= 88) {
    const leftWidth = Math.min(34, Math.floor(width * 0.38));
    const rightWidth = width - leftWidth - 2;
    const joined = columns(
      panel("Main Menu", menuLines, leftWidth),
      panel("Selected", detailLines, rightWidth),
      leftWidth,
      rightWidth
    );
    for (const line of joined) {
      const menuIndex = lines.length - 3 - 1;
      lines.push({ text: line, tone: menuIndex === state.homeIndex ? "normal" : "normal" });
    }
  } else {
    lines.push(...panel("Main Menu", menuLines, width).map((text, index) => ({
      text,
      tone: index === state.homeIndex + 1 ? "selected" as const : "normal" as const
    })));
    lines.push({ text: "" });
    lines.push(...panel("Selected", detailLines, width).map((text) => ({ text })));
  }

  if (model.stats.repositories === 0 && lines.length < height - 2) {
    lines.push({ text: "" });
    lines.push({ text: "No campaigns yet. Leave the app and run: cq add .", tone: "warning" });
  }

  return lines;
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
      { text: emptyMessage, tone: "dim" }
    ];
  }

  const safeSelected = Math.max(0, Math.min(selected, items.length - 1));
  const current = items[safeSelected]!;
  const listCapacity = Math.max(3, height - 5);
  const window = selectedWindow(items, safeSelected, listCapacity);
  const listLines = window.items.map((item, index) => {
    const absolute = window.offset + index;
    const marker = absolute === safeSelected ? "▶" : item.complete ? "◆" : "◇";
    return `${marker} ${clip(item.label, 24)}  ${clip(item.meta, 15)}`;
  });

  if (width >= 92) {
    const leftWidth = Math.min(46, Math.floor(width * 0.48));
    const rightWidth = width - leftWidth - 2;
    const joined = columns(
      panel("Select", listLines, leftWidth),
      panel("Details", current.detail, rightWidth),
      leftWidth,
      rightWidth
    );
    return joined.map((text, index) => ({
      text,
      tone: index === safeSelected - window.offset + 1 ? "selected" : "normal"
    }));
  }

  return [
    ...panel("Select", listLines, width).map((text, index) => ({
      text,
      tone: index === safeSelected - window.offset + 1 ? "selected" as const : "normal" as const
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

function helpBody(width: number): Line[] {
  return panel("Controls", [
    "↑ / ↓ or J / K     Move through items",
    "← / → or H / L     Change screen",
    "Enter              Open selected menu",
    "Esc                Return home / close help",
    "Tab / Shift+Tab    Cycle screens",
    "R                  Refresh and scan campaigns",
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
  }
}

function bodyLines(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  if (state.helpOpen) return helpBody(width);
  switch (state.screen) {
    case "home": return homeBody(model, state, width, height);
    case "quests": return questsBody(model, state, width, height);
    case "campaigns": return campaignsBody(model, state, width, height);
    case "achievements": return achievementsBody(model, state, width, height);
    case "progress": return progressBody(model, width);
    case "log": return logBody(model, state, width, height);
  }
}

function compactScreen(size: TerminalSize, color: boolean): string {
  const width = Math.max(30, size.width);
  const lines = [
    paint("COMMITQUEST", "accent", color),
    "",
    `Terminal too small: ${size.width}×${size.height}`,
    `Minimum recommended size: ${MIN_WIDTH}×${MIN_HEIGHT}`,
    "",
    "Resize the terminal or press Q to quit.",
    "",
    FOOTER_CREDIT
  ];
  return lines.map((line) => clip(line, width)).join("\n");
}

export function renderTui(
  model: TuiModel,
  state: TuiState,
  size: TerminalSize,
  options: RenderOptions = {}
): string {
  const color = options.color ?? true;
  const width = Math.max(30, size.width);
  const height = Math.max(8, size.height);
  if (width < MIN_WIDTH || height < MIN_HEIGHT) return compactScreen({ width, height }, color);

  const innerWidth = width - 2;
  const bodyHeight = height - 7;
  const headerLeft = `${model.profile.name} · ${model.stats.repositories} campaign${model.stats.repositories === 1 ? "" : "s"}`;
  const headerRight = `Level ${model.level.level} · ${model.level.title}`;
  const xpWidth = Math.max(12, Math.min(32, innerWidth - 34));
  const xpLeft = `${progressBar(model.level.xpIntoLevel, model.level.xpNeeded, xpWidth)}  ${model.level.xpIntoLevel}/${model.level.xpNeeded} XP`;
  const xpRight = `${model.streak.current} day streak · ${model.totalXp.toLocaleString()} total XP`;

  const body = bodyLines(model, state, innerWidth, bodyHeight).slice(0, bodyHeight);
  while (body.length < bodyHeight) body.push({ text: "" });

  const footerLeft = "↑↓ Move  ←→ Screens  Enter Open  R Refresh  ? Help  Q Quit";
  const footer = align(footerLeft, FOOTER_CREDIT, innerWidth);

  const output = [
    paint(topBorder(width), "accent", color),
    framedLine({ text: align(headerLeft, headerRight, innerWidth) }, innerWidth, color),
    framedLine({ text: align(xpLeft, xpRight, innerWidth), tone: "dim" }, innerWidth, color),
    paint(divider(width, screenTitle(state)), "accent", color),
    ...body.map((line) => framedLine(line, innerWidth, color)),
    paint(divider(width), "accent", color),
    framedLine({ text: footer, tone: "dim" }, innerWidth, color),
    paint(bottomBorder(width), "accent", color)
  ];

  return output.join("\n");
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export const TUI_MINIMUM_SIZE = { width: MIN_WIDTH, height: MIN_HEIGHT } as const;
export { FOOTER_CREDIT };
