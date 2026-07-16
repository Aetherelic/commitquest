import chalk from "chalk";
import { formatRelativeDate } from "../core/dates.js";
import { customQuestObjectiveLabel } from "../core/custom-quests.js";
import { HOME_MENU } from "./navigation.js";
import { filteredPaletteEntries } from "./actions.js";
import { getTuiTheme, TUI_THEMES, type TuiTheme } from "./theme.js";
import { APP_VERSION as VERSION } from "../version.js";
import type {
  TerminalSize,
  TuiActivity,
  TuiCampaign,
  TuiCommitTypeStat,
  TuiFormOverlay,
  TuiModel,
  TuiState
} from "./types.js";

const ANSI_PATTERN = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const FOOTER_CREDIT = "Made with <3 by Aetherelic";
const MIN_WIDTH = 68;
const MIN_HEIGHT = 20;
const APP_VERSION = `v${VERSION}`;

interface RenderOptions {
  color?: boolean;
  theme?: TuiTheme;
  pulse?: boolean;
  motion?: "full" | "reduced";
  colorMode?: "auto" | "always" | "never";
}

type Tone = "normal" | "accent" | "accentAlt" | "muted" | "success" | "warning" | "danger" | "selected" | "title";
type Background = "background" | "surface" | "surfaceAlt" | "accent";

interface Segment {
  text: string;
  tone?: Tone | undefined;
  background?: Background | undefined;
  foregroundHex?: string | undefined;
  backgroundHex?: string | undefined;
  bold?: boolean | undefined;
}

interface Line {
  text?: string | undefined;
  segments?: Segment[] | undefined;
  tone?: Tone | undefined;
  background?: Background | undefined;
}

