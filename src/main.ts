#!/usr/bin/env node

import { Command, Option } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";
import { scanCommand } from "./commands/scan.js";
import { statusCommand } from "./commands/status.js";
import { reposCommand } from "./commands/repos.js";
import { logCommand } from "./commands/log.js";
import { questsCommand } from "./commands/quests.js";
import { achievementsCommand } from "./commands/achievements.js";
import { profileCommand } from "./commands/profile.js";
import { doctorCommand } from "./commands/doctor.js";
import { hookStatusCommand, installHookCommand, removeHookCommand } from "./commands/hook.js";
import {
  abandonCustomQuestCommand,
  addCustomQuestCommand,
  completeCustomQuestCommand,
  CUSTOM_QUEST_OBJECTIVES,
  listCustomQuestCommand,
  showCustomQuestCommand
} from "./commands/custom-quests.js";

const program = new Command();

program
  .name("commitquest")
  .description("Turn real Git progress into a private developer adventure.")
  .version("0.1.0")
  .showHelpAfterError();

program
  .command("init")
  .description("Create or update your local CommitQuest profile")
  .option("--name <name>", "developer name")
  .option("--email <email>", "Git author email used to award XP")
  .action(initCommand);

program
  .command("add <path>")
  .description("Add a local Git repository as a campaign")
  .option("--name <name>", "custom campaign name")
  .action(addCommand);

const scan = program
  .command("scan")
  .description("Scan tracked repositories for new commits and releases")
  .option("--repo <name-or-path>", "scan one campaign")
  .option("--all-authors", "award XP for every author in the repository");
scan.addOption(new Option("--hook", "use concise post-commit output").hideHelp());
scan.action(scanCommand);

program
  .command("status")
  .alias("s")
  .description("Show your developer profile, progression, and quests")
  .action(statusCommand);

program
  .command("repos")
  .alias("campaigns")
  .description("List tracked campaigns")
  .action(reposCommand);

program
  .command("log")
  .description("Show recent rewarded commits")
  .option("-n, --limit <number>", "number of commits to show", "15")
  .option("--repo <name-or-path>", "filter by campaign")
  .action(logCommand);

program
  .command("quests")
  .description("Show the current quest board")
  .action(questsCommand);

const customQuest = program
  .command("quest")
  .description("Create and manage custom campaign quests");

const addCustomQuest = customQuest
  .command("add <title>")
  .description("Create a custom quest")
  .option("--repo <name-or-path>", "limit progress to one campaign")
  .option("--target <number>", "activity required to complete the quest", "1")
  .option("--xp <number>", "XP awarded on completion", "100")
  .option("--deadline <YYYY-MM-DD>", "optional completion deadline");
addCustomQuest.addOption(
  new Option("--type <type>", "quest objective")
    .choices(CUSTOM_QUEST_OBJECTIVES)
    .default("manual")
);
addCustomQuest.action(addCustomQuestCommand);

customQuest
  .command("list")
  .description("List custom quests")
  .option("--all", "include abandoned and expired quests")
  .option("--repo <name-or-path>", "filter by campaign")
  .action(listCustomQuestCommand);

customQuest
  .command("show <id>")
  .description("Show one custom quest")
  .action(showCustomQuestCommand);

customQuest
  .command("complete <id>")
  .description("Complete a manual custom quest")
  .action(completeCustomQuestCommand);

customQuest
  .command("abandon <id>")
  .description("Abandon an active custom quest")
  .action(abandonCustomQuestCommand);

customQuest.action(() => listCustomQuestCommand());

program
  .command("achievements")
  .alias("ach")
  .description("Show locked and unlocked achievements")
  .action(achievementsCommand);

program
  .command("profile")
  .description("View or edit the local developer profile")
  .option("--name <name>", "developer name")
  .option("--email <email>", "Git author email used to award XP")
  .action(profileCommand);

const hook = program
  .command("hook")
  .description("Manage automatic post-commit rewards");

hook
  .command("install [path]")
  .description("Enable automatic scanning after commits")
  .action(installHookCommand);

hook
  .command("remove [path]")
  .description("Disable automatic scanning and restore any original hook")
  .action(removeHookCommand);

hook
  .command("status [path]")
  .description("Show whether live rewards are enabled")
  .action(hookStatusCommand);

hook.action(() => hookStatusCommand("."));

program
  .command("doctor")
  .description("Check CommitQuest, Git, profile, and campaign health")
  .action(doctorCommand);

program.action(() => statusCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${chalk.red("CommitQuest failed:")} ${message}`);
  process.exitCode = 1;
});
