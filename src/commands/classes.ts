import chalk from "chalk";
import { choosePlayerClass, PLAYER_CLASSES, playerClassStates } from "../core/classes.js";
import { openDatabase } from "../data/database.js";
import type { PlayerClassId } from "../core/types.js";

export const CLASS_IDS = PLAYER_CLASSES.map((entry) => entry.id);

export function classListCommand(): void {
  const db = openDatabase();
  try {
    console.log(chalk.bold("DEVELOPER PATHS\n"));
    for (const state of playerClassStates(db)) {
      const marker = state.selected ? chalk.green("◆") : "◇";
      const title = state.unlockedSkills.at(-1)?.title ?? state.title;
      console.log(`${marker} ${state.title} · Level ${state.classLevel} · ${state.classXp} class XP`);
      console.log(`  ${title} — ${state.description}`);
    }
  } finally {
    db.close();
  }
}

export function classChooseCommand(id: string): void {
  const db = openDatabase();
  try {
    choosePlayerClass(db, id as PlayerClassId);
    const selected = playerClassStates(db).find((state) => state.id === id)!;
    console.log(`${chalk.green("◆")} Developer path selected: ${selected.title}`);
    console.log(`  ${selected.description}`);
  } finally {
    db.close();
  }
}