interface QuestRow {
  title: string;
  subtitle: string;
  description: string;
  progress: number;
  target: number;
  reward: number;
  state: string;
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
  if (values.length === 0) return "·".repeat(width);
  const blocks = "▁▂▃▄▅▆▇█";
  const max = Math.max(1, ...values);
  const sample = values.length <= width
    ? values
    : Array.from({ length: width }, (_, index) => {
      const start = Math.floor(index * values.length / width);
      const end = Math.max(start + 1, Math.floor((index + 1) * values.length / width));
      return Math.max(...values.slice(start, end));
    });
  return sample
    .map((value) => blocks[Math.min(blocks.length - 1, Math.round((value / max) * (blocks.length - 1)))])
    .join("")
    .padStart(width, "·")
    .slice(-width);
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

function styleText(
  value: string,
  theme: TuiTheme,
  tone: Tone,
  backgroundTone: Background,
  bold = false,
  foregroundHex?: string,
  backgroundHex?: string
): string {
  let styler = chalk
    .bgHex(backgroundHex ?? background(theme, backgroundTone))
    .hex(foregroundHex ?? foreground(theme, tone));
  if (bold || tone === "title" || tone === "selected") styler = styler.bold;
  return styler(value);
}

function visibleText(line: Line): string {
  return line.segments?.map((segment) => segment.text).join("") ?? line.text ?? "";
}

/**
 * Reuses deliberate blank separators as breathing room instead of leaving a
 * large unused block at the bottom of tall terminals. Content order remains
 * unchanged and no extra framing is introduced.
 */
function spreadVertically(lines: Line[], height: number): Line[] {
  if (lines.length >= height) return lines.slice(0, height);
  const gapIndexes = lines
    .map((line, index) => visibleText(line).trim() === "" ? index : -1)
    .filter((index) => index >= 0);
  if (gapIndexes.length === 0) return lines;

  const additions = Math.min(height - lines.length, gapIndexes.length * 2);
  const repeats = new Map<number, number>();
  for (let index = 0; index < additions; index += 1) {
    const gapIndex = gapIndexes[index % gapIndexes.length]!;
    repeats.set(gapIndex, (repeats.get(gapIndex) ?? 0) + 1);
  }

  const output: Line[] = [];
  lines.forEach((line, index) => {
    output.push(line);
    for (let count = 0; count < (repeats.get(index) ?? 0); count += 1) output.push(blank());
  });
  return output.slice(0, height);
}

function segmentsForWidth(line: Line, width: number): Segment[] {
  const source = line.segments ?? [{
    text: line.text ?? "",
    tone: line.tone,
    background: line.background
  }];
  const output: Segment[] = [];
  let remaining = Math.max(0, width);
  for (const segment of source) {
    if (remaining <= 0) break;
    const value = clip(segment.text, remaining);
    output.push({ ...segment, text: value });
    remaining -= value.length;
  }
  if (remaining > 0) {
    output.push({
      text: " ".repeat(remaining),
      tone: line.tone ?? "normal",
      background: line.background ?? "background"
    });
  }
  return output;
}

function renderLine(line: Line, width: number, theme: TuiTheme, color: boolean): string {
  if (!line.segments) {
    const text = fit(line.text ?? "", width);
    if (!color) return text;
    const tone = line.tone ?? "normal";
    const backgroundTone = line.background ?? (tone === "selected" ? "accent" : "background");
    return styleText(text, theme, tone, backgroundTone);
  }

  const segments = segmentsForWidth(line, width);
  if (!color) return segments.map((segment) => segment.text).join("");
  const lineBackground = line.background ?? "background";
  return segments.map((segment) => styleText(
    segment.text,
    theme,
    segment.tone ?? line.tone ?? "normal",
    segment.background ?? lineBackground,
    segment.bold ?? false,
    segment.foregroundHex,
    segment.backgroundHex
  )).join("");
}

function part(text: string, tone: Tone = "normal", bold = false, backgroundTone?: Background): Segment {
  return {
    text,
    tone,
    bold,
    ...(backgroundTone === undefined ? {} : { background: backgroundTone })
  };
}

function palettePart(text: string, foregroundHex: string, backgroundHex?: string): Segment {
  return {
    text,
    foregroundHex,
    ...(backgroundHex === undefined ? {} : { backgroundHex })
  };
}

function blank(): Line {
  return { text: "" };
}

function textLine(text: string, tone: Tone = "normal", backgroundTone?: Background): Line {
  return {
    text,
    tone,
    ...(backgroundTone === undefined ? {} : { background: backgroundTone })
  };
}

function sectionLine(label: string, width: number, detail = ""): Line {
  const title = ` ${label.toUpperCase()} `;
  const detailText = detail ? ` ${detail} ` : "";
  const ruleWidth = Math.max(1, width - title.length - detailText.length);
  return {
    segments: [
      part(title, "accent", true),
      part("─".repeat(ruleWidth), "muted"),
      ...(detailText ? [part(detailText, "muted")] : [])
    ]
  };
}

function progressLine(value: number, target: number, width: number, tone: Tone = "accent"): Line {
  const safeWidth = Math.max(4, width);
  const percentage = target <= 0 ? 1 : Math.max(0, Math.min(1, value / target));
  const filled = Math.round(percentage * safeWidth);
  return {
    segments: [
      part("━".repeat(filled), tone, true),
      part("─".repeat(Math.max(0, safeWidth - filled)), "muted")
    ]
  };
}

function columnsLines(columns: Line[][], widths: number[], gap = 3): Line[] {
  const height = Math.max(0, ...columns.map((column) => column.length));
  const output: Line[] = [];
  for (let row = 0; row < height; row += 1) {
    const segments: Segment[] = [];
    columns.forEach((column, index) => {
      const width = widths[index] ?? 0;
      segments.push(...segmentsForWidth(column[row] ?? blank(), width));
      if (index < columns.length - 1) segments.push(part(" ".repeat(gap), "normal"));
    });
    output.push({ segments });
  }
  return output;
}

function stackSections(sections: Line[][], gap = 1): Line[] {
  const output: Line[] = [];
  sections.forEach((lines, index) => {
    output.push(...lines);
    if (index < sections.length - 1) {
      for (let count = 0; count < gap; count += 1) output.push(blank());
    }
  });
  return output;
}

function selectedWindow<T>(items: T[], selected: number, capacity: number): { items: T[]; offset: number } {
  if (capacity <= 0 || items.length <= capacity) return { items: items.slice(0, Math.max(0, capacity)), offset: 0 };
  const half = Math.floor(capacity / 2);
  const offset = Math.max(0, Math.min(items.length - capacity, selected - half));
  return { items: items.slice(offset, offset + capacity), offset };
}

function statusTone(status: string): Tone {
  const normalized = status.toLowerCase();
  if (["complete", "completed", "claimed", "unlocked", "active"].includes(normalized)) {
    return normalized === "active" ? "accentAlt" : "success";
  }
  if (["preparing", "warning", "archived"].includes(normalized)) return "warning";
  if (["failed", "blocked", "danger"].includes(normalized)) return "danger";
  return "muted";
}

function activityTone(activity: TuiActivity): Tone {
  if (activity.kind === "release") return "success";
  switch (activity.type) {
    case "feat": return "accentAlt";
    case "fix": return "danger";
    case "docs": return "accent";
    case "test": return "warning";
    case "build": return "success";
    default: return "muted";
  }
}

function metricStrip(
  cards: Array<{ label: string; value: string; subtitle: string; tone?: Tone | undefined }>,
  width: number
): Line[] {
  if (cards.length === 0) return [];
  const gap = 3;
  const base = Math.max(12, Math.floor((width - gap * (cards.length - 1)) / cards.length));
  const widths = cards.map((_, index) => index === cards.length - 1
    ? width - base * (cards.length - 1) - gap * (cards.length - 1)
    : base);
  const columns = cards.map((card) => [
    { segments: [part(card.label.toUpperCase(), "muted", true)] },
    { segments: [part(card.value, card.tone ?? "accent", true)] },
    { segments: [part(card.subtitle, "muted")] }
  ] satisfies Line[]);
  return columnsLines(columns, widths, gap);
}

function listItem(
  label: string,
  meta: string,
  width: number,
  selected: boolean,
  markerTone: Tone = "muted"
): Line {
  const marker = selected ? "◆" : "·";
  const leftBudget = Math.max(6, width - meta.length - 4);
  const left = `${marker} ${clip(label, leftBudget)}`;
  const spaces = " ".repeat(Math.max(1, width - left.length - meta.length));
  return {
    background: selected ? "surfaceAlt" : "background",
    segments: [
      part(marker, selected ? "accent" : markerTone, true, selected ? "surfaceAlt" : "background"),
      part(` ${clip(label, leftBudget)}`, selected ? "title" : "normal", selected, selected ? "surfaceAlt" : "background"),
      part(spaces, "normal", false, selected ? "surfaceAlt" : "background"),
      part(meta, selected ? "accentAlt" : markerTone, selected, selected ? "surfaceAlt" : "background")
    ]
  };
}

function keyValue(label: string, value: string, valueTone: Tone = "normal"): Line {
  return {
    segments: [
      part(`${label.padEnd(15)} `, "muted"),
      part(value, valueTone, valueTone !== "normal" && valueTone !== "muted")
    ]
  };
}

function quoteLine(value: string, tone: Tone = "muted"): Line {
  return { segments: [part("│ ", "muted"), part(value, tone)] };
}

function questRows(model: TuiModel): QuestRow[] {
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

function logoRows(word = "COMMITQUEST"): string[] {
  const font: Record<string, readonly string[]> = {
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
  return Array.from({ length: 5 }, (_, row) =>
    [...word].map((letter) => font[letter]?.[row] ?? "     ").join(" ")
  );
}

function homeBody(model: TuiModel, state: TuiState, width: number, height: number, pulse = false): Line[] {
  const activeQuest = questRows(model).find((quest) => quest.state === "active") ?? null;
  const latest = model.recentActivity[0] ?? null;
  const logo = logoRows();
  const menuWidth = Math.min(88, Math.max(62, width - 18));
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
    blank(),
    { text: center(profileLine, width), tone: "accentAlt" },
    { text: center(progress, width), tone: "muted" },
    { text: center(journeyLine, width), tone: "muted" },
    blank(),
    ...menuLines,
    blank(),
    { text: center("CURRENT OBJECTIVE", width), tone: "muted" },
    { text: center(objective, width), tone: activeQuest ? "success" : "muted" },
    { text: center(latestReward, width), tone: "muted" },
    blank(),
    { text: center(notice, width), tone: model.warnings.length > 0 ? "warning" : "muted" }
  ];

  const topPadding = Math.max(0, Math.floor((height - content.length) / 2));
  return [...Array.from({ length: topPadding }, blank), ...content].slice(0, height);
}

function profileBody(model: TuiModel, width: number, height: number): Line[] {
  const selectedClass = model.classes.find((entry) => entry.selected) ?? model.classes[0];
  const classTitle = selectedClass?.unlockedSkills.at(-1)?.title ?? selectedClass?.title ?? "Unbound Adventurer";
  const badges = model.achievements.filter((achievement) => achievement.unlocked);
  const activeQuests = questRows(model).filter((quest) => quest.state === "active");
  const latest = model.recentActivity.slice(0, 5);
  const initials = model.profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() ?? "")
    .join("") || "CQ";

  const header: Line[] = [
    { segments: [part(model.profile.name.toUpperCase(), "title", true), part(`  ${initials}`, "accent", true)] },
    { segments: [part(classTitle, "accentAlt", true), part(`  ·  ${selectedClass?.title ?? "No path selected"}`, "muted")] },
    { segments: [part(`LEVEL ${model.level.level}`, "accent", true), part(`  ${model.level.title}`, "normal"), part(`  ·  ${model.totalXp.toLocaleString()} XP`, "muted")] },
    progressLine(model.level.xpIntoLevel, model.level.xpNeeded, Math.max(18, width - 2), "accent")
  ];

  const summary = metricStrip([
    { label: "Current streak", value: `${model.streak.current} days`, subtitle: `${model.streak.longest} day personal best`, tone: "success" },
    { label: "Rewarded work", value: `${model.stats.commits} commits`, subtitle: `${model.stats.releases} releases shipped`, tone: "accentAlt" },
    { label: "Campaigns", value: String(model.stats.repositories), subtitle: `${activeQuests.length} active objectives`, tone: "accent" },
    { label: "Badge cabinet", value: `${badges.length}/${model.achievements.length}`, subtitle: "permanent achievements", tone: "warning" }
  ], width);

  const identity: Line[] = [
    sectionLine("Identity", Math.max(24, Math.floor(width * 0.30))),
    blank(),
    keyValue("Player", model.profile.name, "title"),
    keyValue("Rank", model.level.title, "accent"),
    keyValue("Path", selectedClass?.title ?? "Unselected", "accentAlt"),
    keyValue("Path title", classTitle, "success"),
    keyValue("Level", String(model.level.level), "accent"),
    keyValue("Total XP", model.totalXp.toLocaleString(), "accentAlt"),
    blank(),
    quoteLine("A local-first developer journey."),
    quoteLine("Every reward came from real work.", "success")
  ];

  const journey: Line[] = [
    sectionLine("Journey Record", Math.max(28, Math.floor(width * 0.34))),
    blank(),
    keyValue("Commits", String(model.stats.commits), "accentAlt"),
    keyValue("Releases", String(model.stats.releases), "success"),
    keyValue("Campaigns", String(model.stats.repositories), "accent"),
    keyValue("Quests claimed", String(model.stats.questRewards), "warning"),
    keyValue("Badges", String(model.stats.achievements), "success"),
    keyValue("Best streak", `${model.streak.longest} days`, "accentAlt"),
    blank(),
    sectionLine("Current Objective", Math.max(28, Math.floor(width * 0.34))),
    ...(activeQuests[0]
      ? [
          { segments: [part(activeQuests[0].title, "title", true)] },
          { segments: [part(`${activeQuests[0].progress}/${activeQuests[0].target} progress`, "accentAlt"), part(`  +${activeQuests[0].reward} XP`, "success")] }
        ]
      : [textLine("No active objective.", "muted")])
  ];

  const cabinet: Line[] = [
    sectionLine("Badge Cabinet", Math.max(24, width - Math.floor(width * 0.30) - Math.floor(width * 0.34) - 6)),
    blank(),
    ...(badges.length > 0
      ? badges.slice(0, 8).flatMap((badge) => [
          { segments: [part("◆ ", "success", true), part(badge.title, "normal", true)] },
          { segments: [part(`  +${badge.rewardXp} XP`, "muted"), ...(badge.unlockedAt ? [part(`  ${formatRelativeDate(badge.unlockedAt)}`, "accentAlt")] : [])] }
        ])
      : [textLine("No badges unlocked yet.", "muted")]),
    blank(),
    { segments: [part(`${badges.length}`, "warning", true), part(" badges currently displayed", "muted")] }
  ];

  const lower: Line[] = [
    sectionLine("Recent Momentum", width, `${latest.length} latest rewards`),
    blank(),
    ...(latest.length > 0
      ? latest.map((activity) => ({
          segments: [
            part(activity.kind === "release" ? "◆" : "·", activityTone(activity), true),
            part(` ${activity.type.padEnd(8)}`, activityTone(activity), true),
            part(clip(activity.subject, Math.max(16, width - 42)), "normal"),
            part(`  +${activity.awardedXp} XP`, "success", true),
            part(`  ${formatRelativeDate(activity.occurredAt)}`, "muted")
          ]
        }))
      : [textLine("Your next rewarded commit will appear here.", "muted")])
  ];

  const output: Line[] = [...header, blank(), ...summary, blank()];
  if (width >= 105) {
    const gap = 3;
    const leftWidth = Math.floor((width - gap * 2) * 0.30);
    const middleWidth = Math.floor((width - gap * 2) * 0.34);
    const rightWidth = width - gap * 2 - leftWidth - middleWidth;
    output.push(...columnsLines([identity, journey, cabinet], [leftWidth, middleWidth, rightWidth], gap));
  } else {
    output.push(...identity, blank(), ...journey, blank(), ...cabinet);
  }
  output.push(blank(), ...lower);
  return output.slice(0, height);
}

function questsBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const quests = questRows(model);
  if (quests.length === 0) return [sectionLine("Quest Board", width), blank(), { text: "No quests are available yet.", tone: "muted" }];
  const selected = Math.max(0, Math.min(state.selected.quests, quests.length - 1));
  const current = quests[selected]!;
  const complete = quests.filter((quest) => ["complete", "claimed", "completed"].includes(quest.state)).length;
  const active = quests.filter((quest) => quest.state === "active");
  const custom = model.customQuests.filter((quest) => quest.status === "active").length;
  const summary = metricStrip([
    { label: "Active", value: String(active.length), subtitle: "objectives in motion", tone: "accentAlt" },
    { label: "Claimed", value: `${complete}/${quests.length}`, subtitle: "rewards secured", tone: "success" },
    { label: "Custom", value: String(custom), subtitle: "player-made quests", tone: "warning" }
  ], width);

