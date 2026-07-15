import chalk from "chalk";
import { databaseStats, openDatabase, totalXp } from "../data/database.js";
import { getProfile } from "../core/profile.js";
import { calculateLevel } from "../core/levels.js";
import { calculateStreak } from "../core/streak.js";
import { syncQuestRewards, isQuestRewarded } from "../core/quests.js";
import { syncAchievements } from "../core/achievements.js";
import { syncCustomQuestRewards } from "../core/custom-quests.js";
import { renderBanner } from "../ui/banner.js";
import { renderCustomQuests, renderLevel, renderQuests, section } from "../ui/render.js";

export function statusCommand(): void {
  const db = openDatabase();
  syncQuestRewards(db);
  const customQuests = syncCustomQuestRewards(db);
  syncAchievements(db);

  const profile = getProfile(db);
  const stats = databaseStats(db);
  const xp = totalXp(db);
  const level = calculateLevel(xp);
  const commitDates = db.prepare("SELECT authored_at AS authoredAt FROM commits").all() as Array<{ authoredAt: string }>;
  const streak = calculateStreak(commitDates.map((row) => row.authoredAt));
  const quests = syncQuestRewards(db);
  const rewardedKeys = new Set(quests.filter((quest) => isQuestRewarded(db, quest.key)).map((quest) => quest.key));

  console.log(renderBanner());
  console.log(`${chalk.bold(profile.name)}${profile.email ? chalk.dim(` · ${profile.email}`) : ""}\n`);
  console.log(section("Progress", renderLevel(level, xp)));
  console.log(`\n${section("Journey", [
    `${chalk.bold(streak.current)} day current streak · ${chalk.bold(streak.longest)} day best`,
    `${chalk.bold(stats.commits)} commit${stats.commits === 1 ? "" : "s"} · ${chalk.bold(stats.repositories)} campaign${stats.repositories === 1 ? "" : "s"} · ${chalk.bold(stats.tags)} release${stats.tags === 1 ? "" : "s"}`,
    `${chalk.bold(stats.achievements)} achievement${stats.achievements === 1 ? "" : "s"} · ${chalk.bold(stats.questRewards)} quest${stats.questRewards === 1 ? "" : "s"} completed`
  ].join("\n"))}`);
  console.log(`\n${section("Active Quests", renderQuests(quests, rewardedKeys))}`);
  const activeCustomQuests = customQuests.filter((quest) => quest.status === "active");
  if (activeCustomQuests.length > 0) {
    console.log(`\n${section("Custom Quests", renderCustomQuests(activeCustomQuests))}`);
  }
  db.close();
}
