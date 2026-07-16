import chalk from "chalk";
import { openDatabase } from "../data/database.js";
import { writeJourneyShare, type ShareFormat } from "../core/share.js";

export const SHARE_FORMATS: ShareFormat[] = ["svg", "markdown", "json"];

export function shareCommand(options: {
  format: ShareFormat;
  output?: string;
  name?: string;
  includeProjects?: boolean;
}): void {
  const db = openDatabase();
  try {
    const destination = writeJourneyShare(db, options.format, {
      ...(options.output ? { output: options.output } : {}),
      ...(options.name ? { publicName: options.name } : {}),
      includeProjects: options.includeProjects ?? false
    });
    console.log(`${chalk.green("◆")} Journey card exported`);
    console.log(`  ${destination}`);
    if (!options.includeProjects) console.log("  Privacy mode: project names, paths, and commit subjects excluded.");
  } finally {
    db.close();
  }
}