  const guidance = current.state === "active"
    ? current.subtitle.toLowerCase().includes("release") || current.description.toLowerCase().includes("release")
      ? "Prepare a release encounter, create a tag, then scan the campaign."
      : current.subtitle.toLowerCase().includes("commit")
        ? "Use the matching conventional commit type in a tracked campaign."
        : "Continue eligible work in a tracked campaign; progress updates automatically."
    : "This reward is secured permanently and cannot be claimed twice.";

  const listWidth = width >= 96 ? Math.max(34, Math.floor(width * 0.36)) : width;
  const detailWidth = width >= 96 ? width - listWidth - 4 : width;
  const capacity = Math.max(5, height - summary.length - 5);
  const window = selectedWindow(quests, selected, capacity);
  const list: Line[] = [
    sectionLine("Quest Board", listWidth, `${selected + 1}/${quests.length}`),
    blank(),
    ...window.items.map((quest, index) => {
      const absolute = window.offset + index;
      const tone = statusTone(quest.state);
      return listItem(quest.title, `${quest.progress}/${quest.target}  +${quest.reward}`, listWidth, absolute === selected, tone);
    })
  ];

  const detail: Line[] = [
    sectionLine("Selected Objective", detailWidth, current.state.toUpperCase()),
    blank(),
    { segments: [part(current.state === "active" ? "◇ ACTIVE" : "◆ COMPLETE", statusTone(current.state), true)] },
    { segments: [part(current.title, "title", true)] },
    { text: current.subtitle, tone: "muted" },
    blank(),
    quoteLine(current.description, "normal"),
    blank(),
    progressLine(current.progress, current.target, Math.max(12, detailWidth - 2), current.state === "active" ? "accent" : "success"),
    { segments: [
      part(`${current.progress}/${current.target} progress`, "accentAlt", true),
      part(`  ·  +${current.reward} XP`, "success", true)
    ] },
    blank(),
    sectionLine("How To Progress", detailWidth),
    blank(),
    { text: guidance, tone: current.state === "active" ? "normal" : "success" },
    blank(),
    sectionLine("Next Objectives", detailWidth),
    blank(),
    ...(active.filter((quest) => quest !== current).slice(0, 4).length > 0
      ? active.filter((quest) => quest !== current).slice(0, 4).map((quest) => ({
          segments: [part("· ", "accentAlt"), part(quest.title, "normal"), part(`  ${quest.progress}/${quest.target}`, "muted")]
        }))
      : [textLine("No other active objectives. Create a custom quest with N.", "muted")])
  ];

  return [
    ...summary,
    blank(),
    ...(width >= 96 ? columnsLines([list, detail], [listWidth, detailWidth], 4) : stackSections([list, detail], 1))
  ].slice(0, height);
}

function campaignDetailLines(campaign: TuiCampaign, width: number): Line[] {
  return [
    sectionLine("Campaign Profile", width, campaign.archived ? "ARCHIVED" : "ACTIVE"),
    blank(),
    { segments: [part(campaign.archived ? "◇ ARCHIVED" : "◆ ACTIVE", campaign.archived ? "warning" : "success", true)] },
    { segments: [part(campaign.name, "title", true)] },
    { text: campaign.defaultBranch ? `Branch ${campaign.defaultBranch}` : "Detached branch", tone: "accentAlt" },
    blank(),
    keyValue("Commits", String(campaign.commits), "accentAlt"),
    keyValue("Releases", String(campaign.releases), "success"),
    keyValue("Activity XP", campaign.earnedXp.toLocaleString(), "accent"),
    keyValue("Last activity", campaign.lastActivityAt ? formatRelativeDate(campaign.lastActivityAt) : "none", "muted"),
    keyValue("Last scan", campaign.lastScannedAt ? formatRelativeDate(campaign.lastScannedAt) : "never", "muted"),
    blank(),
    sectionLine("Repository", width),
    { text: clip(campaign.path, width), tone: "muted" }
  ];
}

function campaignsBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  if (model.campaigns.length === 0) {
    return [
      sectionLine("Campaigns", width),
      blank(),
      { text: "No campaigns tracked yet.", tone: "muted" },
      { text: "Run cq add . or press N to begin a local campaign.", tone: "accent" }
    ];
  }

  const selected = Math.max(0, Math.min(state.selected.campaigns, model.campaigns.length - 1));
  const current = model.campaigns[selected]!;
  const totalCommits = model.campaigns.reduce((sum, campaign) => sum + campaign.commits, 0);
  const totalXp = model.campaigns.reduce((sum, campaign) => sum + campaign.earnedXp, 0);
  const activeCampaigns = model.campaigns.filter((campaign) => !campaign.archived).length;
  const recent = model.recentActivity.filter((activity) => activity.repositoryName === current.name).slice(0, 7);
  const linkedQuests = model.customQuests.filter((quest) => quest.repositoryName === current.name);
  const summary = metricStrip([
    { label: "Tracked", value: String(model.campaigns.length), subtitle: `${activeCampaigns} scanning automatically`, tone: "accent" },
    { label: "Commits", value: String(totalCommits), subtitle: "across all campaigns", tone: "accentAlt" },
    { label: "Activity XP", value: totalXp.toLocaleString(), subtitle: "repository rewards", tone: "success" }
  ], width);

  const listWidth = width >= 100 ? Math.max(34, Math.floor(width * 0.32)) : width;
  const detailWidth = width >= 100 ? width - listWidth - 4 : width;
  const window = selectedWindow(model.campaigns, selected, Math.max(5, height - summary.length - 5));
  const list: Line[] = [
    sectionLine("Campaign Navigator", listWidth, `${selected + 1}/${model.campaigns.length}`),
    blank(),
    ...window.items.map((campaign, index) => listItem(
      campaign.name,
      campaign.archived ? "ARCHIVED" : `${campaign.commits}c  +${campaign.earnedXp}`,
      listWidth,
      window.offset + index === selected,
      campaign.archived ? "warning" : "success"
    )),
    blank(),
    { text: "N add · S scan · P repair · X archive · D remove", tone: "muted" }
  ];

  const details = campaignDetailLines(current, detailWidth);
  details.push(
    blank(),
    sectionLine("Recent Campaign Activity", detailWidth),
    blank(),
    ...(recent.length > 0
      ? recent.map((activity) => ({
          segments: [
            part(activity.kind === "release" ? "◆" : "·", activityTone(activity), true),
            part(` ${activity.type.padEnd(8)}`, activityTone(activity), true),
            part(clip(activity.subject, Math.max(10, detailWidth - 31)), "normal"),
            part(` +${activity.awardedXp} XP`, "success", true)
          ]
        }))
      : [textLine("No recent activity in this campaign.", "muted")]),
    blank(),
    sectionLine("Linked Quests", detailWidth, `${linkedQuests.length}`),
    ...(linkedQuests.length > 0
      ? linkedQuests.slice(0, 4).map((quest) => ({
          segments: [part(quest.status === "active" ? "◇ " : "◆ ", statusTone(quest.status), true), part(quest.title, "normal"), part(`  ${quest.progress}/${quest.target}`, "muted")]
        }))
      : [textLine("No custom quests linked to this campaign.", "muted")])
  );

  return [
    ...summary,
    blank(),
    ...(width >= 100 ? columnsLines([list, details], [listWidth, detailWidth], 4) : stackSections([list, details], 1))
  ].slice(0, height);
}

function chaptersBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  if (model.chapters.length === 0) {
    return [sectionLine("Campaign Chapters", width), blank(), { text: "No chapters are available yet.", tone: "muted" }];
  }
  const selected = Math.max(0, Math.min(state.selected.chapters, model.chapters.length - 1));
  const current = model.chapters[selected]!;
  const repositoryChapters = model.chapters.filter((chapter) => chapter.repositoryId === current.repositoryId);
  const completed = repositoryChapters.filter((chapter) => chapter.status === "complete").length;
  const battles = model.bossBattles.filter((battle) => battle.repositoryId === current.repositoryId);
  const summary = metricStrip([
    { label: "Current arc", value: current.repositoryName, subtitle: `${repositoryChapters.length} chapter campaign`, tone: "accent" },
    { label: "Completed", value: `${completed}/${repositoryChapters.length}`, subtitle: "chapter rewards claimed", tone: "success" },
    { label: "Boss battles", value: String(battles.length), subtitle: battles.some((battle) => battle.status === "preparing") ? "encounter in preparation" : "release encounters", tone: "warning" }
  ], width);

  const listWidth = width >= 100 ? Math.max(38, Math.floor(width * 0.38)) : width;
  const detailWidth = width >= 100 ? width - listWidth - 4 : width;
  const window = selectedWindow(model.chapters, selected, Math.max(5, height - summary.length - 5));
  const list: Line[] = [
    sectionLine("Chapter Map", listWidth, `${selected + 1}/${model.chapters.length}`),
    blank(),
    ...window.items.map((chapter, index) => listItem(
      `${chapter.repositoryName} · ${chapter.position}. ${chapter.title}`,
      chapter.status.toUpperCase(),
      listWidth,
      window.offset + index === selected,
      statusTone(chapter.status)
    ))
  ];

  const details: Line[] = [
    sectionLine("Current Chapter", detailWidth, current.status.toUpperCase()),
    blank(),
    { segments: [part(current.status === "complete" ? "◆ CHAPTER COMPLETE" : current.status === "active" ? "◇ ACTIVE CHAPTER" : "· LOCKED CHAPTER", statusTone(current.status), true)] },
    { segments: [part(`Chapter ${current.position}  `, "muted"), part(current.title, "title", true)] },
    { text: current.repositoryName, tone: "accentAlt" },
    blank(),
    quoteLine(current.description),
    blank(),
    progressLine(current.progress, current.target, Math.max(12, detailWidth - 2), current.status === "complete" ? "success" : "accent"),
    { segments: [part(`${current.progress}/${current.target} progress`, "accentAlt", true), part(`  ·  +${current.rewardXp} XP`, "success", true)] },
    blank(),
    textLine(current.status === "locked"
      ? "Complete the previous chapter to unlock this objective."
      : current.objectiveType === "release"
        ? "Prepare the encounter with cq boss begin <campaign> <version>."
        : "Eligible Git activity advances this chapter automatically.", current.status === "locked" ? "muted" : "normal"),
    blank(),
    sectionLine("Campaign Arc", detailWidth),
    ...repositoryChapters.map((chapter) => ({
      segments: [
        part(chapter.status === "complete" ? "◆ " : chapter.status === "active" ? "◇ " : "· ", statusTone(chapter.status), true),
        part(`${chapter.position}. ${chapter.title}`, chapter.id === current.id ? "title" : "normal", chapter.id === current.id),
        part(`  ${chapter.status}`, "muted")
      ]
    })),
    blank(),
    sectionLine("Boss Encounters", detailWidth),
    ...(battles.length > 0
      ? battles.slice(0, 5).map((battle) => ({
          segments: [part(battle.status === "complete" ? "◆ " : "◇ ", statusTone(battle.status), true), part(`v${battle.version}`, "normal", true), part(`  ${battle.status}`, "muted")]
        }))
      : [textLine(`No encounter prepared · cq boss begin ${current.repositoryName} <version>`, "muted")])
  ];

  return [
    ...summary,
    blank(),
    ...(width >= 100 ? columnsLines([list, details], [listWidth, detailWidth], 4) : stackSections([list, details], 1))
  ].slice(0, height);
}

function achievementsBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const selected = Math.max(0, Math.min(state.selected.achievements, Math.max(0, model.achievements.length - 1)));
  const current = model.achievements[selected];
  const unlocked = model.achievements.filter((achievement) => achievement.unlocked);
  const totalReward = unlocked.reduce((sum, achievement) => sum + achievement.rewardXp, 0);
  const summary = metricStrip([
    { label: "Collection", value: `${unlocked.length}/${model.achievements.length}`, subtitle: "badges unlocked", tone: "success" },
    { label: "Badge XP", value: `+${totalReward}`, subtitle: "permanent reward", tone: "warning" },
    { label: "Remaining", value: String(model.achievements.length - unlocked.length), subtitle: "conditions to discover", tone: "accentAlt" }
  ], width);

  const listWidth = width >= 98 ? Math.max(34, Math.floor(width * 0.34)) : width;
  const detailWidth = width >= 98 ? width - listWidth - 4 : width;
  const window = selectedWindow(model.achievements, selected, Math.max(5, height - summary.length - 5));
  const list: Line[] = [
    sectionLine("Badge Collection", listWidth, `${selected + 1}/${Math.max(1, model.achievements.length)}`),
    blank(),
    ...window.items.map((achievement, index) => listItem(
      achievement.title,
      achievement.unlocked ? "UNLOCKED" : "LOCKED",
      listWidth,
      window.offset + index === selected,
      achievement.unlocked ? "success" : "muted"
    ))
  ];

  const details: Line[] = current ? [
    sectionLine("Profile Badge", detailWidth, current.unlocked ? "UNLOCKED" : "LOCKED"),
    blank(),
    textLine(center(current.unlocked ? "◆" : "◇", detailWidth), current.unlocked ? "success" : "muted"),
    textLine(center(current.title, detailWidth), "title"),
    textLine(center(current.unlocked ? "◆ UNLOCKED" : "◇ LOCKED", detailWidth), current.unlocked ? "success" : "muted"),
    blank(),
    quoteLine(current.description),
    blank(),
    keyValue("Reward", `+${current.rewardXp} XP`, "warning"),
    keyValue("Unlocked", current.unlockedAt ? formatRelativeDate(current.unlockedAt) : "condition not met", current.unlocked ? "success" : "muted"),
    blank(),
    sectionLine("Badge Lore", detailWidth),
    blank(),
    textLine(current.unlocked
      ? "This badge is permanently part of your developer profile. Its reward can never be duplicated."
      : "Complete the condition above to add this badge to your profile card.", current.unlocked ? "success" : "normal"),
    blank(),
    sectionLine("Recent Unlocks", detailWidth),
    ...(unlocked.length > 0
      ? unlocked.slice(0, 5).map((achievement) => ({
          segments: [part("◆ ", "success", true), part(achievement.title, "normal"), part(`  +${achievement.rewardXp} XP`, "warning")]
        }))
      : [textLine("Your first badge is waiting.", "muted")])
  ] : [textLine("No achievement definitions found.", "muted")];

  return [
    ...summary,
    blank(),
    ...(width >= 98 ? columnsLines([list, details], [listWidth, detailWidth], 4) : stackSections([list, details], 1))
  ].slice(0, height);
}

function barRow(stat: TuiCommitTypeStat, max: number, width: number): Line {
  const labelWidth = Math.min(10, Math.max(6, Math.floor(width * 0.15)));
  const right = `${String(stat.count).padStart(3)}  +${stat.xp} XP`;
  const barWidth = Math.max(6, width - labelWidth - right.length - 3);
  const tone: Tone = stat.type === "feat" ? "accentAlt"
    : stat.type === "fix" ? "danger"
      : stat.type === "test" ? "warning"
        : stat.type === "build" ? "success"
          : stat.type === "docs" ? "accent"
            : "muted";
  const percentage = Math.max(0, Math.min(1, stat.count / Math.max(1, max)));
  const filled = Math.round(percentage * barWidth);
  return {
    segments: [
      part(stat.type.padEnd(labelWidth), tone, true),
      part(" "),
      part("━".repeat(filled), tone, true),
      part("─".repeat(Math.max(0, barWidth - filled)), "muted"),
      part(` ${right}`, "muted")
    ]
  };
}

