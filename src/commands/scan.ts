import chalk from "chalk";
import { findRepository, listRepositories, openDatabase } from "../data/database.js";
import { getProfile } from "../core/profile.js";
import { scanRepositories } from "../core/scan.js";
import { syncQuestRewards } from "../core/quests.js";
import { syncAchievements } from "../core/achievements.js";
import { success, warning } from "../ui/render.js";

export interface ScanOptions {
  repo?: string;
  allAuthors?: boolean;
}

export function scanCommand(options: ScanOptions): void {
  const db = openDatabase();
  const profile = getProfile(db);

  if (!profile.email && !options.allAuthors) {
    console.log(warning("Set your Git email first with cq profile --email you@example.com, or explicitly use --all-authors."));
    db.close();
    process.exitCode = 1;
    return;
  }

  const repositories = options.repo
    ? [findRepository(db, options.repo)].filter((value) => value !== null)
    : listRepositories(db);

  if (repositories.length === 0) {
    console.log(warning(options.repo ? `Campaign not found: ${options.repo}` : "No campaigns tracked yet. Add one with cq add <path>."));
    db.close();
    process.exitCode = 1;
    return;
  }

  const summary = scanRepositories(db, repositories, profile.email, Boolean(options.allAuthors));
  const questsBefore = new Set(
    (db.prepare("SELECT quest_key AS questKey FROM quest_rewards").all() as Array<{ questKey: string }>).map((row) => row.questKey)
  );
  const quests = syncQuestRewards(db);
  const newlyCompletedQuests = quests.filter((quest) => quest.complete && !questsBefore.has(quest.key));
  const unlockedAchievements = syncAchievements(db);

  console.log(success(`Scanned ${summary.repositories} campaign${summary.repositories === 1 ? "" : "s"}.`));
  console.log(`  ${chalk.bold(summary.importedCommits)} new commits · ${chalk.bold(summary.importedTags)} new releases · ${chalk.magenta(`+${summary.earnedXp} XP`)}`);
  if (summary.ignoredCommits > 0 && !options.allAuthors) {
    console.log(chalk.dim(`  Ignored ${summary.ignoredCommits} commits from other authors.`));
  }
  if (summary.historicalCommits > 0 || summary.historicalTags > 0) {
    const parts = [
      summary.historicalCommits > 0
        ? `${summary.historicalCommits} historical commit${summary.historicalCommits === 1 ? "" : "s"}`
        : null,
      summary.historicalTags > 0
        ? `${summary.historicalTags} historical release${summary.historicalTags === 1 ? "" : "s"}`
        : null
    ].filter((value): value is string => value !== null);
    console.log(chalk.dim(`  ${parts.join(" and ")} earned XP but did not advance active quests.`));
  }

  for (const quest of newlyCompletedQuests) {
    console.log(`\n${chalk.green("◆ QUEST COMPLETE")} ${chalk.bold(quest.title)} ${chalk.magenta(`+${quest.rewardXp} XP`)}`);
  }

  for (const achievement of unlockedAchievements) {
    console.log(`\n${chalk.cyan("◆ ACHIEVEMENT UNLOCKED")} ${chalk.bold(achievement.title)} ${chalk.magenta(`+${achievement.rewardXp} XP`)}`);
    console.log(`  ${chalk.dim(achievement.description)}`);
  }

  console.log(chalk.dim("\nView your profile with cq status"));
  db.close();
}
