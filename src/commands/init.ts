import chalk from "chalk";
import { openDatabase, getMeta } from "../data/database.js";
import { getDatabasePath } from "../data/paths.js";
import { getGitConfig } from "../git/git.js";
import { getProfile, updateProfile } from "../core/profile.js";
import { renderBanner } from "../ui/banner.js";
import { success, warning } from "../ui/render.js";

export interface InitOptions {
  name?: string;
  email?: string;
}

export function initCommand(options: InitOptions): void {
  const db = openDatabase();
  const alreadyInitialised = getMeta(db, "profile.name") !== null;
  const name = options.name ?? getGitConfig("user.name") ?? "Adventurer";
  const email = options.email ?? getGitConfig("user.email") ?? "";
  const profile = updateProfile(db, { name, email });

  console.log(renderBanner());
  console.log(success(alreadyInitialised ? "CommitQuest profile updated." : "Your first campaign has begun."));
  console.log(`\n  ${chalk.bold(profile.name)}${profile.email ? chalk.dim(` <${profile.email}>`) : ""}`);
  console.log(`  ${chalk.dim(getDatabasePath())}`);

  if (!profile.email) {
    console.log(`\n${warning("No Git email is configured. Set one with cq profile --email you@example.com before scanning.")}`);
  }

  console.log(`\n${chalk.dim("Next: cq add ~/Projects/your-repository")}`);
  db.close();
}