function progressBody(model: TuiModel, width: number, height: number): Line[] {
  const totalCommitXp = model.commitTypes.reduce((sum, stat) => sum + stat.xp, 0);
  const dailyValues = [...model.dailyXp].reverse().map((day) => day.xp);
  const summary = metricStrip([
    { label: "Level", value: String(model.level.level), subtitle: model.level.title, tone: "accent" },
    { label: "Total XP", value: model.totalXp.toLocaleString(), subtitle: `${model.level.xpNeeded - model.level.xpIntoLevel} to next level`, tone: "accentAlt" },
    { label: "Streak", value: `${model.streak.current} days`, subtitle: `${model.streak.longest} day personal best`, tone: "success" },
    { label: "Activity", value: String(model.stats.commits), subtitle: `${model.stats.repositories} campaigns`, tone: "warning" }
  ], width);

  const level: Line[] = [
    sectionLine("Level Progress", width, `${Math.round(model.level.percentage)}%`),
    blank(),
    { segments: [part(`Level ${model.level.level}`, "accent", true), part(`  ${model.level.title}`, "title", true)] },
    progressLine(model.level.xpIntoLevel, model.level.xpNeeded, Math.max(18, width - 2), "accent"),
    { segments: [part(`${model.level.xpIntoLevel}/${model.level.xpNeeded} XP`, "accentAlt", true), part(`  ·  ${model.level.xpNeeded - model.level.xpIntoLevel} XP remaining`, "muted")] }
  ];

  const leftWidth = width >= 104 ? Math.floor((width - 4) * 0.58) : width;
  const rightWidth = width >= 104 ? width - leftWidth - 4 : width;
  const maxCount = Math.max(1, ...model.commitTypes.map((stat) => stat.count));
  const types: Line[] = [
    sectionLine("Commit Type Breakdown", leftWidth),
    blank(),
    ...(model.commitTypes.length > 0
      ? model.commitTypes.slice(0, 11).map((stat) => barRow(stat, maxCount, leftWidth))
      : [textLine("No commit activity yet.", "muted")]),
    blank(),
    sectionLine("Reward Sources", leftWidth),
    keyValue("Commit XP", totalCommitXp.toLocaleString(), "accentAlt"),
    keyValue("Quest rewards", String(model.stats.questRewards), "warning"),
    keyValue("Badge rewards", String(model.stats.achievements), "success"),
    keyValue("Releases", String(model.stats.releases), "accent")
  ];

  const trend: Line[] = [
    sectionLine("14-Day XP Trend", rightWidth),
    blank(),
    { text: sparkline(dailyValues, Math.max(12, rightWidth)), tone: "accentAlt" },
    blank(),
    ...(model.dailyXp.length > 0
      ? model.dailyXp.slice(0, 8).map((day) => ({
          segments: [part(day.date, "muted"), part(`  ${String(day.xp).padStart(5)} XP`, day.xp > 0 ? "success" : "muted", day.xp > 0)]
        }))
      : [textLine("No XP history yet.", "muted")]),
    blank(),
    sectionLine("Journey Milestones", rightWidth),
    { segments: [part("◆ ", "success"), part(`${model.stats.commits} rewarded commits`, "normal")] },
    { segments: [part("◆ ", "accent"), part(`${model.stats.repositories} active campaigns`, "normal")] },
    { segments: [part("◆ ", "warning"), part(`${model.stats.achievements} badges unlocked`, "normal")] },
    { segments: [part("◆ ", "accentAlt"), part(`${model.streak.longest} day longest streak`, "normal")] }
  ];

  return [
    ...summary,
    blank(),
    ...level,
    blank(),
    ...(width >= 104 ? columnsLines([types, trend], [leftWidth, rightWidth], 4) : stackSections([types, trend], 1))
  ].slice(0, height);
}

function pathBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const selected = Math.max(0, Math.min(state.selected.path, Math.max(0, model.classes.length - 1)));
  const current = model.classes[selected];
  if (!current) return [sectionLine("Developer Paths", width), blank(), { text: "No class definitions found.", tone: "muted" }];
  const summary = metricStrip([
    { label: "Current path", value: model.classes.find((entry) => entry.selected)?.title ?? "Unselected", subtitle: "cosmetic class identity", tone: "accent" },
    { label: "Highlighted", value: current.title, subtitle: `class level ${current.classLevel}`, tone: "accentAlt" },
    { label: "Class XP", value: current.classXp.toLocaleString(), subtitle: current.nextSkillAt === null ? "all titles unlocked" : `${current.nextSkillAt - current.classXp} to next title`, tone: "success" }
  ], width);

  const listWidth = width >= 98 ? Math.max(32, Math.floor(width * 0.31)) : width;
  const detailWidth = width >= 98 ? width - listWidth - 4 : width;
  const list: Line[] = [
    sectionLine("Choose Your Path", listWidth),
    blank(),
    ...model.classes.map((entry, index) => listItem(
      entry.title,
      `Lv ${entry.classLevel}  ${entry.classXp} XP`,
      listWidth,
      index === selected,
      entry.selected ? "success" : "accentAlt"
    )),
    blank(),
    { text: "Enter chooses the highlighted path.", tone: "muted" },
    { text: "Classes never multiply XP or lock features.", tone: "muted" }
  ];

  const details: Line[] = [
    sectionLine("Path Profile", detailWidth, current.selected ? "CURRENT" : "AVAILABLE"),
    blank(),
    { segments: [part(current.selected ? "◆ CURRENT PATH" : "◇ AVAILABLE PATH", current.selected ? "success" : "accentAlt", true)] },
    { segments: [part(current.title, "title", true)] },
    { text: current.description, tone: "muted" },
    blank(),
    keyValue("Class level", String(current.classLevel), "accent"),
    keyValue("Class XP", current.classXp.toLocaleString(), "accentAlt"),
    keyValue("Affinity", current.affinityTypes.join(" · "), "warning"),
    blank(),
    progressLine(current.classXp, current.nextSkillAt ?? Math.max(1, current.classXp), Math.max(12, detailWidth - 2), "accentAlt"),
    blank(),
    sectionLine("Skill Path", detailWidth),
    blank(),
    ...current.skillTitles.flatMap((skill) => {
      const unlocked = skill.level <= current.classLevel;
      return [
        { segments: [part(unlocked ? "◆ " : "◇ ", unlocked ? "success" : "muted", true), part(skill.title, unlocked ? "normal" : "muted", unlocked), part(`  Level ${skill.level}`, "accentAlt")] },
        { text: `  ${skill.description}`, tone: "muted" }
      ] satisfies Line[];
    })
  ];

  return [
    ...summary,
    blank(),
    ...(width >= 98 ? columnsLines([list, details], [listWidth, detailWidth], 4) : stackSections([list, details], 1))
  ].slice(0, height);
}

function logBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const selected = Math.max(0, Math.min(state.selected.log, Math.max(0, model.recentActivity.length - 1)));
  const current = model.recentActivity[selected];
  const totalRewarded = model.recentActivity.reduce((sum, activity) => sum + activity.awardedXp, 0);
  const releases = model.recentActivity.filter((activity) => activity.kind === "release").length;
  const summary = metricStrip([
    { label: "Entries", value: String(model.recentActivity.length), subtitle: "recent local rewards", tone: "accent" },
    { label: "Recent XP", value: `+${totalRewarded}`, subtitle: "visible in this timeline", tone: "success" },
    { label: "Releases", value: String(releases), subtitle: "boss rewards recorded", tone: "warning" }
  ], width);

  const listWidth = width >= 96 ? Math.max(42, Math.floor(width * 0.47)) : width;
  const detailWidth = width >= 96 ? width - listWidth - 4 : width;
  const window = selectedWindow(model.recentActivity, selected, Math.max(5, height - summary.length - 5));
  const timeline: Line[] = [
    sectionLine("Adventure Timeline", listWidth, `${selected + 1}/${Math.max(1, model.recentActivity.length)}`),
    blank(),
    ...(window.items.length > 0
      ? window.items.flatMap((activity, index) => {
          const absolute = window.offset + index;
          const isSelected = absolute === selected;
          return [
            {
              background: isSelected ? "surfaceAlt" : "background",
              segments: [
                part(activity.kind === "release" ? "◆ " : "· ", activityTone(activity), true, isSelected ? "surfaceAlt" : "background"),
                part(activity.type.padEnd(8), activityTone(activity), true, isSelected ? "surfaceAlt" : "background"),
                part(clip(activity.subject, Math.max(12, listWidth - 29)), isSelected ? "title" : "normal", isSelected, isSelected ? "surfaceAlt" : "background"),
                part(` +${activity.awardedXp}`, "success", true, isSelected ? "surfaceAlt" : "background")
              ]
            },
            { text: `  ${activity.repositoryName} · ${formatRelativeDate(activity.occurredAt)}`, tone: "muted", background: isSelected ? "surfaceAlt" : "background" }
          ] satisfies Line[];
        })
      : [textLine("Your adventure log is empty.", "muted")])
  ];

  const detail: Line[] = current ? [
    sectionLine("Reward Detail", detailWidth, current.kind.toUpperCase()),
    blank(),
    { segments: [part(current.kind === "release" ? "◆ RELEASE" : `◆ ${current.type.toUpperCase()} COMMIT`, activityTone(current), true)] },
    { segments: [part(current.subject, "title", true)] },
    blank(),
    keyValue("Campaign", current.repositoryName, "accent"),
    keyValue("Reward", `+${current.awardedXp} XP`, "success"),
    keyValue("When", formatRelativeDate(current.occurredAt), "muted"),
    keyValue("Reference", current.reference.slice(0, 12), "accentAlt"),
    blank(),
    sectionLine("Reward Integrity", detailWidth),
    { text: "Stored locally · duplicate import protection enabled · source repository untouched.", tone: "muted" }
  ] : [sectionLine("Reward Detail", detailWidth), blank(), { text: "No activity yet.", tone: "muted" }];

  return [
    ...summary,
    blank(),
    ...(width >= 96 ? columnsLines([timeline, detail], [listWidth, detailWidth], 4) : stackSections([timeline, detail], 1))
  ].slice(0, height);
}

