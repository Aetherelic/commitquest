import chalk from "chalk";
import { openDatabase } from "../data/database.js";
import { isQuestRewarded, syncQuestRewards } from "../core/quests.js";
import { syncCustomQuestRewards } from "../core/custom-quests.js";
import { renderCustomQuests, renderQuests } from "../ui/render.js";

export function questsCommand(): void {
  const db = openDatabase();
  const quests = syncQuestRewards(db);
  const rewardedKeys = new Set(quests.filter((quest) => isQuestRewarded(db, quest.key)).map((quest) => quest.key));
  console.log(chalk.bold.magenta("QUEST BOARD\n"));
  console.log(renderQuests(quests, rewardedKeys));

  const customQuests = syncCustomQuestRewards(db).filter(
    (quest) => quest.status === "active" || quest.status === "complete"
  );
  if (customQuests.length > 0) {
    console.log(chalk.bold.magenta("\nCUSTOM QUESTS\n"));
    console.log(renderCustomQuests(customQuests));
  }
  db.close();
}
