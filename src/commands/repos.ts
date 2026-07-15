import chalk from "chalk";
import { listRepositories, openDatabase } from "../data/database.js";
import { renderRepositories, warning } from "../ui/render.js";

export function reposCommand(): void {
  const db = openDatabase();
  const repositories = listRepositories(db);
  if (repositories.length === 0) console.log(warning("No campaigns tracked yet. Add one with cq add <path>."));
  else {
    console.log(chalk.bold.magenta("CAMPAIGNS\n"));
    console.log(renderRepositories(repositories));
  }
  db.close();
}