function shareBody(model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const formats = [
    { label: "SVG Journey Card", meta: "visual card", extension: ".svg" },
    { label: "Markdown Profile", meta: "README ready", extension: ".md" },
    { label: "JSON Journey", meta: "portable data", extension: ".json" }
  ];
  const selected = Math.max(0, Math.min(state.selected.share, formats.length - 1));
  const current = formats[selected]!;
  const summary = metricStrip([
    { label: "Selected format", value: current.label, subtitle: current.extension, tone: "accent" },
    { label: "Privacy", value: "Shielded", subtitle: "paths, email, subjects excluded", tone: "success" },
    { label: "Destination", value: "Local", subtitle: "nothing is uploaded", tone: "accentAlt" }
  ], width);

  const listWidth = width >= 96 ? Math.max(32, Math.floor(width * 0.30)) : width;
  const detailWidth = width >= 96 ? width - listWidth - 4 : width;
  const list: Line[] = [
    sectionLine("Export Format", listWidth),
    blank(),
    ...formats.map((format, index) => listItem(format.label, format.meta, listWidth, index === selected, "accentAlt")),
    blank(),
    { text: "Enter exports the highlighted format.", tone: "muted" }
  ];

  const details: Line[] = [
    sectionLine("Journey Preview", detailWidth),
    blank(),
    ...model.sharePreview.map((value, index) => ({ text: value, tone: index === 0 ? "title" : index === 1 ? "accentAlt" : "normal" as Tone })),
    blank(),
    sectionLine("Privacy Shield", detailWidth),
    { segments: [part("◆ ", "success", true), part("Repository paths excluded", "normal")] },
    { segments: [part("◆ ", "success", true), part("Commit subjects excluded", "normal")] },
    { segments: [part("◆ ", "success", true), part("Email address excluded", "normal")] },
    { segments: [part("◆ ", "success", true), part("Project names hidden unless explicitly requested", "normal")] },
    blank(),
    sectionLine("Ready To Share", detailWidth),
    keyValue("Format", current.label, "accent"),
    keyValue("Output", `~/.local/share/commitquest/shares/commitquest-journey${current.extension}`, "muted"),
    { text: "Generated entirely on this machine.", tone: "success" }
  ];

  return [
    ...summary,
    blank(),
    ...(width >= 96 ? columnsLines([list, details], [listWidth, detailWidth], 4) : stackSections([list, details], 1))
  ].slice(0, height);
}


function themePaletteSegments(theme: TuiTheme): Segment[] {
  const colours = [
    theme.accent,
    theme.accentAlt,
    theme.success,
    theme.warning,
    theme.danger,
    theme.text
  ];
  return colours.flatMap((colour, index) => [
    palettePart("■", colour),
    ...(index < colours.length - 1 ? [part(" ", "muted")] : [])
  ]);
}

function themeLibraryItem(
  theme: TuiTheme,
  width: number,
  selected: boolean,
  active: boolean
): Line {
  const swatchWidth = 11;
  const status = active ? "SAVED" : selected ? "PREVIEW" : "";
  const statusWidth = width >= 42 ? 8 : 0;
  const nameWidth = Math.max(8, width - swatchWidth - statusWidth - 5);
  const rowBackground: Background = selected ? "surfaceAlt" : "background";
  return {
    background: rowBackground,
    segments: [
      part(selected ? "◆" : "·", selected ? "accent" : active ? "success" : "muted", true, rowBackground),
      part(` ${fit(theme.name, nameWidth)}`, selected ? "title" : "normal", selected, rowBackground),
      ...(statusWidth > 0
        ? [part(fit(status, statusWidth), active ? "success" : "accentAlt", Boolean(status), rowBackground)]
        : []),
      part(" ", "normal", false, rowBackground),
      ...themePaletteSegments(theme)
    ]
  };
}

function themesBody(
  state: TuiState,
  width: number,
  height: number,
  activeTheme: TuiTheme,
  motion: "full" | "reduced",
  colorMode: "auto" | "always" | "never"
): Line[] {
  const previewTheme = TUI_THEMES[state.selected.themes] ?? activeTheme;
  const summary = metricStrip([
    { label: "Saved theme", value: activeTheme.name, subtitle: "restored on launch", tone: "accent" },
    { label: "Live preview", value: previewTheme.name, subtitle: previewTheme.id === activeTheme.id ? "currently active" : "Enter to save", tone: "accentAlt" },
    { label: "Motion", value: motion, subtitle: "M toggles", tone: motion === "reduced" ? "success" : "warning" },
    { label: "Colour", value: colorMode, subtitle: "V cycles", tone: "success" }
  ], width);

  const listWidth = width >= 96 ? Math.max(34, Math.floor(width * 0.35)) : width;
  const detailWidth = width >= 96 ? width - listWidth - 4 : width;
  const capacity = Math.max(6, height - summary.length - 5);
  const window = selectedWindow([...TUI_THEMES], state.selected.themes, capacity);
  const list: Line[] = [
    sectionLine("Theme Library", listWidth, `${state.selected.themes + 1}/${TUI_THEMES.length}`),
    blank(),
    ...window.items.map((theme, index) => themeLibraryItem(
      theme,
      listWidth,
      window.offset + index === state.selected.themes,
      theme.id === activeTheme.id
    ))
  ];

  const details: Line[] = [
    sectionLine("Palette Identity", detailWidth, previewTheme.id),
    blank(),
    { segments: [part(previewTheme.name, "title", true)] },
    { text: previewTheme.description, tone: "muted" },
    blank(),
    {
      segments: [
        part("FULL PALETTE  ", "muted", true),
        ...themePaletteSegments(previewTheme),
        part("  accent · alt · success · attention · critical · text", "muted")
      ]
    },
    blank(),
    { segments: [part("● PRIMARY ACCENT   ", "accent", true), part(previewTheme.accent, "muted")] },
    { segments: [part("● SECONDARY LIGHT  ", "accentAlt", true), part(previewTheme.accentAlt, "muted")] },
    { segments: [part("● SUCCESS          ", "success", true), part(previewTheme.success, "muted")] },
    { segments: [part("● ATTENTION        ", "warning", true), part(previewTheme.warning, "muted")] },
    { segments: [part("● CRITICAL         ", "danger", true), part(previewTheme.danger, "muted")] },
    { segments: [part("● MUTED            ", "muted", true), part(previewTheme.muted, "muted")] },
    blank(),
    sectionLine("Semantic Preview", detailWidth),
    blank(),
    { segments: [part("◆ ACTIVE SELECTION", "accent", true), part("  Quest board focus", "normal")] },
    { segments: [part("◆ PATH HIGHLIGHT", "accentAlt", true), part("  Secondary emphasis", "normal")] },
    { segments: [part("◆ REWARD UNLOCKED", "success", true), part("  +80 XP secured", "normal")] },
    { segments: [part("◆ ATTENTION", "warning", true), part("  Boss encounter preparing", "normal")] },
    { segments: [part("◆ BLOCKED", "danger", true), part("  Release check needs work", "normal")] },
    { text: "All interface states come from this palette; no global neon red or unrelated pink is injected.", tone: "muted" },
    blank(),
    { text: previewTheme.id === activeTheme.id ? "This theme is currently saved." : "Live preview active · press Enter to save.", tone: previewTheme.id === activeTheme.id ? "success" : "accent" },
    { text: `Motion ${motion} · Colour ${colorMode}`, tone: "muted" }
  ];

  return [
    ...summary,
    blank(),
    ...(width >= 96 ? columnsLines([list, details], [listWidth, detailWidth], 4) : stackSections([list, details], 1))
  ].slice(0, height);
}

function helpBody(width: number): Line[] {
  return [
    sectionLine("Navigation", width),
    blank(),
    keyValue("↑ / ↓ or J / K", "Move through items"),
    keyValue("← / → or H / L", "Change screen"),
    keyValue("Tab / Shift+Tab", "Cycle screens"),
    keyValue("Enter", "Open, choose, or save"),
    keyValue("Esc", "Return home or close"),
    blank(),
    sectionLine("Global Controls", width),
    blank(),
    keyValue("/", "Search the command palette", "accent"),
    keyValue("R", "Refresh and scan campaigns", "accentAlt"),
    keyValue("T", "Open the theme library", "warning"),
    keyValue("?", "Toggle help", "muted"),
    keyValue("Q / Ctrl+C", "Quit safely", "danger"),
    blank(),
    sectionLine("Context Actions", width),
    { text: "Quests: N new · E edit · C complete · A abandon", tone: "muted" },
    { text: "Campaigns: N add · S scan · P repair · X archive · D remove", tone: "muted" },
    { text: "Themes: M motion · V colour mode · Enter save", tone: "muted" }
  ];
}

function screenTitle(state: TuiState): string {
  if (state.helpOpen) return "Help";
  switch (state.screen) {
    case "home": return "Home";
    case "profile": return "Profile";
    case "quests": return "Quest Board";
    case "campaigns": return "Campaigns";
    case "chapters": return "Campaign Chapters";
    case "achievements": return "Achievements";
    case "progress": return "Progress";
    case "path": return "Developer Path";
    case "log": return "Adventure Log";
    case "share": return "Share Journey";
    case "themes": return "Themes";
  }
}

