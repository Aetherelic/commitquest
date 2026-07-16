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
const APP_VERSION = "v0.1.2";

interface RenderOptions {
  color?: boolean;
  theme?: TuiTheme;
  pulse?: boolean;
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

function clip(value: string | undefined | null, width: number): string {
  const safe = value ?? "";
  if (width <= 0) return "";
  if (safe.length <= width) return safe;
  if (width === 1) return "…";
  return `${safe.slice(0, width - 1)}…`;
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

function sparkline(values: number[], width: number): string {
  if (width <= 0) return "";
  if (values.length === 0) return "─".repeat(width);
  const blocks = "▁▂▃▄▅▆▇█";
  const max = Math.max(1, ...values);
  const sample = values.length <= width
    ? values
    : Array.from({ length: width }, (_, index) => {
      const start = Math.floor(index * values.length / width);
      const end = Math.max(start + 1, Math.floor((index + 1) * values.length / width));
      return Math.max(...values.slice(start, end));
    });
  const chart = sample.map((value) => blocks[Math.min(blocks.length - 1, Math.round((value / max) * (blocks.length - 1)))]).join("");
  return chart.padStart(width, "·").slice(-width);
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

function panelFill(title: string, lines: string[], width: number, height: number): string[] {
  if (height <= 0) return [];
  if (height < 3) return lines.slice(0, height).map((line) => fit(line, width));
  const innerHeight = height - 2;
  const content = lines.slice(0, innerHeight);
  while (content.length < innerHeight) content.push("");
  return panel(title, content, width).slice(0, height);
}

function splitPanelHeights(total: number, ratio = 0.58, gap = 1): [number, number] {
  const usable = Math.max(6, total - gap);
  const first = Math.max(3, Math.min(usable - 3, Math.round(usable * ratio)));
  return [first, usable - first];
}

function columns(left: string[], right: string[], leftWidth: number, rightWidth: number, gap = 2): string[] {
  const height = Math.max(left.length, right.length);
  const output: string[] = [];
  for (let index = 0; index < height; index += 1) {
    output.push(`${fit(left[index] ?? "", leftWidth)}${" ".repeat(gap)}${fit(right[index] ?? "", rightWidth)}`);
  }
  return output;
}

function mergeColumns(columnsInput: string[][], widths: number[], gap = 2): string[] {
  const height = Math.max(...columnsInput.map((column) => column.length), 0);
  const lines: string[] = [];
  for (let row = 0; row < height; row += 1) {
    lines.push(columnsInput.map((column, index) => fit(column[row] ?? "", widths[index] ?? 0)).join(" ".repeat(gap)));
  }
  return lines;
}

function stackPanels(panels: string[][], gap = 1): string[] {
  const lines: string[] = [];
  panels.forEach((panelLines, index) => {
    lines.push(...panelLines);
    if (index < panels.length - 1) {
      for (let count = 0; count < gap; count += 1) lines.push("");
    }
  });
  return lines;
}

function selectedWindow<T>(items: T[], selected: number, capacity: number): { items: T[]; offset: number } {
  if (capacity <= 0 || items.length <= capacity) return { items: items.slice(0, Math.max(0, capacity)), offset: 0 };
  const half = Math.floor(capacity / 2);
  const offset = Math.max(0, Math.min(items.length - capacity, selected - half));
  return { items: items.slice(offset, offset + capacity), offset };
}

function padLines(lines: string[], width: number, height: number): string[] {
  const output = lines.slice(0, height).map((line) => fit(line, width));
  while (output.length < height) output.push(" ".repeat(width));
  return output;
}

function metricPanel(title: string, value: string, subtitle: string, width: number): string[] {
  return panel(title, [value, subtitle], width);
}

function summaryCards(cards: Array<{ title: string; value: string; subtitle: string }>, width: number): string[] {
  if (cards.length === 0) return [];
  const gap = 2;
  const cardWidth = Math.max(18, Math.floor((width - gap * (cards.length - 1)) / cards.length));
  const widths = cards.map((_, index) => {
    if (index === cards.length - 1) {
      return width - cardWidth * (cards.length - 1) - gap * (cards.length - 1);
    }
    return cardWidth;
  });
  const rendered = cards.map((card, index) => metricPanel(card.title, card.value, card.subtitle, widths[index]!));
  return mergeColumns(rendered, widths, gap);
}

function sectionTitle(label: string, width: number): string {
  const value = ` ${label.toUpperCase()} `;
  const available = Math.max(value.length + 2, width);
  const left = Math.max(0, Math.floor((available - value.length) / 2));
  const right = Math.max(0, available - value.length - left);
  return `${"─".repeat(left)}${value}${"─".repeat(right)}`.slice(0, width);
}

function listRows(items: Array<{ label: string; meta: string; complete?: boolean }>, selected: number, capacity: number): { rows: string[]; offset: number } {
  const window = selectedWindow(items, selected, capacity);
  const rows = window.items.map((item, index) => {
    const absolute = window.offset + index;
    const marker = absolute === selected ? ">" : item.complete ? "◆" : "◇";
    return `${marker} ${clip(item.label, 34)}  ${clip(item.meta, 18)}`;
  });
  return { rows, offset: window.offset };
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

function homeBody(model: TuiModel, state: TuiState, width: number, height: number, pulse = false): Line[] {
  const activeQuest = questRows(model).find((quest) => quest.state === "active") ?? null;
  const latest = model.recentActivity[0] ?? null;
  const logo = logoRows();
  const menuWidth = Math.min(86, Math.max(60, width - 18));
  const commandWidth = 16;
  const shortcutWidth = 8;
  const descriptionWidth = Math.max(18, menuWidth - commandWidth - shortcutWidth - 5);

  const menuLines = HOME_MENU.map((item, index): Line => {
    const selected = index === state.homeIndex;
    const marker = selected ? (pulse ? "◆" : ">") : " ";
    const row = `${marker} ${item.command.padEnd(commandWidth)} ${clip(item.description, descriptionWidth).padEnd(descriptionWidth)} ${item.shortcut.padStart(shortcutWidth)}`;
    return { text: center(row, width), tone: selected ? "accent" : "normal" };
  });

  const progress = `${progressBar(model.level.xpIntoLevel, model.level.xpNeeded, Math.min(32, Math.max(16, Math.floor(width * 0.22))))}  ${model.level.xpIntoLevel}/${model.level.xpNeeded} XP`;
  const profileLine = `${model.profile.name}  ·  Level ${model.level.level} ${model.level.title}  ·  ${model.streak.current} day streak`;
  const journeyLine = `${model.stats.commits} commits  ·  ${model.stats.repositories} campaigns  ·  ${model.stats.achievements} badges  ·  ${model.totalXp.toLocaleString()} total XP`;
  const objective = activeQuest
    ? `${activeQuest.title}  ${activeQuest.progress}/${activeQuest.target}  ·  +${activeQuest.reward} XP`
    : "No active objective";
  const latestReward = latest
    ? `Latest reward  ·  +${latest.awardedXp} XP  ·  ${clip(latest.subject, Math.max(20, width - 34))}`
    : "Make a commit to begin your adventure log.";
  const notice = model.notice
    ?? (model.warnings[0] ? `Warning · ${model.warnings[0]}` : "Choose a path and continue your journey.");

  const content: Line[] = [
    ...logo.map((value) => ({ text: center(value, width), tone: "accent" as const })),
    { text: center(`COMMITQUEST ${APP_VERSION}`, width), tone: "title" },
    { text: center("LEVEL UP BY SHIPPING REAL WORK", width), tone: "muted" },
    { text: "" },
    { text: center(profileLine, width), tone: "accentAlt" },
    { text: center(progress, width), tone: "muted" },
    { text: center(journeyLine, width), tone: "muted" },
    { text: "" },
    ...menuLines,
    { text: "" },
    { text: center("CURRENT OBJECTIVE", width), tone: "muted" },
    { text: center(objective, width), tone: activeQuest ? "success" : "muted" },
    { text: center(latestReward, width), tone: "muted" },
    { text: "" },
    { text: center(notice, width), tone: model.warnings.length > 0 ? "warning" : "muted" }
  ];

  const topPadding = Math.max(0, Math.floor((height - content.length) / 2));
  return [...Array.from({ length: topPadding }, () => ({ text: "" })), ...content].slice(0, height);
}

function renderQuestColumns(model: TuiModel, state: TuiState, width: number, height: number): string[] {
  const quests = questRows(model);
  if (quests.length === 0) return panelFill("Quest Board", ["No quests are available yet."], width, height);

  if (width < 100) {
    const safeSelected = Math.max(0, Math.min(state.selected.quests, quests.length - 1));
    const current = quests[safeSelected]!;
    const leftWidth = Math.max(30, Math.floor(width * 0.42));
    const rightWidth = width - leftWidth - 2;
    const { rows } = listRows(
      quests.map((quest) => ({
        label: quest.title,
        meta: `${quest.progress}/${quest.target} · +${quest.reward} XP`,
        complete: quest.state === "claimed" || quest.state === "complete"
      })),
      safeSelected,
      Math.max(4, height - 2)
    );
    return columns(
      panelFill("Quest Board", rows, leftWidth, height),
      panelFill("Selected Quest", [
        current.title,
        current.subtitle,
        "",
        current.description,
        "",
        progressBar(current.progress, current.target, Math.max(12, rightWidth - 4)),
        `${current.progress}/${current.target} · +${current.reward} XP`,
        `Status: ${current.state}`
      ], rightWidth, height),
      leftWidth,
      rightWidth
    );
  }

  const safeSelected = Math.max(0, Math.min(state.selected.quests, quests.length - 1));
  const current = quests[safeSelected]!;
  const claimed = quests.filter((quest) => quest.state === "claimed" || quest.state === "complete");
  const active = quests.filter((quest) => quest.state === "active");
  const custom = model.customQuests.filter((quest) => quest.status === "active");
  const gap = 2;
  const usable = width - gap * 2;
  const leftWidth = Math.max(32, Math.floor(usable * 0.34));
  const middleWidth = Math.max(36, Math.floor(usable * 0.41));
  const rightWidth = usable - leftWidth - middleWidth;

  const { rows } = listRows(
    quests.map((quest) => ({
      label: quest.title,
      meta: `${quest.progress}/${quest.target} · +${quest.reward} XP`,
      complete: quest.state === "claimed" || quest.state === "complete"
    })),
    safeSelected,
    Math.max(5, height - 7)
  );
  const left = panelFill("Quest Board", [
    `${active.length} active · ${claimed.length} claimed · ${custom.length} custom`,
    progressBar(claimed.length, Math.max(1, quests.length), Math.max(12, leftWidth - 4)),
    "",
    ...rows
  ], leftWidth, height);

  const [detailHeight, guidanceHeight] = splitPanelHeights(height, 0.62);
  const middle = stackPanels([
    panelFill("Selected Quest", [
      current.state === "active" ? "◇ ACTIVE OBJECTIVE" : "◆ REWARD CLAIMED",
      current.title,
      current.subtitle,
      "",
      current.description,
      "",
      progressBar(current.progress, current.target, Math.max(14, middleWidth - 4)),
      `${current.progress}/${current.target} progress`,
      "",
      `Reward: +${current.reward} XP`,
      `Status: ${current.state}`
    ], middleWidth, detailHeight),
    panelFill("How To Progress", [
      current.state === "active"
        ? "Complete the objective through a new eligible Git event."
        : "This objective is complete and cannot reward XP twice.",
      "",
      current.subtitle.includes("release") || current.description.toLowerCase().includes("release")
        ? "Next move: create and scan a new tagged release."
        : current.subtitle.includes("commit")
          ? "Next move: use the matching conventional commit type."
          : "Next move: continue work in a tracked campaign.",
      "",
      model.notice ?? "Automatic post-commit rewards are ready."
    ], middleWidth, guidanceHeight)
  ]);

  const [summaryHeight, nextHeight] = splitPanelHeights(height, 0.46);
  const nextQuests = active.slice(0, Math.max(2, nextHeight - 6));
  const right = stackPanels([
    panelFill("Quest Summary", [
      `${active.length} active objectives`,
      `${claimed.length}/${quests.length} claimed`,
      `${model.quests.length} built-in quests`,
      `${model.customQuests.length} custom quests`,
      "",
      progressBar(claimed.length, Math.max(1, quests.length), Math.max(10, rightWidth - 4)),
      `${Math.round((claimed.length / Math.max(1, quests.length)) * 100)}% board completion`
    ], rightWidth, summaryHeight),
    panelFill("Next Objectives", nextQuests.length > 0
      ? nextQuests.flatMap((quest, index) => [
          `${index === 0 ? ">" : "◇"} ${quest.title}`,
          `  ${quest.progress}/${quest.target} · +${quest.reward} XP`,
          ""
        ])
      : ["No active objectives.", "Create a custom quest to continue."], rightWidth, nextHeight)
  ]);

  return mergeColumns([left, middle, right], [leftWidth, middleWidth, rightWidth], gap).slice(0, height);
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
  if (model.campaigns.length === 0) {
    return panelFill("Campaign Hub", [
      "No campaigns tracked yet.",
      "",
      "Run cq add . to begin a campaign.",
      "Your repository will remain local and untouched."
    ], width, height).map((text) => ({ text }));
  }

  const safeSelected = Math.max(0, Math.min(state.selected.campaigns, model.campaigns.length - 1));
  const current = model.campaigns[safeSelected]!;
  const recent = model.recentActivity.filter((activity) => activity.repositoryName === current.name).slice(0, 10);
  const linkedQuests = model.customQuests.filter((quest) => quest.repositoryName === current.name);
  const activeLinked = linkedQuests.filter((quest) => quest.status === "active");
  const totalCommits = model.campaigns.reduce((sum, campaign) => sum + campaign.commits, 0);
  const totalXp = model.campaigns.reduce((sum, campaign) => sum + campaign.earnedXp, 0);

  if (width < 100) {
    const leftWidth = Math.max(30, Math.floor(width * 0.4));
    const rightWidth = width - leftWidth - 2;
    const { rows } = listRows(
      model.campaigns.map((campaign) => ({ label: campaign.name, meta: `${campaign.commits} commits` })),
      safeSelected,
      Math.max(5, height - 2)
    );
    return columns(
      panelFill("Campaigns", rows, leftWidth, height),
      panelFill("Campaign Detail", campaignDetail(current), rightWidth, height),
      leftWidth,
      rightWidth
    ).map((text) => ({ text }));
  }

  const gap = 2;
  const usable = width - gap * 2;
  const leftWidth = Math.max(30, Math.floor(usable * 0.30));
  const middleWidth = Math.max(42, Math.floor(usable * 0.45));
  const rightWidth = usable - leftWidth - middleWidth;

  const { rows } = listRows(
    model.campaigns.map((campaign) => ({
      label: campaign.name,
      meta: `${campaign.commits}c · +${campaign.earnedXp} XP`
    })),
    safeSelected,
    Math.max(5, height - 8)
  );
  const left = panelFill("Campaign Navigator", [
    `${model.campaigns.length} tracked repositories`,
    `${totalCommits} commits · ${totalXp} XP`,
    "",
    ...rows,
    "",
    "↑↓ select · R refresh"
  ], leftWidth, height);

  const [detailHeight, activityHeight] = splitPanelHeights(height, 0.48);
  const middle = stackPanels([
    panelFill("Campaign Profile", [
      current.name,
      current.defaultBranch ? `Branch: ${current.defaultBranch}` : "Branch: detached",
      "",
      `${current.commits} commits · ${current.releases} releases`,
      `${current.earnedXp.toLocaleString()} activity XP`,
      current.lastActivityAt ? `Last activity: ${formatRelativeDate(current.lastActivityAt)}` : "Last activity: none",
      current.lastScannedAt ? `Last scan: ${formatRelativeDate(current.lastScannedAt)}` : "Last scan: never",
      "",
      "Repository path",
      clip(current.path, Math.max(12, middleWidth - 4))
    ], middleWidth, detailHeight),
    panelFill("Recent Campaign Activity", recent.length > 0
      ? recent.flatMap((activity) => [
          `${activity.type.padEnd(8)} +${String(activity.awardedXp).padStart(3)} XP`,
          `  ${clip(activity.subject, Math.max(12, middleWidth - 6))}`
        ])
      : ["No recent activity in this campaign yet."], middleWidth, activityHeight)
  ]);

  const [overviewHeight, questHeight] = splitPanelHeights(height, 0.48);
  const right = stackPanels([
    panelFill("Campaign Overview", [
      `Share of commits: ${current.commits}/${Math.max(1, totalCommits)}`,
      progressBar(current.commits, Math.max(1, totalCommits), Math.max(10, rightWidth - 4)),
      "",
      `Share of XP: ${current.earnedXp}/${Math.max(1, totalXp)}`,
      progressBar(current.earnedXp, Math.max(1, totalXp), Math.max(10, rightWidth - 4)),
      "",
      `${linkedQuests.length} linked custom quests`,
      `${activeLinked.length} active objectives`
    ], rightWidth, overviewHeight),
    panelFill("Campaign Quests", linkedQuests.length > 0
      ? linkedQuests.slice(0, Math.max(2, questHeight - 4)).flatMap((quest) => [
          `${quest.status === "active" ? "◇" : "◆"} #${quest.id} ${clip(quest.title, Math.max(10, rightWidth - 8))}`,
          `  ${quest.progress}/${quest.target} · +${quest.rewardXp} XP`
        ])
      : ["No custom quests linked.", "Create one with cq quest add."], rightWidth, questHeight)
  ]);

  return mergeColumns([left, middle, right], [leftWidth, middleWidth, rightWidth], gap)
    .slice(0, height)
    .map((text) => ({ text }));
}

function achievementsBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const safeSelected = Math.max(0, Math.min(state.selected.achievements, Math.max(0, model.achievements.length - 1)));
  const current = model.achievements[safeSelected];
  const unlocked = model.achievements.filter((achievement) => achievement.unlocked);
  const locked = model.achievements.filter((achievement) => !achievement.unlocked);
  const totalReward = unlocked.reduce((sum, achievement) => sum + achievement.rewardXp, 0);

  if (width < 100) {
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
    return listDetailBody(items, safeSelected, width, height, "No achievement definitions found.");
  }

  const gap = 2;
  const usable = width - gap * 2;
  const leftWidth = Math.max(34, Math.floor(usable * 0.34));
  const middleWidth = Math.max(38, Math.floor(usable * 0.40));
  const rightWidth = usable - leftWidth - middleWidth;
  const { rows } = listRows(
    model.achievements.map((achievement) => ({
      label: achievement.title,
      meta: achievement.unlocked ? "UNLOCKED" : "LOCKED",
      complete: achievement.unlocked
    })),
    safeSelected,
    Math.max(6, height - 7)
  );

  const left = panelFill("Badge Collection", [
    `${unlocked.length}/${model.achievements.length} unlocked`,
    progressBar(unlocked.length, Math.max(1, model.achievements.length), Math.max(12, leftWidth - 4)),
    "",
    ...rows
  ], leftWidth, height);

  const [detailHeight, loreHeight] = splitPanelHeights(height, 0.62);
  const middle = stackPanels([
    panelFill("Selected Badge", current ? [
      current.unlocked ? "◆ UNLOCKED" : "◇ LOCKED",
      "",
      center(current.unlocked ? "◆" : "◇", Math.max(10, middleWidth - 4)),
      "",
      current.title,
      current.description,
      "",
      `Reward: +${current.rewardXp} XP`,
      current.unlockedAt ? `Unlocked: ${formatRelativeDate(current.unlockedAt)}` : "Condition not yet met."
    ] : ["No achievements found."], middleWidth, detailHeight),
    panelFill("Badge Lore", current ? [
      current.unlocked
        ? "This badge is permanently part of your developer journey."
        : "Complete the condition above to add this badge to your collection.",
      "",
      current.unlocked ? "Reward claimed safely once." : "Locked badges reveal their exact condition.",
      "",
      `Collection XP: +${totalReward}`
    ] : ["No badge selected."], middleWidth, loreHeight)
  ]);

  const [statsHeight, unlocksHeight] = splitPanelHeights(height, 0.44);
  const right = stackPanels([
    panelFill("Collection Stats", [
      `${unlocked.length} badges unlocked`,
      `${locked.length} badges remaining`,
      `+${totalReward} achievement XP`,
      "",
      progressBar(unlocked.length, Math.max(1, model.achievements.length), Math.max(10, rightWidth - 4)),
      `${Math.round((unlocked.length / Math.max(1, model.achievements.length)) * 100)}% complete`
    ], rightWidth, statsHeight),
    panelFill("Recent Unlocks", unlocked.length > 0
      ? unlocked.slice(0, Math.max(2, unlocksHeight - 4)).flatMap((achievement) => [
          `◆ ${clip(achievement.title, Math.max(10, rightWidth - 4))}`,
          `  +${achievement.rewardXp} XP · ${achievement.unlockedAt ? formatRelativeDate(achievement.unlockedAt) : "unlocked"}`
        ])
      : ["No badges unlocked yet.", "Your first reward is waiting."], rightWidth, unlocksHeight)
  ]);

  return mergeColumns([left, middle, right], [leftWidth, middleWidth, rightWidth], gap)
    .slice(0, height)
    .map((text) => ({ text }));
}

function barRow(stat: TuiCommitTypeStat, max: number, width: number): string {
  const barWidth = Math.max(8, width - 25);
  return `${stat.type.padEnd(10)} ${progressBar(stat.count, max, barWidth)} ${String(stat.count).padStart(3)}  +${stat.xp} XP`;
}

function progressBody(model: TuiModel, width: number, height: number): Line[] {
  const totalCommitXp = model.commitTypes.reduce((sum, stat) => sum + stat.xp, 0);
  const dailyValues = [...model.dailyXp].reverse().map((day) => day.xp);
  const summary = summaryCards([
    { title: "Level", value: `${model.level.level}`, subtitle: model.level.title },
    { title: "Total XP", value: model.totalXp.toLocaleString(), subtitle: `${model.level.xpNeeded - model.level.xpIntoLevel} XP to next level` },
    { title: "Streak", value: `${model.streak.current} days`, subtitle: `${model.streak.longest} day best` },
    { title: "Activity", value: `${model.stats.commits}`, subtitle: `${model.stats.repositories} campaigns` }
  ], width);

  const levelPanel = panel("Level Progress", [
    `Level ${model.level.level} · ${model.level.title}`,
    "",
    `${progressBar(model.level.xpIntoLevel, model.level.xpNeeded, Math.max(20, width - 20))}`,
    `${model.level.xpIntoLevel}/${model.level.xpNeeded} XP · ${model.level.xpNeeded - model.level.xpIntoLevel} XP remaining`
  ], width);

  const maxCount = Math.max(1, ...model.commitTypes.map((stat) => stat.count));
  const leftWidth = width >= 110 ? Math.floor((width - 2) * 0.58) : width;
  const rightWidth = width >= 110 ? width - leftWidth - 2 : width;
  const typeLines = model.commitTypes.length > 0
    ? model.commitTypes.slice(0, 10).map((stat) => barRow(stat, maxCount, Math.max(28, leftWidth - 4)))
    : ["No commit activity yet."];
  const historyLines = model.dailyXp.length > 0
    ? [
        sparkline(dailyValues, Math.max(12, rightWidth - 4)),
        "",
        ...model.dailyXp.slice(0, 7).map((day) => `${day.date}  ${String(day.xp).padStart(5)} XP`)
      ]
    : ["No XP history yet."];

  const lowerLeft = stackPanels([
    panel("Commit Type Breakdown", typeLines, leftWidth),
    panel("Reward Sources", [
      `Commit XP tracked: ${totalCommitXp}`,
      `Quest rewards: ${model.stats.questRewards}`,
      `Achievement rewards: ${model.stats.achievements}`,
      `Releases shipped: ${model.stats.releases}`
    ], leftWidth)
  ]);
  const lowerRight = stackPanels([
    panel("14-Day XP Trend", historyLines, rightWidth),
    panel("Journey Milestones", [
      `${model.stats.commits} rewarded commits`,
      `${model.stats.repositories} active campaigns`,
      `${model.stats.achievements} badges unlocked`,
      `${model.streak.longest} day longest streak`
    ], rightWidth)
  ]);

  const output: Line[] = [
    ...summary.map((value) => ({ text: value })),
    { text: "" },
    ...levelPanel.map((value) => ({ text: value })),
    { text: "" }
  ];
  if (width >= 110) {
    output.push(...columns(lowerLeft, lowerRight, leftWidth, rightWidth).map((value) => ({ text: value })));
  } else {
    output.push(...lowerLeft.map((value) => ({ text: value })), { text: "" }, ...lowerRight.map((value) => ({ text: value })));
  }
  return output.slice(0, height);
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
  if (width < 92) {
    const items = model.recentActivity.map((activity) => ({
      label: activity.subject,
      meta: `+${activity.awardedXp} XP`,
      detail: activityDetail(activity),
      complete: activity.kind === "release"
    }));
    return listDetailBody(items, state.selected.log, width, height, "Your adventure log is empty.");
  }

  const totalRewarded = model.recentActivity.reduce((sum, activity) => sum + activity.awardedXp, 0);
  const releases = model.recentActivity.filter((activity) => activity.kind === "release").length;
  const summary = summaryCards([
    { title: "Entries", value: String(model.recentActivity.length), subtitle: "recent rewards" },
    { title: "Recent XP", value: `+${totalRewarded}`, subtitle: "shown in this log" },
    { title: "Releases", value: String(releases), subtitle: "boss battles recorded" }
  ], width);

  const safeSelected = Math.max(0, Math.min(state.selected.log, Math.max(0, model.recentActivity.length - 1)));
  const current = model.recentActivity[safeSelected];
  const leftWidth = Math.max(34, Math.floor(width * 0.42));
  const rightWidth = width - leftWidth - 2;
  const { rows } = listRows(
    model.recentActivity.map((activity) => ({
      label: activity.subject,
      meta: `+${activity.awardedXp} XP`,
      complete: activity.kind === "release"
    })),
    safeSelected,
    Math.max(4, height - summary.length - 4)
  );

  const listPanel = panel("Adventure Log", rows.length > 0 ? rows : ["Your adventure log is empty."], leftWidth);
  const detailPanel = panel("Reward Detail", current ? activityDetail(current) : ["No activity yet."], rightWidth);
  const contextPanel = panel("Context", current ? [
    `Type: ${current.kind}`,
    `Commit class: ${current.type}`,
    `Campaign: ${current.repositoryName}`,
    `Occurred: ${formatRelativeDate(current.occurredAt)}`
  ] : ["No activity context yet."], rightWidth);

  return [
    ...summary.map((text) => ({ text })),
    { text: "" },
    ...columns(listPanel, stackPanels([detailPanel, contextPanel]), leftWidth, rightWidth).map((text) => ({ text }))
  ].slice(0, height);
}

function themePreviewPanel(theme: TuiTheme, width: number): string[] {
  return panel("Theme Preview", [
    `Theme        ${theme.name}`,
    `${sectionTitle("Sample Interface", Math.max(12, width - 4))}`,
    ` Header       COMMITQUEST  ${APP_VERSION}`,
    ` Highlight    Level up by shipping real work`,
    ` Accent       Active quest · Build Momentum`,
    ` Success      Reward unlocked · +80 XP`,
    ` Muted        Saved themes return when CommitQuest reopens.`
  ], width);
}

function themesBody(state: TuiState, width: number, height: number, activeTheme: TuiTheme): Line[] {
  const previewTheme = TUI_THEMES[state.selected.themes] ?? activeTheme;
  const summary = summaryCards([
    { title: "Current", value: activeTheme.name, subtitle: "saved theme" },
    { title: "Preview", value: previewTheme.name, subtitle: previewTheme.id === activeTheme.id ? "already active" : "press Enter to save" },
    { title: "Palette", value: `${TUI_THEMES.length}`, subtitle: "available themes" }
  ], width);

  const leftWidth = Math.max(28, Math.floor(width * 0.34));
  const rightWidth = width - leftWidth - 2;
  const { rows } = listRows(
    TUI_THEMES.map((theme) => ({
      label: theme.name,
      meta: theme.id === activeTheme.id ? "ACTIVE" : "PREVIEW",
      complete: theme.id === activeTheme.id
    })),
    state.selected.themes,
    Math.max(4, height - summary.length - 4)
  );
  const listPanel = panel("Themes", rows, leftWidth);
  const detailPanel = panel("Palette Detail", [
    previewTheme.description,
    "",
    `Background  ${previewTheme.background}`,
    `Surface     ${previewTheme.surface}`,
    `Accent      ${previewTheme.accent}`,
    `Highlight   ${previewTheme.accentAlt}`,
    `Success     ${previewTheme.success}`,
    "",
    previewTheme.id === activeTheme.id ? "This theme is currently saved." : "Live preview · press Enter to save."
  ], rightWidth);

  return [
    ...summary.map((text) => ({ text })),
    { text: "" },
    ...columns(listPanel, stackPanels([detailPanel, themePreviewPanel(previewTheme, rightWidth)]), leftWidth, rightWidth).map((text) => ({ text }))
  ].slice(0, height);
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

function bodyLines(model: TuiModel, state: TuiState, width: number, height: number, activeTheme: TuiTheme, pulse = false): Line[] {
  if (state.helpOpen) return helpBody(width);
  switch (state.screen) {
    case "home": return homeBody(model, state, width, height, pulse);
    case "quests": return renderQuestColumns(model, state, width, height).map((text) => ({ text }));
    case "campaigns": return campaignsBody(model, state, width, height);
    case "achievements": return achievementsBody(model, state, width, height);
    case "progress": return progressBody(model, width, height);
    case "log": return logBody(model, state, width, height);
    case "themes": return themesBody(state, width, height, activeTheme);
  }
}

function applyRewardModal(lines: Line[], model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  if (!state.modalOpen || !model.rewardModal) return lines;
  const modal = model.rewardModal;
  const modalWidth = Math.min(82, Math.max(52, width - 18));
  const content = [
    center(modal.eyebrow, modalWidth - 2),
    center(modal.title, modalWidth - 2),
    "",
    ...modal.lines.slice(0, 6).map((line) => `◆ ${clip(line, modalWidth - 6)}`),
    "",
    center("Enter or Esc to continue", modalWidth - 2)
  ];
  const box = panel("Reward Unlocked", content, modalWidth);
  const top = Math.max(1, Math.floor((height - box.length) / 2));
  const output = [...lines];
  for (let index = 0; index < box.length && top + index < output.length; index += 1) {
    output[top + index] = {
      text: center(box[index] ?? "", width),
      tone: index === 1 || index === 2 ? "success" : index === 0 || index === box.length - 1 ? "accent" : "normal",
      background: "surfaceAlt"
    };
  }
  return output;
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
    const body = bodyLines(model, state, width, height - 1, activeTheme, options.pulse ?? false).slice(0, height - 1);
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
    const body = padLines(
      bodyLines(model, state, width, bodyHeight, activeTheme, options.pulse ?? false).map((line) => line.text),
      width,
      bodyHeight
    );

    lines = [
      { text: align(headerLeft, headerRight, width), tone: "title", background: "surface" },
      { text: align(xpLeft, xpRight, width), tone: "muted", background: "surface" },
      { text: screenTabs(state, width), tone: "accent", background: "surfaceAlt" },
      { text: ` ${screenTitle(state).toUpperCase()}`, tone: "accentAlt" },
      ...body.map((text) => ({ text })),
      footer
    ];
  }

  lines = applyRewardModal(lines, model, state, width, height);
  return lines.slice(0, height).map((line) => renderLine(line, width, previewTheme, color)).join("\n");
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export const TUI_MINIMUM_SIZE = { width: MIN_WIDTH, height: MIN_HEIGHT } as const;
export { FOOTER_CREDIT };
