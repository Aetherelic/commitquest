import chalk from "chalk";
import Table from "cli-table3";
import type { AchievementState, CustomQuestState, Quest, RepositoryRecord } from "../core/types.js";
import type { LevelProgress } from "../core/levels.js";
import { formatRelativeDate } from "../core/dates.js";

export function progressBar(percentage: number, width = 28): string {
  const filled = Math.round((Math.max(0, Math.min(100, percentage)) / 100) * width);
  return chalk.magenta("█".repeat(filled)) + chalk.dim("░".repeat(width - filled));
}

export function questProgressBar(progress: number, target: number, width = 14): string {
  const percentage = target === 0 ? 100 : Math.min(100, Math.round((progress / target) * 100));
  const filled = Math.round((percentage / 100) * width);
  return chalk.cyan("━".repeat(filled)) + chalk.dim("─".repeat(width - filled));
}

export function renderLevel(level: LevelProgress, totalXp: number): string {
  return [
    `${chalk.bold(`Level ${level.level}`)} ${chalk.dim("—")} ${chalk.cyan(level.title)}`,
    `${progressBar(level.percentage)}  ${chalk.bold(`${level.xpIntoLevel}/${level.xpNeeded} XP`)}`,
    chalk.dim(`${totalXp.toLocaleString()} total XP · ${level.nextLevelXp - totalXp} XP to next level`)
  ].join("\n");
}

export function renderQuests(quests: Quest[], rewardedKeys = new Set<string>()): string {
  return quests.map((quest) => {
    const done = quest.complete;
    const icon = done ? chalk.green("◆") : chalk.dim("◇");
    const state = done
      ? rewardedKeys.has(quest.key) ? chalk.green("claimed") : chalk.green("complete")
      : `${quest.progress}/${quest.target}`;

    return [
      `${icon} ${chalk.bold(quest.title)} ${chalk.dim(`· ${quest.periodLabel}`)} ${chalk.magenta(`+${quest.rewardXp} XP`)}`,
      `  ${questProgressBar(quest.progress, quest.target)}  ${state}`,
      `  ${chalk.dim(quest.description)}`
    ].join("\n");
  }).join("\n\n");
}

export function renderCustomQuests(quests: CustomQuestState[]): string {
  return quests.map((quest) => {
    const icon = quest.status === "complete"
      ? chalk.green("◆")
      : quest.status === "abandoned" || quest.status === "expired"
        ? chalk.dim("◇")
        : chalk.magenta("◇");
    const state = quest.status === "complete"
      ? chalk.green("claimed")
      : quest.status === "abandoned"
        ? chalk.dim("abandoned")
        : quest.status === "expired"
          ? chalk.yellow("expired")
          : `${quest.progress}/${quest.target}`;
    const scope = quest.repositoryName ?? "All campaigns";
    const objective = quest.objectiveType === "manual"
      ? "Manual milestone"
      : quest.objectiveType === "release"
        ? "Release"
        : quest.objectiveType === "commit"
          ? "Any commit"
          : `${quest.objectiveType} commit`;
    const deadline = quest.deadlineAt
      ? ` · due ${new Date(quest.deadlineAt).toLocaleDateString()}`
      : "";

    return [
      `${icon} ${chalk.bold(`#${quest.id} ${quest.title}`)} ${chalk.magenta(`+${quest.rewardXp} XP`)}`,
      `  ${chalk.dim(`${scope} · ${objective}${deadline}`)}`,
      `  ${questProgressBar(quest.progress, quest.target)}  ${state}`,
      `  ${chalk.dim(quest.description)}`
    ].join("\n");
  }).join("\n\n");
}

export function renderRepositories(repositories: RepositoryRecord[]): string {
  const table = new Table({
    head: [chalk.bold("Campaign"), chalk.bold("Branch"), chalk.bold("Last scan"), chalk.bold("Path")],
    colWidths: [22, 18, 16, 56],
    wordWrap: true,
    style: { head: [], border: [] }
  });

  for (const repository of repositories) {
    table.push([
      repository.name,
      repository.defaultBranch ?? chalk.dim("detached"),
      repository.lastScannedAt ? formatRelativeDate(repository.lastScannedAt) : chalk.dim("never"),
      chalk.dim(repository.path)
    ]);
  }
  return table.toString();
}

export function renderAchievements(states: AchievementState[]): string {
  const table = new Table({
    head: [chalk.bold(""), chalk.bold("Achievement"), chalk.bold("Reward"), chalk.bold("Description")],
    colWidths: [4, 28, 12, 55],
    wordWrap: true,
    style: { head: [], border: [] }
  });

  for (const achievement of states) {
    table.push([
      achievement.unlocked ? chalk.green("◆") : chalk.dim("◇"),
      achievement.unlocked ? chalk.bold(achievement.title) : chalk.dim(achievement.title),
      chalk.magenta(`+${achievement.rewardXp} XP`),
      achievement.unlocked ? achievement.description : chalk.dim(achievement.description)
    ]);
  }
  return table.toString();
}

export function section(title: string, body: string): string {
  return `${chalk.bold.magenta(title.toUpperCase())}\n${body}`;
}

export function success(message: string): string {
  return `${chalk.green("◆")} ${message}`;
}

export function warning(message: string): string {
  return `${chalk.yellow("◇")} ${message}`;
}

export function failure(message: string): string {
  return `${chalk.red("◆")} ${message}`;
}