function screenTabsLine(state: TuiState, width: number): Line {
  const full: Array<[TuiState["screen"], string]> = [
    ["home", "HOME"],
    ["profile", "PROFILE"],
    ["quests", "QUESTS"],
    ["campaigns", "CAMPAIGNS"],
    ["chapters", "CHAPTERS"],
    ["achievements", "BADGES"],
    ["progress", "PROGRESS"],
    ["path", "PATH"],
    ["log", "LOG"],
    ["share", "SHARE"],
    ["themes", "THEMES"]
  ];
  const compact: Array<[TuiState["screen"], string]> = [
    ["home", "HOME"], ["profile", "PROF"], ["quests", "QUEST"], ["campaigns", "CAMP"],
    ["chapters", "CHAP"], ["achievements", "BADGE"], ["progress", "PROG"], ["path", "PATH"],
    ["log", "LOG"], ["share", "SHARE"], ["themes", "THEME"]
  ];
  const entries = width >= 126 ? full : compact;
  const rawLength = entries.reduce((sum, [, label]) => sum + label.length + 4, 0);
  const leftPadding = Math.max(0, Math.floor((width - rawLength) / 2));
  const segments: Segment[] = [part(" ".repeat(leftPadding), "muted", false, "surfaceAlt")];
  for (const [screen, label] of entries) {
    const active = screen === state.screen;
    segments.push(part(
      active ? ` ${label} ` : `  ${label}  `,
      active ? "selected" : "muted",
      active,
      active ? "accent" : "surfaceAlt"
    ));
  }
  return { segments, background: "surfaceAlt" };
}

