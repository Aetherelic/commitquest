import chalk from "chalk";
import {
  abandonCustomQuest,
  createCustomQuest,
  findRepository,
  getCustomQuest,
  openDatabase
} from "../data/database.js";
import {
  completeManualCustomQuest,
  customQuestStates,
  syncCustomQuestRewards
} from "../core/custom-quests.js";
import type { CustomQuestObjective, CustomQuestState } from "../core/types.js";
import { renderCustomQuests, success, warning } from "../ui/render.js";

export const CUSTOM_QUEST_OBJECTIVES: CustomQuestObjective[] = [
  "commit",
  "feat",
  "fix",
  "docs",
  "test",
  "refactor",
  "release",
  "manual"
];

export interface AddCustomQuestOptions {
  repo?: string;
  type: CustomQuestObjective;
  target: string;
  xp: string;
  deadline?: string;
}

export interface ListCustomQuestOptions {
  all?: boolean;
  repo?: string;
}

function positiveInteger(value: string, label: string, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be a whole number between 1 and ${maximum}.`);
  }
  return parsed;
}

function parseDeadline(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Deadline must use YYYY-MM-DD format.");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const deadline = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (
    deadline.getFullYear() !== year
    || deadline.getMonth() !== month - 1
    || deadline.getDate() !== day
  ) {
    throw new Error(`Invalid deadline: ${value}`);
  }
  return deadline.toISOString();
}

function questId(value: string): number {
  return positiveInteger(value, "Quest ID", Number.MAX_SAFE_INTEGER);
}

function printQuest(state: CustomQuestState): void {
  console.log(renderCustomQuests([state]));
}

export function addCustomQuestCommand(title: string, options: AddCustomQuestOptions): void {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error("Quest title cannot be empty.");
  if (trimmedTitle.length > 120) throw new Error("Quest title cannot exceed 120 characters.");

  const target = options.type === "manual"
    ? 1
    : positiveInteger(options.target, "Target", 1000);
  const rewardXp = positiveInteger(options.xp, "XP reward", 10000);
  const deadlineAt = parseDeadline(options.deadline);

  const db = openDatabase();
  const repository = options.repo ? findRepository(db, options.repo) : null;
  if (options.repo && !repository) {
    db.close();
    throw new Error(`Campaign not found: ${options.repo}`);
  }

  const quest = createCustomQuest(db, {
    title: trimmedTitle,
    repositoryId: repository?.id ?? null,
    objectiveType: options.type,
    target,
    rewardXp,
    deadlineAt
  });
  const state = customQuestStates(db).find((item) => item.id === quest.id)!;

  console.log(success(`Custom quest created: ${chalk.bold(`#${quest.id} ${quest.title}`)}`));
  console.log();
  printQuest(state);
  console.log(chalk.dim(`\nTrack it with cq quest show ${quest.id}`));
  db.close();
}

export function listCustomQuestCommand(options: ListCustomQuestOptions = {}): void {
  const db = openDatabase();
  const repository = options.repo ? findRepository(db, options.repo) : null;
  if (options.repo && !repository) {
    db.close();
    throw new Error(`Campaign not found: ${options.repo}`);
  }

  const states = syncCustomQuestRewards(db).filter((quest) => {
    if (repository && quest.repositoryId !== repository.id) return false;
    return options.all || quest.status === "active" || quest.status === "complete";
  });

  console.log(chalk.bold.magenta("CUSTOM QUESTS\n"));
  if (states.length === 0) {
    console.log(warning("No custom quests found. Create one with cq quest add <title>."));
  } else {
    console.log(renderCustomQuests(states));
  }
  db.close();
}

export function showCustomQuestCommand(idValue: string): void {
  const id = questId(idValue);
  const db = openDatabase();
  const state = syncCustomQuestRewards(db).find((quest) => quest.id === id);
  if (!state) {
    db.close();
    throw new Error(`Custom quest #${id} was not found.`);
  }

  console.log(chalk.bold.magenta(`CUSTOM QUEST #${id}\n`));
  printQuest(state);
  db.close();
}

export function completeCustomQuestCommand(idValue: string): void {
  const id = questId(idValue);
  const db = openDatabase();
  const state = completeManualCustomQuest(db, id);
  console.log(success(`Quest complete: ${chalk.bold(`#${id} ${state.title}`)} ${chalk.magenta(`+${state.rewardXp} XP`)}`));
  db.close();
}

export function abandonCustomQuestCommand(idValue: string): void {
  const id = questId(idValue);
  const db = openDatabase();
  const quest = getCustomQuest(db, id);
  if (!quest) {
    db.close();
    throw new Error(`Custom quest #${id} was not found.`);
  }
  if (quest.completedAt !== null) {
    db.close();
    throw new Error(`Completed quest #${id} cannot be abandoned.`);
  }
  if (quest.abandonedAt !== null) {
    console.log(warning(`Custom quest #${id} is already abandoned.`));
    db.close();
    return;
  }

  abandonCustomQuest(db, id, new Date().toISOString());
  console.log(success(`Quest abandoned: ${chalk.bold(`#${id} ${quest.title}`)}`));
  db.close();
}
