import chalk from "chalk";
import {
  abandonCustomQuest,
  createCustomQuest,
  findRepository,
  getCustomQuest,
  openDatabase
} from "../data/database.js";
import {
  analyzeCustomQuestCommit,
  completeManualCustomQuest,
  CUSTOM_QUEST_COMMIT_OBJECTIVES,
  customQuestObjectiveLabel,
  customQuestStates,
  suggestedConventionalSubject,
  syncCustomQuestRewards
} from "../core/custom-quests.js";
import type { CommitType, CustomQuestObjective, CustomQuestState, RepositoryRecord } from "../core/types.js";
import { renderCustomQuests, success, warning } from "../ui/render.js";
import { calculateBaseXp, classifyCommit } from "../core/xp.js";
import { getRepositoryRoot, isGitRepository } from "../git/git.js";

export const CUSTOM_QUEST_OBJECTIVES: CustomQuestObjective[] = [
  "commit",
  ...CUSTOM_QUEST_COMMIT_OBJECTIVES,
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

export interface CheckCustomQuestOptions {
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
  const suggestion = suggestedConventionalSubject(options.type, trimmedTitle);
  if (suggestion) {
    console.log(chalk.dim(`\nSuggested commit: ${suggestion}`));
  }
  console.log(chalk.dim(`Track it with cq quest show ${quest.id}`));
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

function resolveCheckRepository(
  db: ReturnType<typeof openDatabase>,
  selector: string | undefined
): RepositoryRecord | null {
  if (selector) {
    const repository = findRepository(db, selector);
    if (!repository) throw new Error(`Campaign not found: ${selector}`);
    return repository;
  }

  try {
    if (!isGitRepository(process.cwd())) return null;
    return findRepository(db, getRepositoryRoot(process.cwd()));
  } catch {
    return null;
  }
}

function classificationLabel(type: CommitType): string {
  if (type === "commit") return "generic commit";
  if (type === "merge") return "merge commit";
  return customQuestObjectiveLabel(type);
}

export function checkCustomQuestCommand(
  message: string,
  options: CheckCustomQuestOptions = {}
): void {
  const subject = message.trim();
  if (!subject) throw new Error("Commit message cannot be empty.");

  const db = openDatabase();
  try {
    const repository = resolveCheckRepository(db, options.repo);
    const classification = classifyCommit(subject);
    const states = customQuestStates(db);
    const analysis = analyzeCustomQuestCommit(states, {
      repositoryId: repository?.id ?? -1,
      type: classification.type,
      subject
    });

    console.log(chalk.bold.magenta("COMMIT CHECK\n"));
    console.log(`${chalk.bold("Message:")} ${subject}`);
    console.log(`${chalk.bold("Classification:")} ${classificationLabel(classification.type)}`);
    console.log(`${chalk.bold("Base type reward:")} ${chalk.magenta(`+${calculateBaseXp(classification.type, 0, classification.breaking)} XP`)} ${chalk.dim("before file-size, diminishing, and daily-cap adjustments")}`);
    console.log(`${chalk.bold("Scope:")} ${repository ? repository.name : "global quests only"}`);

    if (analysis.matching.length > 0) {
      console.log(chalk.bold.green("\nWOULD ADVANCE"));
      for (const match of analysis.matching) {
        console.log(`${chalk.green("◆")} ${chalk.bold(`#${match.quest.id} ${match.quest.title}`)} ${chalk.dim(`· ${customQuestObjectiveLabel(match.quest.objectiveType)}`)}`);
      }
    } else {
      console.log(chalk.dim("\nNo active custom quest would advance from this message."));
    }

    if (analysis.missed.length > 0) {
      const heading = classification.type === "commit"
        ? "TYPED QUESTS THIS MESSAGE WOULD MISS"
        : "OTHER ACTIVE TYPED QUESTS";
      console.log(chalk.bold.yellow(`\n${heading}`));
      for (const match of analysis.missed) {
        console.log(`${chalk.yellow("◇")} ${chalk.bold(`#${match.quest.id} ${match.quest.title}`)} ${chalk.dim(`expects ${customQuestObjectiveLabel(match.quest.objectiveType)}`)}`);
        console.log(`  ${chalk.dim(`Use: ${match.suggestedSubject}`)}`);
      }
    }
  } finally {
    db.close();
  }
}