function bodyLines(
  model: TuiModel,
  state: TuiState,
  width: number,
  height: number,
  activeTheme: TuiTheme,
  pulse = false,
  motion: "full" | "reduced" = "full",
  colorMode: "auto" | "always" | "never" = "auto"
): Line[] {
  if (state.helpOpen) return helpBody(width);
  switch (state.screen) {
    case "home": return homeBody(model, state, width, height, pulse);
    case "profile": return profileBody(model, width, height);
    case "quests": return questsBody(model, state, width, height);
    case "campaigns": return campaignsBody(model, state, width, height);
    case "chapters": return chaptersBody(model, state, width, height);
    case "achievements": return achievementsBody(model, state, width, height);
    case "progress": return progressBody(model, width, height);
    case "path": return pathBody(model, state, width, height);
    case "log": return logBody(model, state, width, height);
    case "share": return shareBody(model, state, width, height);
    case "themes": return themesBody(state, width, height, activeTheme, motion, colorMode);
  }
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

function overlayPanel(
  base: Line[],
  title: string,
  content: string[],
  width: number,
  height: number,
  options: { modalWidth?: number; modalHeight?: number; tone?: Tone } = {}
): Line[] {
  const modalWidth = Math.min(width - 6, Math.max(48, options.modalWidth ?? Math.floor(width * 0.68)));
  const requestedHeight = options.modalHeight ?? Math.min(height - 4, content.length + 2);
  const modalHeight = Math.min(height - 2, Math.max(5, requestedHeight));
  const box = panelFill(title, content, modalWidth, modalHeight);
  const top = Math.max(0, Math.floor((height - box.length) / 2));
  const output = [...base];
  for (let index = 0; index < box.length && top + index < output.length; index += 1) {
    output[top + index] = {
      text: center(box[index] ?? "", width),
      tone: options.tone ?? (index === 0 ? "accent" : "normal"),
      background: "surfaceAlt"
    };
  }
  return output;
}

function formDisplayValue(field: TuiFormOverlay["fields"][number]): string {
  if (field.kind === "boolean") return field.value === "true" ? "Enabled" : "Disabled";
  if (field.kind === "choice") return field.choices?.find((choice) => choice.value === field.value)?.label ?? field.value;
  if (field.secret) return "";
  return field.value || field.placeholder || "";
}

function formOverlayContent(form: TuiFormOverlay, width: number): string[] {
  const visible = form.fields.filter((field) => !field.secret);
  const valueWidth = Math.max(18, width - 28);
  const rows = visible.flatMap((field, index) => {
    const selected = index === form.fieldIndex;
    const value = formDisplayValue(field);
    const shown = !field.value && field.placeholder ? `(${field.placeholder})` : value;
    const selector = field.kind === "choice" || field.kind === "boolean" ? "  ← / →" : "";
    return [
      `${selected ? ">" : " "} ${field.label.padEnd(18)} ${clip(shown, valueWidth)}${selector}`,
      selected && (field.kind === "text" || field.kind === "number")
        ? `  ${" ".repeat(18)}${"─".repeat(Math.max(8, Math.min(valueWidth, value.length + 1)))}`
        : ""
    ];
  });
  const selectedThemeId = form.action === "onboarding-theme"
    ? form.fields.find((field) => field.key === "theme")?.value
    : null;
  const themePreview = selectedThemeId
    ? (() => {
        const selectedTheme = getTuiTheme(selectedThemeId);
        return [
          "",
          `Live preview · ${selectedTheme.description}`,
          `Primary ${selectedTheme.accent} · Secondary ${selectedTheme.accentAlt}`,
          `Success ${selectedTheme.success} · Attention ${selectedTheme.warning} · Critical ${selectedTheme.danger}`
        ];
      })()
    : [];
  return [
    "Use Tab or ↑↓ to move between fields.",
    "Use ←→ to change choices. Enter advances or submits.",
    "",
    ...rows,
    ...themePreview,
    ...(form.error ? ["", `Error: ${form.error}`] : []),
    "",
    `${form.submitLabel}  ·  Esc ${form.cancelLabel}${form.allowSkip ? "  ·  Esc also skips" : ""}`
  ];
}

function detailOverlayContent(model: TuiModel, state: TuiState): { title: string; lines: string[] } {
  if (state.screen === "quests") {
    const quest = questRows(model)[state.selected.quests];
    if (!quest) return { title: "Quest Detail", lines: ["No quest selected."] };
    return {
      title: quest.title,
      lines: [
        quest.state === "active" ? "◇ ACTIVE QUEST" : "◆ COMPLETED QUEST",
        quest.subtitle,
        "",
        quest.description,
        "",
        progressBar(quest.progress, quest.target, 52),
        `${quest.progress}/${quest.target} progress`,
        `Reward: +${quest.reward} XP`,
        `Status: ${quest.state}`,
        "",
        "Quest controls",
        "N create · E edit · C complete manual · A abandon",
        "Esc or Enter returns to the board."
      ]
    };
  }
  if (state.screen === "campaigns") {
    const campaign = model.campaigns[state.selected.campaigns];
    if (!campaign) return { title: "Campaign Detail", lines: ["No campaign selected."] };
    const activity = model.recentActivity.filter((item) => item.repositoryName === campaign.name).slice(0, 8);
    return {
      title: campaign.name,
      lines: [
        campaign.archived ? "◇ ARCHIVED CAMPAIGN" : "◆ ACTIVE CAMPAIGN",
        campaign.defaultBranch ? `Branch: ${campaign.defaultBranch}` : "Detached branch",
        campaign.path,
        "",
        `${campaign.commits} commits · ${campaign.releases} releases · ${campaign.earnedXp} XP`,
        campaign.lastActivityAt ? `Last activity: ${formatRelativeDate(campaign.lastActivityAt)}` : "Last activity: none",
        campaign.lastScannedAt ? `Last scan: ${formatRelativeDate(campaign.lastScannedAt)}` : "Last scan: never",
        "",
        "Recent activity",
        ...(activity.length ? activity.map((item) => `◆ ${clip(item.subject, 66)}  +${item.awardedXp} XP`) : ["No activity recorded yet."]),
        "",
        "N add · S scan · P repair · X archive/restore · D remove",
        "Esc or Enter returns to the campaign hub."
      ]
    };
  }
  if (state.screen === "chapters") {
    const chapter = model.chapters[state.selected.chapters];
    if (!chapter) return { title: "Chapter Detail", lines: ["No chapter selected."] };
    const battles = model.bossBattles.filter((battle) => battle.repositoryId === chapter.repositoryId);
    return {
      title: chapter.title,
      lines: [
        chapter.status === "complete" ? "◆ CHAPTER COMPLETE" : chapter.status === "active" ? "◇ ACTIVE CHAPTER" : "· LOCKED CHAPTER",
        `${chapter.repositoryName} · Chapter ${chapter.position}`,
        "",
        chapter.description,
        "",
        progressBar(chapter.progress, chapter.target, 52),
        `${chapter.progress}/${chapter.target} progress`,
        `Reward: +${chapter.rewardXp} XP`,
        `Status: ${chapter.status}`,
        "",
        "Boss encounters",
        ...(battles.length ? battles.map((battle) => `${battle.status === "complete" ? "◆" : "◇"} v${battle.version} · ${battle.status}`) : ["No release encounter prepared."]),
        "",
        `Prepare one with: cq boss begin ${chapter.repositoryName} <version>`,
        "Esc or Enter returns to the chapter map."
      ]
    };
  }
  if (state.screen === "achievements") {
    const achievement = model.achievements[state.selected.achievements];
    if (!achievement) return { title: "Badge Detail", lines: ["No badge selected."] };
    return {
      title: achievement.title,
      lines: [
        achievement.unlocked ? "◆ BADGE UNLOCKED" : "◇ BADGE LOCKED",
        "",
        achievement.description,
        "",
        `Reward: +${achievement.rewardXp} XP`,
        achievement.unlockedAt ? `Unlocked: ${formatRelativeDate(achievement.unlockedAt)}` : "Complete the condition to unlock this badge.",
        "",
        achievement.unlocked
          ? "This badge is permanently part of your collection."
          : "Locked badges never remove progress and cannot be claimed twice.",
        "",
        "Esc or Enter returns to the badge collection."
      ]
    };
  }
  if (state.screen === "log") {
    const activity = model.recentActivity[state.selected.log];
    if (!activity) return { title: "Adventure Log Detail", lines: ["No activity selected."] };
    return {
      title: activity.subject,
      lines: [
        activity.kind === "release" ? "◆ RELEASE REWARD" : `◆ ${activity.type.toUpperCase()} COMMIT`,
        "",
        `Campaign: ${activity.repositoryName}`,
        `Reward: +${activity.awardedXp} XP`,
        `When: ${formatRelativeDate(activity.occurredAt)}`,
        `Reference: ${activity.reference}`,
        "",
        "This reward is stored locally and cannot be imported twice.",
        "",
        "Esc or Enter returns to the adventure log."
      ]
    };
  }
  return { title: "Detail", lines: ["No expanded detail is available for this page."] };
}

function applyOverlay(lines: Line[], model: TuiModel, state: TuiState, width: number, height: number): Line[] {
  const overlay = state.overlay;
  if (!overlay) return lines;

  if (overlay.kind === "palette") {
    const entries = filteredPaletteEntries(model, state);
    const capacity = Math.max(5, Math.min(14, height - 10));
    const window = selectedWindow(entries, overlay.selected, capacity);
    const rows = window.items.map((entry, index) => {
      const absolute = window.offset + index;
      const marker = absolute === overlay.selected ? ">" : " ";
      const disabled = entry.enabled ? "" : "  unavailable";
      return `${marker} ${clip(entry.label, 28).padEnd(30)} ${clip(entry.description, 34)}${disabled}`;
    });
    return overlayPanel(lines, "Command Palette", [
      `> ${overlay.query || "Type to search actions"}`,
      "",
      ...(rows.length ? rows : ["No matching actions."]),
      "",
      "Enter run · ↑↓ select · Esc close"
    ], width, height, { modalWidth: Math.min(92, width - 8), modalHeight: Math.min(height - 4, capacity + 6) });
  }

  if (overlay.kind === "form") {
    const previewHeight = overlay.action === "onboarding-theme" ? 4 : 0;
    return overlayPanel(lines, overlay.title, formOverlayContent(overlay, Math.min(84, width - 10) - 4), width, height, {
      modalWidth: Math.min(88, width - 8),
      modalHeight: Math.min(height - 4, Math.max(13, overlay.fields.filter((field) => !field.secret).length * 2 + 8 + previewHeight)),
      tone: overlay.error ? "warning" : "normal"
    });
  }

  if (overlay.kind === "confirm") {
    const verification = overlay.verification
      ? ["", `Type “${overlay.verification}” to confirm:`, `> ${overlay.typed}`]
      : [];
    return overlayPanel(lines, overlay.title, [
      ...(overlay.dangerous ? ["⚠ This action changes stored CommitQuest data.", ""] : []),
      ...overlay.message,
      ...verification,
      ...(overlay.error ? ["", `Error: ${overlay.error}`] : []),
      "",
      `Enter ${overlay.confirmLabel} · Esc cancel`
    ], width, height, { modalWidth: Math.min(78, width - 8), tone: overlay.dangerous ? "warning" : "normal" });
  }

  if (overlay.kind === "detail") {
    const detail = detailOverlayContent(model, state);
    return overlayPanel(lines, detail.title, detail.lines, width, height, {
      modalWidth: Math.min(100, width - 8),
      modalHeight: Math.min(height - 4, Math.max(16, detail.lines.length + 2))
    });
  }

  if (overlay.kind === "onboarding") {
    const content = overlay.step === "welcome"
      ? [
          center("WELCOME TO COMMITQUEST", 58),
          "",
          "Turn real Git progress into a private developer adventure.",
          "",
          "◆ Commits become XP",
          "◆ Repositories become campaigns",
          "◆ Objectives become quests",
          "◆ Releases become major milestones",
          "",
          "Everything remains local by default.",
          "",
          "Press Enter to begin your journey."
        ]
      : [
          center("YOUR JOURNEY IS READY", 58),
          "",
          "Profile saved · theme selected · campaign setup complete.",
          "",
          "Press Enter to open CommitQuest."
        ];
    return overlayPanel(lines, overlay.step === "welcome" ? "First Journey" : "Onboarding Complete", content, width, height, {
      modalWidth: Math.min(70, width - 8),
      modalHeight: Math.min(height - 4, content.length + 2),
      tone: "accent"
    });
  }

  if (overlay.kind === "notice") {
    return overlayPanel(lines, overlay.title, [...overlay.lines, "", "Enter or Esc to continue"], width, height, {
      modalWidth: Math.min(72, width - 8),
      tone: overlay.tone === "danger" ? "danger" : overlay.tone === "warning" ? "warning" : overlay.tone === "success" ? "success" : "normal"
    });
  }

  return lines;
}

function footerControls(state: TuiState): string {
  if (state.overlay?.kind === "palette") return "Type Search  ↑↓ Select  Enter Run  Esc Close";
  if (state.overlay?.kind === "form") return "Tab Fields  ←→ Choice  Enter Next/Submit  Esc Cancel";
  if (state.overlay) return "Enter Confirm/Open  Esc Back";
  if (state.screen === "profile") return "←→ Screens  R Refresh  / Commands  T Themes  ? Help  Q Quit";
  if (state.screen === "quests") return "↑↓ Move  N New  E Edit  C Complete  A Abandon  Enter Detail  / Commands  Q Quit";
  if (state.screen === "campaigns") return "↑↓ Move  N Add  S Scan  P Repair  X Archive  D Remove  Enter Detail  / Commands  Q Quit";
  if (state.screen === "path") return "↑↓ Select  Enter Choose Path  ←→ Screens  / Commands  Q Quit";
  if (state.screen === "share") return "↑↓ Format  Enter Export  ←→ Screens  / Commands  Q Quit";
  if (state.screen === "chapters") return "↑↓ Chapters  Enter Detail  ←→ Screens  / Commands  Q Quit";
  if (state.screen === "themes") return "↑↓ Preview  Enter Save  M Motion  V Colour  Esc Cancel  / Commands  Q Quit";
  return "↑↓ Move  ←→ Screens  Enter Open  R Refresh  / Commands  T Themes  ? Help  Q Quit";
}

function compactScreen(size: TerminalSize, theme: TuiTheme, color: boolean): string {
  const width = Math.max(30, size.width);
  const height = Math.max(8, size.height);
  const lines: Line[] = [
    { text: center("COMMITQUEST", width), tone: "accent", background: "surface" },
    blank(),
    { text: center(`Terminal too small: ${size.width}×${size.height}`, width), tone: "warning" },
    { text: center(`Minimum recommended size: ${MIN_WIDTH}×${MIN_HEIGHT}`, width), tone: "muted" },
    blank(),
    { text: center("Resize the terminal or press Q to quit.", width) }
  ];
  while (lines.length < height - 1) lines.push(blank());
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

  const footer: Line = {
    text: align(footerControls(state), FOOTER_CREDIT, width),
    tone: "muted",
    background: "surface"
  };

  let lines: Line[];
  if (state.screen === "home" && !state.helpOpen) {
    const body = bodyLines(model, state, width, height - 1, activeTheme, options.pulse ?? false, options.motion ?? "full", options.colorMode ?? "auto").slice(0, height - 1);
    while (body.length < height - 1) body.push(blank());
    lines = [...body, footer];
  } else {
    const headerLeft = ` COMMITQUEST  ${APP_VERSION}`;
    const headerRight = `${model.profile.name}  ·  Level ${model.level.level} ${model.level.title} `;
    const xpWidth = Math.max(12, Math.min(28, width - 46));
    const xpLeft = ` ${progressBar(model.level.xpIntoLevel, model.level.xpNeeded, xpWidth)}  ${model.level.xpIntoLevel}/${model.level.xpNeeded} XP`;
    const xpRight = `${model.streak.current} day streak  ·  ${model.totalXp.toLocaleString()} total XP `;
    const fixedLines = 5;
    const bodyHeight = height - fixedLines;
    const rawBody = bodyLines(model, state, width, bodyHeight, activeTheme, options.pulse ?? false, options.motion ?? "full", options.colorMode ?? "auto").slice(0, bodyHeight);
    const body = spreadVertically(rawBody, bodyHeight);
    while (body.length < bodyHeight) body.push(blank());

    lines = [
      { text: align(headerLeft, headerRight, width), tone: "title", background: "surface" },
      { text: align(xpLeft, xpRight, width), tone: "muted", background: "surface" },
      screenTabsLine(state, width),
      { text: ` ${screenTitle(state).toUpperCase()}`, tone: "accentAlt" },
      ...body,
      footer
    ];
  }

  if (!state.overlay) lines = applyRewardModal(lines, model, state, width, height);
  lines = applyOverlay(lines, model, state, width, height);
  return lines.slice(0, height).map((line) => renderLine(line, width, previewTheme, color)).join("\n");
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, "");
}

export const TUI_MINIMUM_SIZE = { width: MIN_WIDTH, height: MIN_HEIGHT } as const;
export { FOOTER_CREDIT };
