import fs from "node:fs";
import { execFileSync } from "node:child_process";
import chalk from "chalk";
import { getDatabasePath, getDataDirectory } from "../data/paths.js";
import { getProfile } from "../core/profile.js";
import { listRepositories, openDatabase } from "../data/database.js";
import { isGitRepository } from "../git/git.js";
import { failure, success, warning } from "../ui/render.js";

function gitVersion(): string | null {
  try {
    return execFileSync("git", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export function doctorCommand(): void {
  const checks: Array<{ ok: boolean; message: string; warning?: boolean }> = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  checks.push({ ok: nodeMajor >= 22, message: `Node.js ${process.versions.node} (22.5+ required)` });

  const git = gitVersion();
  checks.push({ ok: Boolean(git), message: git ?? "Git is not available" });

  const db = openDatabase();
  const profile = getProfile(db);
  checks.push({ ok: Boolean(profile.email), warning: !profile.email, message: profile.email ? `Profile email: ${profile.email}` : "Profile email is missing" });
  checks.push({ ok: fs.existsSync(getDatabasePath()), message: `Database: ${getDatabasePath()}` });
  checks.push({ ok: fs.existsSync(getDataDirectory()), message: `Data directory: ${getDataDirectory()}` });

  for (const repository of listRepositories(db)) {
    checks.push({
      ok: isGitRepository(repository.path),
      message: `${repository.name}: ${repository.path}`
    });
  }

  console.log(chalk.bold.magenta("COMMITQUEST DOCTOR\n"));
  for (const check of checks) {
    if (check.ok) console.log(success(check.message));
    else if (check.warning) console.log(warning(check.message));
    else console.log(failure(check.message));
  }
  db.close();
}
