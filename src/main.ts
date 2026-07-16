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
import { dashboardCommand } from "./commands/dashboard.js";
import { backupCreateCommand, backupListCommand, backupRestoreCommand } from "./commands/backup.js";
import { verboseVersionCommand } from "./commands/version.js";
import { chaptersListCommand } from "./commands/chapters.js";
import { bossBeginCommand, bossCompleteCommand, bossStatusCommand } from "./commands/boss.js";
import { CLASS_IDS, classChooseCommand, classListCommand } from "./commands/classes.js";
import { SHARE_FORMATS, shareCommand } from "./commands/share.js";
import { APP_VERSION } from "./version.js";
import { hookStatusCommand, installHookCommand, removeHookCommand } from "./commands/hook.js";
import {
  abandonCustomQuestCommand,
  addCustomQuestCommand,
  checkCustomQuestCommand,
  completeCustomQuestCommand,
  CUSTOM_QUEST_OBJECTIVES,
  listCustomQuestCommand,
  showCustomQuestCommand
} from "./commands/custom-quests.js";

const program = new Command();

program
  .name("commitquest")
  .description("Turn real Git progress into a private developer adventure.")
  .version(APP_VERSION)
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
  .command("check <message>")
  .description("Preview commit classification and custom quest progress")
  .option("--repo <name-or-path>", "check against one campaign")
  .action(checkCustomQuestCommand);

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
  .command("play")
  .alias("ui")
  .description("Open the interactive CommitQuest game")
  .action(dashboardCommand);

const backup = program
  .command("backup")
  .description("Create, list, and restore local backups");
backup.command("create").description("Create a verified backup").action(backupCreateCommand);
backup.command("list").description("List available backups").action(backupListCommand);
backup.command("restore <backup>").description("Restore a backup by ID or use latest").option("--yes", "confirm replacement of current data").action(backupRestoreCommand);
backup.action(backupCreateCommand);

program
  .command("version")
  .description("Show detailed runtime and installation information")
  .option("--verbose", "show full diagnostics")
  .action(verboseVersionCommand);

program
  .command("chapters")
  .description("Show campaign chapters and progress")
  .option("--repo <name-or-path>", "filter by campaign")
  .action(chaptersListCommand);

const boss = program.command("boss").description("Prepare and complete release boss encounters");
boss.command("begin <repo> <version>").option("--test-command <command>", "override detected test command").action(bossBeginCommand);
boss.command("status <repo> <version>").option("--run-tests", "run the configured test suite").option("--test-command <command>", "override detected test command").action(bossStatusCommand);
boss.command("complete <repo> <version>").option("--create-tag", "create an annotated local Git tag").option("--no-tests", "skip test execution").option("--test-command <command>", "override detected test command").action(bossCompleteCommand);

const developerClass = program.command("class").description("Choose and inspect developer paths");
developerClass.command("list").description("List class progression").action(classListCommand);
developerClass.command("choose <class>").description(`Select a cosmetic developer path (${CLASS_IDS.join(", ")})`).action((classId: string) => classChooseCommand(classId));
developerClass.action(classListCommand);

const share = program.command("share").description("Export a privacy-safe journey card");
share.addOption(new Option("--format <format>").choices(SHARE_FORMATS).default("svg"));
share.option("--output <path>", "output path").option("--name <name>", "public display name").option("--include-projects", "include campaign names; paths and commit subjects remain hidden").action(shareCommand);

program
  .command("doctor")
  .description("Check CommitQuest, Git, profile, and campaign health")
  .option("--repair", "create a safety backup and repair safe local issues")
  .action(doctorCommand);

program.action(dashboardCommand);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${chalk.red("CommitQuest failed:")} ${message}`);
  process.exitCode = 1;
});
