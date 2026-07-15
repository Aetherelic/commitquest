import chalk from "chalk";
import Table from "cli-table3";
import { openDatabase } from "../data/database.js";
import { formatRelativeDate } from "../core/dates.js";
import { warning } from "../ui/render.js";

export interface LogOptions {
  limit?: string;
  repo?: string;
}

export function logCommand(options: LogOptions): void {
  const db = openDatabase();
  const parsedLimit = Number(options.limit ?? 15);
  const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 15;

  const rows = options.repo
    ? db.prepare(`
        SELECT c.hash, c.subject, c.type, c.awarded_xp AS awardedXp, c.authored_at AS authoredAt, r.name AS repository
        FROM commits c JOIN repositories r ON r.id = c.repository_id
        WHERE r.name = ? COLLATE NOCASE OR r.path = ?
        ORDER BY c.authored_at DESC LIMIT ?
      `).all(options.repo, options.repo, limit)
    : db.prepare(`
        SELECT c.hash, c.subject, c.type, c.awarded_xp AS awardedXp, c.authored_at AS authoredAt, r.name AS repository
        FROM commits c JOIN repositories r ON r.id = c.repository_id
        ORDER BY c.authored_at DESC LIMIT ?
      `).all(limit);

  const commits = rows as Array<{
    hash: string;
    subject: string;
    type: string;
    awardedXp: number;
    authoredAt: string;
    repository: string;
  }>;

  if (commits.length === 0) {
    console.log(warning("No imported commits yet. Run cq scan."));
    db.close();
    return;
  }

  const table = new Table({
    head: [chalk.bold("When"), chalk.bold("Campaign"), chalk.bold("Type"), chalk.bold("Commit"), chalk.bold("XP")],
    colWidths: [14, 20, 12, 58, 8],
    wordWrap: true,
    style: { head: [], border: [] }
  });

  for (const commit of commits) {
    table.push([
      formatRelativeDate(commit.authoredAt),
      commit.repository,
      chalk.cyan(commit.type),
      `${chalk.dim(commit.hash.slice(0, 7))} ${commit.subject}`,
      chalk.magenta(`+${commit.awardedXp}`)
    ]);
  }

  console.log(chalk.bold.magenta("ADVENTURE LOG\n"));
  console.log(table.toString());
  db.close();
}
