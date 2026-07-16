import chalk from "chalk";
import { chapterStates, ensureDefaultChapters } from "../core/chapters.js";
import { findRepository, listRepositories, openDatabase } from "../data/database.js";

export function chaptersListCommand(options: { repo?: string }): void {
  const db = openDatabase();
  try {
    const repository = options.repo ? findRepository(db, options.repo) : null;
    if (options.repo && !repository) throw new Error(`Campaign “${options.repo}” was not found.`);
    for (const repo of repository ? [repository] : listRepositories(db)) ensureDefaultChapters(db, repo);
    const chapters = chapterStates(db, repository?.id);
    if (chapters.length === 0) {
      console.log("No campaign chapters found.");
      return;
    }
    console.log(chalk.bold("CAMPAIGN CHAPTERS\n"));
    let lastRepository = "";
    for (const chapter of chapters) {
      if (chapter.repositoryName !== lastRepository) {
        lastRepository = chapter.repositoryName;
        console.log(chalk.cyan(`${chapter.repositoryName}`));
      }
      const marker = chapter.status === "complete" ? chalk.green("◆") : chapter.status === "active" ? chalk.yellow("◇") : chalk.gray("◇");
      console.log(`${marker} Chapter ${chapter.position}: ${chapter.title}`);
      console.log(`  ${chapter.progress}/${chapter.target} · +${chapter.rewardXp} XP · ${chapter.status}`);
    }
  } finally {
    db.close();
  }
}
