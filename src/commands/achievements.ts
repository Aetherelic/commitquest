import chalk from "chalk";
import { openDatabase } from "../data/database.js";
import { achievementStates, syncAchievements } from "../core/achievements.js";
import { renderAchievements } from "../ui/render.js";

export function achievementsCommand(): void {
  const db = openDatabase();
  syncAchievements(db);
  console.log(chalk.bold.magenta("ACHIEVEMENTS\n"));
  console.log(renderAchievements(achievementStates(db)));
  db.close();
}
